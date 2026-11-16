"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  reviewStatusLabels,
  type AdminReviewItem,
  type AdminReviewsFilter,
  type AdminReviewsPage,
  type ReviewStatus,
} from "@/features/reviews/types";
import { SellerPortalNav } from "./seller-portal-nav";
import ordersStyles from "./seller-orders.module.css";
import styles from "./seller-reviews.module.css";

const FILTERS: { key: AdminReviewsFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đang hiển thị" },
  { key: "HIDDEN", label: "Đã ẩn" },
];

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SellerReviews() {
  const [filter, setFilter] = useState<AdminReviewsFilter>("ALL");
  const [data, setData] = useState<AdminReviewsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [draftReplies, setDraftReplies] = useState<Record<number, string>>({});

  const loadReviews = useCallback(async (targetFilter: AdminReviewsFilter, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?filter=${targetFilter}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không thể tải danh sách đánh giá.");
      const payload = json.data as AdminReviewsPage;
      setData(payload);
      setDraftReplies(prev => {
        const next = { ...prev };
        for (const item of payload.reviews) {
          if (next[item.id] === undefined) {
            next[item.id] = item.adminReply ?? "";
          }
        }
        return next;
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối máy chủ.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/reviews?filter=${filter}`, { cache: "no-store" })
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Không thể tải danh sách đánh giá.");
        if (!active) return;
        const payload = json.data as AdminReviewsPage;
        setData(payload);
        setDraftReplies(prev => {
          const next = { ...prev };
          for (const item of payload.reviews) {
            if (next[item.id] === undefined) {
              next[item.id] = item.adminReply ?? "";
            }
          }
          return next;
        });
        setError("");
      })
      .catch(err => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể kết nối máy chủ.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter]);

  async function handleModeration(
    review: AdminReviewItem,
    patch: { status?: ReviewStatus; adminReply?: string | null },
  ) {
    if (busyId !== null) return;
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không thể cập nhật đánh giá.");
      setNotice(`Đã cập nhật đánh giá #${review.id} (${review.productName}).`);
      await loadReviews(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thay đổi.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAutoFiveStar(enabled: boolean) {
    if (autoBusy) return;
    setAutoBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_five_star", enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không thể cập nhật chế độ tự động 5 sao.");
      const nextStatus = json.data?.autoFiveStar;
      const totalActiveProducts = json.data?.totalActiveProducts ?? 0;
      setData(prev => (prev ? { ...prev, autoFiveStar: nextStatus } : prev));
      setNotice(
        enabled
          ? `Đã bật auto đánh giá 5 sao cho ${totalActiveProducts} sản phẩm đang bán (sản phẩm đã có đánh giá thật vẫn giữ nguyên số sao thực tế).`
          : "Đã tắt chế độ auto đánh giá 5 sao mặc định.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối máy chủ.");
    } finally {
      setAutoBusy(false);
    }
  }

  async function handleDelete(review: AdminReviewItem) {
    if (busyId !== null || !window.confirm("Xóa vĩnh viễn đánh giá này?")) return;
    setBusyId(review.id); setError(""); setNotice("");
    try {
      const res = await fetch("/api/admin/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: review.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không thể xóa đánh giá.");
      setNotice("Đã xóa đánh giá.");
      await loadReviews(filter);
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusyId(null); }
  }

  return (
    <div className={ordersStyles.page}>
      <div className={ordersStyles.container}>
        <SellerPortalNav active="reviews" />

        <header className={ordersStyles.header}>
          <div>
            <p className={ordersStyles.eyebrow}>AUREL · QUẢN LÝ ĐÁNH GIÁ</p>
            <h1 className={ordersStyles.title}>Đánh giá khách hàng</h1>
            <p className={ordersStyles.subtitle}>
              Đánh giá mới hiển thị ngay. Shop có thể phản hồi, ẩn hoặc xóa. Bình luận tự do được quản lý bằng nút Xóa bình luận trên trang sản phẩm khi đăng nhập tài khoản quản trị.
            </p>
          </div>
        </header>

        <section className={styles.autoBar} aria-label="Tự động đánh giá 5 sao">
          <div className={styles.autoInfo}>
            <h2 className={styles.autoTitle}>Auto đánh giá 5 sao toàn bộ sản phẩm</h2>
            <p className={styles.autoDesc}>
              {data?.autoFiveStar?.enabled
                ? "Đang bật: Mọi sản phẩm chưa có đánh giá thật đều hiển thị 5 sao trên cửa hàng."
                : "Đang tắt: Chỉ hiển thị số sao khi có đánh giá thật từ khách đã nhận hàng."}
            </p>
          </div>
          <div className={styles.autoActions}>
            <button
              type="button"
              className={styles.btnAutoEnable}
              disabled={autoBusy || data?.autoFiveStar?.enabled === true}
              onClick={() => handleAutoFiveStar(true)}
            >
              {autoBusy ? "Đang áp dụng..." : data?.autoFiveStar?.enabled ? "Đã bật 5 sao tất cả" : "Auto đánh giá 5 sao tất cả sản phẩm"}
            </button>
            {data?.autoFiveStar?.enabled && (
              <button
                type="button"
                className={styles.btnAutoDisable}
                disabled={autoBusy}
                onClick={() => handleAutoFiveStar(false)}
              >
                Tắt tự động 5 sao
              </button>
            )}
          </div>
        </section>

        {error && (
          <p role="alert" className={ordersStyles.error}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className={ordersStyles.notice}>
            {notice}
          </p>
        )}

        {data && !data.available ? (
          <div className={ordersStyles.empty}>
            <h2>Bảng đánh giá chưa được kích hoạt trên cơ sở dữ liệu hiện tại</h2>
            <p>
              Migration <code>prisma/migrations/20261113211500_product_reviews/migration.sql</code> đã sẵn sàng. Sau khi áp dụng
              migration, danh sách đánh giá cần duyệt sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.filterBar} role="group" aria-label="Lọc theo trạng thái">
              {FILTERS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.filterBtn}
                  aria-pressed={filter === item.key}
                  onClick={() => {
                    setLoading(true);
                    setFilter(item.key);
                  }}
                >
                  <span>{item.label}</span>
                  <span>({data?.counts[item.key] ?? 0})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className={ordersStyles.empty}>Đang tải đánh giá...</div>
            ) : !data || data.reviews.length === 0 ? (
              <div className={ordersStyles.empty}>Chưa có đánh giá nào trong mục này.</div>
            ) : (
              <div className={styles.list}>
                {data.reviews.map(review => {
                  const busy = busyId === review.id;
                  const replyValue = draftReplies[review.id] ?? "";
                  return (
                    <article key={review.id} className={styles.card}>
                      <div className={styles.cardHead}>
                        <div className={styles.metaRow}>
                          <Link href={`/products/${review.productSlug}`} className={styles.productLink}>
                            {review.productName}
                          </Link>
                          <span>·</span>
                          <strong>{review.rating}/5 sao</strong>
                          <span>·</span>
                          <span>{review.customerName}</span>
                          <span>({review.customerEmail})</span>
                          <span>·</span>
                          <span>{formatDate(review.createdAt)}</span>
                        </div>
                        <span className={styles.statusPill} data-status={review.status}>
                          {reviewStatusLabels[review.status]}
                        </span>
                      </div>

                      <p className={styles.comment}>{review.comment}</p>

                      <div className={styles.replyArea}>
                        <label htmlFor={`reply-${review.id}`}>Phản hồi từ AUREL (tùy chọn)</label>
                        <textarea
                          id={`reply-${review.id}`}
                          value={replyValue}
                          maxLength={1000}
                          onChange={event =>
                            setDraftReplies(prev => ({ ...prev, [review.id]: event.target.value }))
                          }
                          placeholder="Nhập lời cảm ơn hoặc giải đáp cho khách hàng..."
                        />
                      </div>

                      <div className={styles.actions}>
                        <button type="button" className={styles.btnHide} disabled={busy} onClick={() => void handleDelete(review)}>Xóa đánh giá</button>
                        <button
                          type="button"
                          className={styles.btnApprove}
                          disabled={busy || review.status === "APPROVED"}
                          onClick={() => void handleModeration(review, { status: "APPROVED" })}
                        >
                          Duyệt hiển thị
                        </button>
                        <button
                          type="button"
                          className={styles.btnHide}
                          disabled={busy || review.status === "HIDDEN"}
                          onClick={() => void handleModeration(review, { status: "HIDDEN" })}
                        >
                          Ẩn đánh giá
                        </button>
                        <button
                          type="button"
                          className={styles.btnReply}
                          disabled={busy}
                          onClick={() => void handleModeration(review, { adminReply: replyValue })}
                        >
                          Lưu phản hồi
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
