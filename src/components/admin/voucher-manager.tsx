"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SellerPortalIcon, SellerPortalNav } from "./seller-portal-nav";
import styles from "./seller-orders.module.css";

type Voucher = {
  id: number;
  code: string;
  kind: string;
  value: string;
  minSubtotal: string;
  maxDiscount: string | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perUserLimit: number;
  isActive: boolean;
  version: number;
  _count: { redemptions: number };
};

function dateField(instant: string) {
  const date = new Date(instant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatVnd(value: string | number) {
  const str = String(value);
  if (/^\d+$/.test(str)) {
    return `${new Intl.NumberFormat("vi-VN").format(BigInt(str))} VND`;
  }
  return `${str} VND`;
}

export function VoucherManager() {
  const [rows, setRows] = useState<Voucher[]>([]);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shop?view=vouchers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setRows(result.data);
    } catch (error) {
      setIsError(true);
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const input = {
      ...fields,
      action: "voucher-save",
      ...(editing ? { id: editing.id, version: editing.version } : {}),
      usageLimit: fields.usageLimit === "" ? null : Number(fields.usageLimit),
      perUserLimit: Number(fields.perUserLimit),
      isActive: fields.isActive === "on",
      startsAt: new Date(String(fields.startsAt)).toISOString(),
      endsAt: new Date(String(fields.endsAt)).toISOString(),
    };
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setEditing(null);
      form.reset();
      setIsError(false);
      setMessage("Đã lưu voucher.");
      await load();
    } catch (error) {
      setIsError(true);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const totalRedemptions = rows.reduce((sum, r) => sum + r._count.redemptions, 0);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <SellerPortalNav active="vouchers" />

        <header className={styles.heroCard}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              AUREL · NGƯỜI BÁN
            </span>
            <h1>Quản lý voucher</h1>
            <p className={styles.heroSubtitle}>
              Mỗi đơn dùng một mã VND. Lượt dùng được hoàn lại khi hủy đơn trước giao hàng. Thời
              gian nhập theo múi giờ của thiết bị.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/admin/orders" className={styles.btnSubtle}>
              <SellerPortalIcon name="orders" />
              <span>Đơn hàng</span>
            </Link>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => void load()}
              disabled={loading || busy}
            >
              <SellerPortalIcon name="refresh" />
              <span>Tải lại danh sách</span>
            </button>
          </div>
        </header>

        {/* Summary KPI Strip */}
        <section className={styles.statsGrid} aria-label="Tổng quan voucher">
          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statPeriod}>Tổng số mã</span>
              <span className={styles.statBadge}>Tối đa 200</span>
            </div>
            <div className={styles.statValue}>{rows.length}</div>
            <div className={styles.statFooter}>
              <span>Mã khuyến mãi đã khởi tạo</span>
              <span>VND</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statPeriod}>Đang hoạt động</span>
              <span className={styles.statBadge}>Sẵn sàng</span>
            </div>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statFooter}>
              <span>{rows.length - activeCount} mã đang tạm tắt</span>
              <span>Checkout</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statPeriod}>Lượt đã áp dụng</span>
              <span className={styles.statBadge}>Hợp lệ</span>
            </div>
            <div className={styles.statValue}>{totalRedemptions}</div>
            <div className={styles.statFooter}>
              <span>Không tính đơn đã hủy</span>
              <span>Tự động hoàn lượt</span>
            </div>
          </div>
        </section>

        {message && (
          <div role="status" className={isError ? styles.error : styles.notice}>
            <span>{message}</span>
          </div>
        )}

        {loading && (
          <div className={styles.statusLine} role="status">
            <span className={styles.statusIndicator}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <span>Đang tải voucher…</span>
            </span>
          </div>
        )}

        <div className={styles.voucherLayout}>
          {/* Left Column: Create / Edit Voucher Form */}
          <section className={styles.sectionCard} aria-labelledby="voucher-form-heading">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span className={styles.sectionIcon}>
                  <SellerPortalIcon name={editing ? "voucher" : "plus"} />
                </span>
                <div>
                  <h2 id="voucher-form-heading">
                    {editing ? `Sửa ${editing.code}` : "Tạo voucher"}
                  </h2>
                  <p>
                    {editing
                      ? "Cập nhật thông số áp dụng hoặc bật/tắt trạng thái mã"
                      : "Thiết lập mã ưu đãi mới cho khách hàng tại bước thanh toán"}
                  </p>
                </div>
              </div>
              {editing && <span className={styles.countPill}>Phiên bản #{editing.version}</span>}
            </div>

            <form
              key={editing ? `${editing.id}-${editing.version}` : "new"}
              className={styles.formGrid}
              onSubmit={save}
            >
              <label className={`${styles.fieldGroup} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Mã giảm giá</span>
                <input
                  name="code"
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
                  maxLength={32}
                  defaultValue={editing?.code ?? ""}
                  readOnly={Boolean(editing)}
                  placeholder="Ví dụ: DEMO10"
                  className={`${styles.input} ${styles.codeInput}`}
                />
                <span className={styles.fieldHint}>
                  Từ 3–32 ký tự chữ, số, gạch ngang hoặc gạch dưới (không đổi mã sau khi tạo).
                </span>
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Loại giảm</span>
                <select
                  name="kind"
                  defaultValue={editing?.kind ?? "PERCENT"}
                  className={styles.select}
                >
                  <option value="PERCENT">Phần trăm (%)</option>
                  <option value="FIXED">Số tiền (VND)</option>
                </select>
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Mức giảm</span>
                <input
                  name="value"
                  type="number"
                  min={1}
                  max="999999999999999999"
                  step={1}
                  required
                  defaultValue={editing?.value ?? "10"}
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Giá trị hàng tối thiểu (VND)</span>
                <input
                  name="minSubtotal"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={editing?.minSubtotal ?? "0"}
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>
                  Giảm tối đa (VND, bỏ trống nếu không giới hạn)
                </span>
                <input
                  name="maxDiscount"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={editing?.maxDiscount ?? ""}
                  placeholder="Không giới hạn"
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Bắt đầu</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={editing ? dateField(editing.startsAt) : ""}
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Kết thúc</span>
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  defaultValue={editing ? dateField(editing.endsAt) : ""}
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>
                  Tổng lượt dùng (bỏ trống nếu không giới hạn)
                </span>
                <input
                  name="usageLimit"
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  defaultValue={editing?.usageLimit ?? ""}
                  placeholder="Không giới hạn"
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Lượt dùng mỗi khách</span>
                <input
                  name="perUserLimit"
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  required
                  defaultValue={editing?.perUserLimit ?? 1}
                  className={styles.input}
                />
              </label>

              <label className={styles.toggleRow}>
                <span className={styles.toggleText}>
                  <strong>Đang hoạt động</strong>
                  <span>Cho phép khách hàng nhập và áp dụng mã này ở bước thanh toán</span>
                </span>
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editing?.isActive ?? true}
                  className={styles.checkbox}
                />
              </label>

              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={busy}>
                  {busy ? "Đang lưu…" : "Lưu voucher"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className={styles.btnOutline}
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Right Column: Voucher List */}
          <section className={styles.sectionCard} aria-labelledby="voucher-list-heading">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span className={styles.sectionIcon}>
                  <SellerPortalIcon name="voucher" />
                </span>
                <div>
                  <h2 id="voucher-list-heading">Voucher (tối đa 200 mã gần nhất)</h2>
                  <p>Danh sách mã giảm giá và tiến độ sử dụng thực tế</p>
                </div>
              </div>
              <span className={styles.countPill}>{rows.length} mã</span>
            </div>

            {!loading && !rows.length && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                  <SellerPortalIcon name="voucher" />
                </div>
                <h3>Chưa có mã giảm giá</h3>
                <p>Chưa có mã giảm giá. Tạo mã đầu tiên ở biểu mẫu bên cạnh để bắt đầu.</p>
              </div>
            )}

            <div className={styles.voucherList}>
              {rows.map((row) => (
                <article className={styles.voucherCard} key={row.id}>
                  <div className={styles.voucherCardHeader}>
                    <span className={styles.voucherCodeTag}>{row.code}</span>
                    <span className={styles.badge} data-paid={row.isActive}>
                      {row.isActive ? "Đang bật" : "Đã tắt"}
                    </span>
                  </div>

                  <p className={styles.voucherDiscount}>
                    Giảm {row.kind === "PERCENT" ? `${row.value}%` : formatVnd(row.value)} · đơn từ{" "}
                    {formatVnd(row.minSubtotal)}
                    {row.maxDiscount ? ` · giảm tối đa ${formatVnd(row.maxDiscount)}` : ""}
                  </p>

                  <div className={styles.voucherMetaGrid}>
                    <div>
                      <strong>Hiệu lực:</strong>
                      <br />
                      {new Date(row.startsAt).toLocaleString("vi-VN")} →{" "}
                      {new Date(row.endsAt).toLocaleString("vi-VN")}
                    </div>
                    <div>
                      <strong>Lượt sử dụng:</strong>
                      <br />
                      Đã dùng {row._count.redemptions}/{row.usageLimit ?? "không giới hạn"} · mỗi
                      khách {row.perUserLimit} lượt (không tính đơn đã hủy).
                    </div>
                  </div>

                  <div className={styles.voucherFooter}>
                    <span className={styles.fieldHint}>ID #{row.id}</span>
                    <button
                      type="button"
                      className={styles.btnSubtle}
                      disabled={busy}
                      onClick={() => setEditing(row)}
                    >
                      Sửa / bật tắt mã
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
