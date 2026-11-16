"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  sellerActions,
  sellerFilters,
  type SellerFilter,
  type SellerOrder,
  type SellerOrdersPage,
} from "@/features/orders/seller-order-rules";
import { statusLabels } from "@/features/shop/rules";
import { paymentLabels } from "@/features/payments/rules";
import { SellerPortalIcon, SellerPortalNav } from "./seller-portal-nav";
import styles from "./seller-orders.module.css";
import design from "./seller-orders-design.module.css";
import { AdminIcon } from "./admin-icon";

const actionLabels: Record<string, string> = {
  CONFIRMED: "Xác nhận · Chuẩn bị hàng",
  SHIPPED: "Đã giao vận chuyển",
  DELIVERED: "Đã giao thành công",
  CANCELLED: "Hủy đơn",
};

const filterHints: Record<
  SellerFilter,
  { hint: string; icon: "box" | "orders" | "alert" | "layers" }
> = {
  READY: { hint: "Đơn COD & payOS đủ điều kiện giao", icon: "box" },
  WAITING: { hint: "Đang chờ khách chuyển khoản", icon: "orders" },
  REVIEW: { hint: "Sai lệch hoặc cần kiểm tra", icon: "alert" },
  ALL: { hint: "Toàn bộ lịch sử đơn hàng", icon: "layers" },
};

function amount(value: string, currency: string | null) {
  return currency === "VND" && /^\d+$/.test(value)
    ? `${new Intl.NumberFormat("vi-VN").format(BigInt(value))} VND`
    : `${value} ${currency ?? "(chưa xác định tiền tệ)"}`;
}

async function readDashboard(
  filter: SellerFilter,
  page: number,
  signal?: AbortSignal
): Promise<SellerOrdersPage> {
  const response = await fetch(`/api/admin/orders?filter=${filter}&page=${page}`, {
    cache: "no-store",
    signal,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Không thể tải đơn hàng.");
  return body.data;
}

function OrderThumbnail({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={design.thumbnail}>
    {src && !failed ? <Image src={src} alt={name} fill sizes="64px"
      unoptimized={src.startsWith("/images/uploads/")} onError={() => setFailed(true)} />
      : <span role="img" aria-label={`Ảnh không khả dụng: ${name}`}><SellerPortalIcon name="box" /></span>}
  </span>;
}

export function SellerOrders(props: { initialData?: SellerOrdersPage | null }) {
  const initialData = props?.initialData ?? null;
  const [filter, setFilter] = useState<SellerFilter>(initialData?.filter ?? "READY");
  const [page, setPage] = useState(initialData?.page ?? 1);
  const [data, setData] = useState<SellerOrdersPage | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const mutationLock = useRef(false);
  const requestEpoch = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestEpoch.current++;
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = ++requestEpoch.current;
      setLoading(true);
      try {
        const result = await readDashboard(filter, page, signal);
        if (signal?.aborted || epoch !== requestEpoch.current) return;
        setData(result);
        setPage(result.page);
        setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
        setError("");
      } catch (failure) {
        if (!signal?.aborted && epoch === requestEpoch.current) {
          setError(failure instanceof Error ? failure.message : "Không thể tải đơn hàng.");
        }
      } finally {
        if (!signal?.aborted && epoch === requestEpoch.current) setLoading(false);
      }
    },
    [filter, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden && !mutationLock.current) await load(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 20000);
    }
    timer = setTimeout(() => void poll(), 0);
    return () => {
      invalidateRequests();
      controller.abort();
      clearTimeout(timer);
    };
  }, [invalidateRequests, load]);

  async function update(order: SellerOrder, status: string) {
    if (mutationLock.current || !sellerActions(order).includes(status)) return;
    if (!window.confirm(`${actionLabels[status]} cho đơn ${order.orderNumber}?`)) return;
    mutationLock.current = true;
    setBusyId(order.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, expected: order.status, status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không thể cập nhật trạng thái.");
      setNotice(`Đã cập nhật đơn ${order.orderNumber}: ${statusLabels[status]}.`);
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Chưa xác nhận được thay đổi. Hãy tải lại đơn trước khi thử lại."
      );
    } finally {
      mutationLock.current = false;
      setBusyId(null);
    }
  }

  const current = data?.filter === filter && data.page === page ? data : null;

  const visibleOrders = useMemo(() => {
    if (!current) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return current.orders;
    return current.orders.filter((order) => {
      if (order.orderNumber.toLowerCase().includes(q)) return true;
      if (order.shippingName.toLowerCase().includes(q)) return true;
      if (order.shippingPhone.toLowerCase().includes(q)) return true;
      if (order.shippingAddress.toLowerCase().includes(q)) return true;
      return order.items.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.color.toLowerCase().includes(q) ||
          item.size.toLowerCase().includes(q)
      );
    });
  }, [current, searchQuery]);

  return (
    <div className={`${styles.page} ${design.ordersPage}`}>
      <div className={styles.container}>
        <SellerPortalNav active="orders" />

        <header className={styles.heroCard}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              AUREL · NGƯỜI BÁN
            </span>
            <h1>Quản lý đơn hàng</h1>
            <p className={styles.heroSubtitle}>
              Đơn payOS đã được xác nhận thanh toán sẽ tự xuất hiện trong danh sách cần xử lý.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/admin/orders/reports" className={styles.btnSubtle}>
              <SellerPortalIcon name="chart" />
              <span>Báo cáo &amp; tồn kho</span>
            </Link>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={loading || busyId !== null}
              onClick={() => void load()}
            >
              <SellerPortalIcon name="refresh" />
              <span>Làm mới đơn hàng</span>
            </button>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Lọc đơn hàng">
          {(Object.entries(sellerFilters) as [SellerFilter, string][]).map(([key, label]) => {
            const meta = filterHints[key];
            return (
              <button
                key={key}
                type="button"
                className={styles.tabCard}
                aria-pressed={filter === key}
                disabled={busyId !== null}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                  setNotice("");
                }}
              >
                <div className={styles.tabCardTop}>
                  <span className={styles.tabIconWrap}>
                    <SellerPortalIcon name={meta.icon} />
                  </span>
                  <span className={styles.tabLabel}>{label}</span>
                  {filter === key && <span className={design.cardArrow} aria-hidden="true">→</span>}
                </div>
                <div className={styles.tabCardBottom}>
                  <span className={styles.tabHint}>{meta.hint}</span>
                  <strong className={styles.tabCount}>{data?.counts[key] ?? "—"}</strong>
                </div>
              </button>
            );
          })}
        </nav>

        <div className={styles.statusLine}>
          <span className={styles.statusIndicator}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>
              {lastUpdated
                ? `Cập nhật lúc ${lastUpdated} · Tự làm mới mỗi 20 giây khi đang xem trang.`
                : "Đang kết nối dữ liệu đơn hàng…"}
            </span>
          </span>
          {loading && <span role="status">Đang tải đơn hàng…</span>}
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button
              type="button"
              className={styles.btnSubtle}
              disabled={busyId !== null}
              onClick={() => void load()}
            >
              Tải lại đơn hàng
            </button>
          </div>
        )}

        {notice && (
          <div role="status" className={styles.notice}>
            <span>{notice}</span>
          </div>
        )}

        {current && !current.paymentsAvailable && (
          <div className={styles.noteBanner}>
            <span>payOS đang chờ hoàn tất thiết lập. Các đơn hiện có vẫn được hiển thị.</span>
          </div>
        )}

        {current && current.orders.length === 0 && !loading && !error && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <SellerPortalIcon name="orders" />
            </div>
            <h2>Chưa có đơn trong nhóm này</h2>
            <p>
              Đơn mới sẽ xuất hiện tự động khi đủ điều kiện. Bạn có thể xem nhóm “Tất cả đơn”.
            </p>
            {filter !== "ALL" && (
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => {
                    setFilter("ALL");
                    setPage(1);
                  }}
                >
                  Xem tất cả đơn
                </button>
              </div>
            )}
          </div>
        )}

        {current && current.orders.length > 0 && (
          <section className={styles.ordersTableCard} aria-label="Bảng quản lý đơn hàng" aria-busy={loading}>
            <div className={styles.tableToolbar}>
              <div className={styles.tableToolbarInfo}>
                <strong>{sellerFilters[filter]}</strong>
                <span className={styles.countPill}>
                  {searchQuery.trim()
                    ? `${visibleOrders.length}/${current.orders.length} đơn trên trang`
                    : `${current.total} đơn`}
                </span>
              </div>
              <div className={styles.tableSearchWrap}>
                <span className={design.searchIcon}><AdminIcon name="search" /></span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm mã đơn, tên khách, SĐT, sản phẩm, SKU…"
                  aria-label="Tìm nhanh đơn hàng trên trang"
                  className={styles.tableSearchInput}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.tableSearchClear}
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {visibleOrders.length === 0 ? (
              <div className={styles.tableFilterEmpty}>
                <p>Không tìm thấy đơn hàng khớp từ khóa “{searchQuery}” trên trang này.</p>
                <button
                  type="button"
                  className={styles.btnSubtle}
                  onClick={() => setSearchQuery("")}
                >
                  Xóa lọc tìm kiếm
                </button>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.ordersTable}>
                  <thead>
                    <tr>
                      <th scope="col">Mã đơn &amp; Thời gian</th>
                      <th scope="col">Khách hàng &amp; Nhận hàng</th>
                      <th scope="col">Sản phẩm đặt mua</th>
                      <th scope="col">Thanh toán &amp; Tổng tiền</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className={styles.thActions}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => {
                      const actions = sellerActions(order);
                      return (
                        <tr key={order.id} className={styles.orderTableRow}>
                          {/* 1. Mã đơn & Thời gian */}
                          <td className={styles.cellOrderCode}>
                            <strong className={styles.orderCode}>{order.orderNumber}</strong>
                            <span className={styles.cellSub}>
                              {new Date(order.createdAt).toLocaleString("vi-VN")}
                            </span>
                          </td>

                          {/* 2. Khách hàng & Nhận hàng */}
                          <td className={styles.cellCustomer}>
                            <div className={styles.customerNameRow}>
                              <span className={design.customerIcon}><AdminIcon name="users" /></span>
                              <strong>{order.shippingName}</strong>
                              <a href={`tel:${order.shippingPhone}`} className={styles.phoneLink}>
                                {order.shippingPhone}
                              </a>
                            </div>
                            <span className={styles.addressText}>{order.shippingAddress}</span>
                          </td>

                          {/* 3. Sản phẩm */}
                          <td className={styles.cellItems}>
                            <ul className={styles.tableItemList}>
                              {order.items.map((item, index) => (
                                <li key={`${item.sku}:${index}`} className={styles.tableItem}>
                                  <OrderThumbnail key={item.imageUrl ?? "missing"} src={item.imageUrl} name={item.productName} />
                                  <div className={design.itemCopy}>
                                  <div className={styles.tableItemTop}>
                                    <strong>{item.productName}</strong>
                                    <span className={styles.qtyBadge}>×{item.quantity}</span>
                                  </div>
                                  <div className={styles.tableItemMeta}>
                                    <span>
                                      {item.color} / {item.size}
                                    </span>
                                    <span>·</span>
                                    <span>{amount(item.unitPrice, order.currency)}</span>
                                    <span className={styles.skuTag}>SKU: {item.sku}</span>
                                  </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </td>

                          {/* 4. Thanh toán & Tổng tiền */}
                          <td className={styles.cellPayment}>
                            <strong className={styles.totalAmountText}>
                              {amount(order.totalAmount, order.currency)}
                            </strong>
                            {order.voucherCode && (
                              <span className={styles.voucherTag}>
                                Voucher {order.voucherCode}: −
                                {amount(order.discountAmount, order.currency)}
                              </span>
                            )}
                            <span className={styles.badge} data-paid={!!order.payment?.paidAt}>
                              {order.payment
                                ? `payOS · ${paymentLabels[order.payment.status] ?? order.payment.status}`
                                : order.orderNumber.startsWith("DEMO-")
                                  ? "COD · Thanh toán khi nhận hàng"
                                  : "Đơn lịch sử"}
                            </span>
                            {order.payment?.paidAt && (
                              <span className={styles.cellSub}>
                                TT: {new Date(order.payment.paidAt).toLocaleString("vi-VN")}
                              </span>
                            )}
                            {order.payment?.paidAmount && (
                              <span className={styles.cellSub}>
                                Đã ghi nhận: {amount(order.payment.paidAmount, "VND")}
                              </span>
                            )}
                            {order.payment && (
                              <details className={styles.inlinePaymentDetails}>
                                <summary>Giao dịch payOS</summary>
                                <p>
                                  Mã link: {order.payment.paymentLinkId ?? "Đang cập nhật"}
                                  <br />
                                  Tham chiếu:{" "}
                                  {order.payment.reference ?? "Chưa có giao dịch xác nhận"}
                                </p>
                              </details>
                            )}
                          </td>

                          {/* 5. Trạng thái */}
                          <td className={styles.cellStatus}>
                            <span className={styles.badge} data-status={order.status}>
                              <SellerPortalIcon name="clock" />
                              {statusLabels[order.status] ?? order.status}
                            </span>
                            {order.payment?.reconciliationRequired && (
                              <p role="status" className={styles.inlineReview}>
                                Cần đối soát khoản tiền nhận. Chưa xử lý giao/hủy tại đây.
                              </p>
                            )}
                            {order.payment &&
                              !order.payment.paidAt &&
                              !order.payment.reconciliationRequired && (
                                <p className={styles.inlineNote}>
                                  Chưa xác nhận thanh toán; chỉ giao sau khi payOS nhận đủ tiền.
                                </p>
                              )}
                          </td>

                          {/* 6. Thao tác */}
                          <td className={styles.cellActions}>
                            <div className={styles.tableActionStack}>
                              {actions.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className={
                                    status === "CANCELLED"
                                      ? styles.btnTableOutline
                                      : styles.btnTablePrimary
                                  }
                                  disabled={busyId !== null}
                                  onClick={() => void update(order, status)}
                                >
                                  {busyId === order.id ? "Đang cập nhật…" : actionLabels[status]}
                                </button>
                              ))}
                              <Link
                                href={`/admin/orders/${order.id}/print`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.btnTableSubtle}
                              >
                                <SellerPortalIcon name="printer" />
                                <span>In phiếu đóng gói ↗</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {current && current.pages > 1 && (
          <nav className={styles.pagination} aria-label="Phân trang đơn hàng">
            <button
              type="button"
              className={styles.btnOutline}
              disabled={page <= 1 || loading || busyId !== null}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {page}/{current.pages} · {current.total} đơn
            </span>
            <button
              type="button"
              className={styles.btnOutline}
              disabled={page >= current.pages || loading || busyId !== null}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
