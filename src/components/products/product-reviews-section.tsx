"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { PublicProductReviewsPayload } from "@/features/reviews/types";
import type { DiscussionItem, DiscussionPayload } from "@/features/reviews/discussion-types";
import styles from "./product-reviews.module.css";

const starPath = "m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-1Z";
function Icon({ name }: { name: "image" | "like" | "reply" | "bag" | "check" | "more" | "star" }) {
  const paths = { image: "M4 4h12v4m4 4v8H4V4m10 16-7-7-3 4m6-1 4-5 6 7M19 2v6m-3-3h6", like: "M7 10v11H3V10h4Zm0 1 5-9c3 0 2 5 1 7h6c2 0 2 1 2 3l-2 7c0 1-1 2-3 2H7", reply: "M21 11a9 8 0 0 1-9 8H9l-6 3 2-6a8 8 0 0 1-2-5 9 8 0 0 1 18 0Z", bag: "M5 7h14l2 14H3L5 7Zm3 1V6a4 4 0 0 1 8 0v2", check: "m5 12 4 4L19 6", more: "M4 12h.01M12 12h.01M20 12h.01", star: starPath };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 4 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function StarDisplay({ rating }: { rating: number }) {
  return <span className={styles.starsRow} role="img" aria-label={`${rating} trên 5 sao`}>{[0, 1, 2, 3, 4].map(index => <span className={styles.star} key={index}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d={starPath} /></svg><span style={{ width: `${Math.min(1, Math.max(0, rating - index)) * 100}%` }}><svg viewBox="0 0 24 24" fill="currentColor"><path d={starPath} /></svg></span></span>)}</span>;
}
function Avatar({ name, official = false }: { name: string; official?: boolean }) {
  return <span className={styles.avatar} aria-hidden="true">{official ? <Image src="/images/aurel/aurel-logo.webp" width={44} height={44} alt="" /> : name.trim().split(/\s+/).slice(-2).map(word => word[0]).join("").toUpperCase() || "A"}</span>;
}
function dateLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value)); }

function Composer({ name, canRate, busy, onSend, replyTo, onCancel, ratingHint }: { name: string; canRate: boolean; busy: boolean; onSend: (text: string, rating: number | null, files: File[]) => Promise<void>; replyTo?: string; onCancel?: () => void; ratingHint?: string }) {
  const [text, setText] = useState(""), [rating, setRating] = useState<number | null>(null), [error, setError] = useState("");
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const inputId = useId(), textId = useId(), ratingHintId = useId(), previews = useRef(files);
  useEffect(() => { previews.current = files; }, [files]);
  useEffect(() => () => previews.current.forEach(item => URL.revokeObjectURL(item.url)), []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !text.trim()) return; setError("");
    try { await onSend(text.trim(), rating, files.map(item => item.file)); setText(""); setRating(null); files.forEach(item => URL.revokeObjectURL(item.url)); setFiles([]); }
    catch (error) { setError(error instanceof Error ? error.message : "Không thể gửi bình luận."); }
  }
  return <form className={styles.composer} onSubmit={submit}><Avatar name={name} /><div className={styles.composerBody}>
    {replyTo && <div className={styles.replyLabel}>Trả lời {replyTo} <button type="button" onClick={onCancel}>Hủy</button></div>}
    <div className={styles.inputShell}><label className={styles.srOnly} htmlFor={textId}>{replyTo ? "Viết phản hồi" : "Viết bình luận về sản phẩm"}</label><textarea id={textId} placeholder={replyTo ? "Viết phản hồi..." : "Viết bình luận về sản phẩm..."} value={text} onChange={event => setText(event.target.value)} maxLength={1000} required disabled={busy} rows={2} /><div className={styles.sendActions}>
      <label className={styles.attach} htmlFor={inputId} title="Tối đa 3 ảnh JPG, PNG, WebP; 4 MB/ảnh"><Icon name="image" /><span className={styles.srOnly}>Đính kèm hình ảnh</span></label>
      <input id={inputId} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => {
        const chosen = Array.from(event.target.files ?? []); event.target.value = "";
        if (files.length + chosen.length > 3 || chosen.some(file => file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Tối đa 3 ảnh JPG, PNG, WebP, mỗi ảnh không quá 4 MB."); return; }
        setError(""); setFiles([...files, ...chosen.map(file => ({ file, url: URL.createObjectURL(file) }))]);
      }} /><button className={styles.submitBtn} type="submit" disabled={busy || !text.trim()}>{busy ? "Đang gửi..." : replyTo ? "Gửi phản hồi" : rating !== null ? "Gửi đánh giá" : "Gửi bình luận"}</button>
    </div></div>
    {!replyTo && <><div className={styles.ratingPicker} role="group" aria-label="Chọn sao đánh giá" aria-describedby={!canRate ? ratingHintId : undefined}>{[1, 2, 3, 4, 5].map(score => <button key={score} type="button" disabled={busy || !canRate} aria-label={`${score} sao`} aria-pressed={rating === score} onClick={() => setRating(score)}><svg viewBox="0 0 24 24" fill={rating !== null && score <= rating ? "currentColor" : "none"} stroke="currentColor"><path d={starPath} /></svg></button>)}{rating && <button type="button" disabled={busy} onClick={() => setRating(null)}>Bỏ chọn</button>}</div>{!canRate && <p id={ratingHintId} className={styles.ratingHint}>{ratingHint}</p>}</>}
    {!!files.length && <div className={styles.previews}>{files.map((item, index) => <span key={item.url}><Image src={item.url} alt={`Ảnh đính kèm ${index + 1}`} width={70} height={70} unoptimized /><button type="button" disabled={busy} aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => { URL.revokeObjectURL(item.url); setFiles(files.filter((_, i) => i !== index)); }}>×</button></span>)}</div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div></form>;
}
function legacyData(data: PublicProductReviewsPayload): DiscussionPayload {
  return { viewer: null, canRate: false, ownReview: data.viewer.ownReview, summary: { average: data.summary?.average ?? null, count: data.summary?.count ?? 0, distribution: [1, 2, 3, 4, 5].map(score => data.reviews.filter(item => item.rating === score).length) }, total: data.reviews.length, hasMore: false, items: data.reviews.map(item => ({ ...item, parentId: null, rootId: item.id, depth: 0, reviewId: item.id, official: false, verified: true, liked: false, likeCount: 0, canDelete: !!item.isOwn, images: [] })) };
}
export function ProductReviewsSection({ productSlug, productName, initialData, initialDiscussion }: { productSlug: string; productName: string; initialData: PublicProductReviewsPayload; initialDiscussion?: DiscussionPayload }) {
  const [data, setData] = useState<DiscussionPayload>(initialDiscussion ?? legacyData(initialData));
  const [sort, setSort] = useState("newest"), [images, setImages] = useState(false), [five, setFive] = useState(false), [verified, setVerified] = useState(false), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!initialDiscussion && initialData.reviews.length === 0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [replyId, setReplyId] = useState<number | null>(null), [editing, setEditing] = useState(false), [editText, setEditText] = useState(""), [editRating, setEditRating] = useState(5);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null), generation = useRef(0);
  const loginHref = `/login?next=${encodeURIComponent(`/products/${productSlug}`)}`;
  const fetchFeed = useCallback(async (signal?: AbortSignal) => {
    const query = new URLSearchParams({ productSlug, sort, images: images ? "1" : "0", five: five ? "1" : "0", verified: verified ? "1" : "0", page: String(page) });
    const response = await fetch(`/api/product-discussion?${query}`, { cache: "no-store", signal }), json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Chưa thể tải bình luận.");
    return json.data as DiscussionPayload;
  }, [productSlug, sort, images, five, verified, page]);
  useEffect(() => {
    const controller = new AbortController(), current = ++generation.current;
    fetchFeed(controller.signal).then(payload => { if (!controller.signal.aborted && current === generation.current) { setData(payload); setError(""); setLoading(false); } }).catch(error => { if (!controller.signal.aborted) { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [fetchFeed]);
  useEffect(() => { if (lightbox && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, [lightbox]);
  async function refresh() {
    const current = ++generation.current, payload = await fetchFeed();
    if (current === generation.current) {
      setData(payload);
      window.dispatchEvent(new CustomEvent("aurel:product-rating", { detail: { productSlug, rating: payload.summary.average !== null ? { average: payload.summary.average, count: payload.summary.count } : null } }));
    }
  }
  async function send(text: string, rating: number | null, files: File[], parentId: number | null = null) {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = new FormData(); body.set("productSlug", productSlug); body.set("comment", text);
      if (rating) body.set("rating", String(rating)); if (parentId) body.set("parentId", String(parentId)); files.forEach(file => body.append("images", file));
      const response = await fetch("/api/product-discussion", { method: "POST", body }), json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể gửi bình luận.");
      setNotice(rating !== null ? "Đã gửi đánh giá." : "Đã gửi bình luận."); setReplyId(null);
      try { await refresh(); } catch { setError("Đã lưu nội dung, nhưng chưa tải được danh sách mới. Hãy thử tải lại."); }
    } finally { setBusy(false); }
  }
  async function action(item: DiscussionItem, kind: "like" | "delete" | "hide") {
    if (busy) return;
    if (!data.viewer) { setError("Vui lòng đăng nhập để thích hoặc trả lời."); return; }
    if (kind !== "like" && !window.confirm(kind === "delete" ? "Xóa nội dung này và các phản hồi bên dưới?" : "Ẩn nội dung này và các phản hồi bên dưới?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/product-discussion", { method: kind === "delete" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, action: kind, liked: !item.liked }) }), json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể cập nhật nội dung."); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
  }
  async function saveReview(event: FormEvent) {
    event.preventDefault(); if (!data.ownReview || busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: data.ownReview.id, rating: editRating, comment: editText }) }), json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể sửa đánh giá."); setEditing(false); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
  }
  async function deleteOwnReview() {
    if (!data.ownReview || busy || !window.confirm("Xóa đánh giá của bạn và các phản hồi bên dưới?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: data.ownReview.id }) }), json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể xóa đánh giá."); setEditing(false); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
  }
  function filter(change: () => void) { setLoading(true); setPage(1); setReplyId(null); change(); }
  function renderItem(item: DiscussionItem) {
    const children = data.items.filter(child => child.parentId === item.id);
    return <article key={item.id} className={`${styles.threadItem} ${item.official ? styles.officialThread : ""}`} data-depth={item.depth}><Avatar name={item.authorName} official={item.official} /><div className={styles.commentMain}>
      <div className={styles.commentHeader}><strong>{item.official ? "AUREL Official" : item.authorName}</strong>{item.official ? <span className={styles.badge}><Icon name="check" />Shop chính hãng</span> : item.verified && <span className={styles.badge}><Icon name="check" />Đã mua hàng</span>}<time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
        {(item.canDelete || data.viewer?.isAdmin) && <details className={styles.menu}><summary aria-label={`Tùy chọn bình luận của ${item.authorName}`}><Icon name="more" /></summary><div>
          {item.reviewId === data.ownReview?.id && <button type="button" disabled={busy} onClick={() => { setEditText(item.comment); setEditRating(item.rating ?? 5); setEditing(true); }}>Chỉnh sửa đánh giá</button>}
          {item.canDelete && <button type="button" disabled={busy} onClick={() => void action(item, "delete")}>Xóa nội dung</button>}
          {data.viewer?.isAdmin && <button type="button" disabled={busy} onClick={() => void action(item, "hide")}>Ẩn nội dung vi phạm</button>}
        </div></details>}
      </div>
      {item.rating !== null && <StarDisplay rating={item.rating} />}<p className={styles.commentText}>{item.comment}</p>
      {!!item.images.length && <div className={styles.photos}>{item.images.map((image, index) => <button key={image.id} type="button" aria-label={`Xem ảnh đính kèm ${index + 1}`} onClick={() => setLightbox(image.id)}><Image src={`/api/product-discussion/images/${image.id}`} alt={`Ảnh khách hàng đính kèm ${index + 1}`} width={image.width} height={image.height} unoptimized loading="lazy" /></button>)}</div>}
      <div className={styles.commentActions}><button type="button" disabled={busy} aria-pressed={item.liked} onClick={() => void action(item, "like")}><Icon name="like" />{item.liked ? "Đã thích" : "Thích"}{item.likeCount > 0 && <span>{item.likeCount}</span>}</button>{item.depth < 4 && <button type="button" disabled={busy} onClick={() => { if (!data.viewer) setError("Vui lòng đăng nhập để trả lời."); else setReplyId(replyId === item.id ? null : item.id); }}><Icon name="reply" />Trả lời</button>}</div>
      {replyId === item.id && data.viewer && <Composer key={item.id} name={data.viewer.name} busy={busy} canRate={false} replyTo={item.authorName} onCancel={() => setReplyId(null)} onSend={(text, rating, files) => send(text, rating, files, item.id)} />}
      {item.adminReply && <div className={styles.legacyReply}><Avatar name="AUREL" official /><div><div className={styles.commentHeader}><strong>AUREL Official</strong><span className={styles.badge}><Icon name="check" />Shop chính hãng</span></div><p className={styles.commentText}>{item.adminReply}</p>{item.adminRepliedAt && <time dateTime={item.adminRepliedAt}>{dateLabel(item.adminRepliedAt)}</time>}</div></div>}
      {!!children.length && <div className={styles.replies}>{children.map(renderItem)}</div>}
    </div></article>;
  }
  const roots = data.items.filter(item => item.parentId === null).sort((a, b) => sort === "oldest" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id : Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
  return <section className={styles.section} aria-labelledby="product-reviews-heading" aria-label={`Bình luận và đánh giá ${productName}`}>
    <header className={styles.header}><h2 id="product-reviews-heading" className={styles.heading}>Bình luận &amp; Đánh giá</h2><span className={styles.headingLine} />{data.summary.count > 0 && <span className={styles.headerScore}><strong>{data.summary.average?.toFixed(1)}</strong>/5</span>}</header>
    <div className={styles.ratingSummary}><div className={styles.scoreBlock}>{data.summary.average !== null ? <><div><strong>{data.summary.average.toFixed(1)}</strong><span>/5</span></div><StarDisplay rating={data.summary.average} /><p>{data.summary.count} đánh giá</p></> : <><span className={styles.noScore}>Chưa có đánh giá</span><StarDisplay rating={0} /></>}</div><div className={styles.histogram}>{[5, 4, 3, 2, 1].map(score => { const count = data.summary.distribution[score - 1] ?? 0, percent = data.summary.count ? Math.round(count / data.summary.count * 100) : 0; return <div className={styles.histogramRow} key={score}><span>{score} sao <span aria-hidden="true">★</span></span><span className={styles.track} role="meter" aria-label={`${score} sao`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${count} đánh giá, ${percent}%`}><span style={{ width: `${percent}%` }} /></span><span>{percent}% ({count})</span></div>; })}</div></div>
    {data.viewer ? <Composer name={data.viewer.name} canRate={data.canRate} busy={busy} ratingHint={data.ownReview ? "Bạn đã đánh giá sản phẩm này. Có thể chỉnh sửa bên dưới." : "Chưa thể tải quyền đánh giá. Vui lòng thử lại."} onSend={(text, rating, files) => send(text, rating, files)} /> : <div className={styles.guestComposer}><Avatar name="AUREL" /><span>Viết bình luận về sản phẩm...</span><Link href={loginHref}>Đăng nhập</Link></div>}
    {data.ownReview && <details className={styles.ownReview}><summary>Đánh giá của bạn · {data.ownReview.rating}/5 sao{data.ownReview.status !== "APPROVED" ? " · Chưa công khai" : ""}</summary><p>{data.ownReview.comment}</p><button type="button" disabled={busy} onClick={() => { setEditing(true); setEditText(data.ownReview!.comment); setEditRating(data.ownReview!.rating); }}>Chỉnh sửa đánh giá</button><button type="button" disabled={busy} onClick={() => void deleteOwnReview()}>Xóa đánh giá</button></details>}
    {editing && <form className={styles.editForm} onSubmit={saveReview}><label>Điểm đánh giá<select value={editRating} onChange={event => setEditRating(Number(event.target.value))}>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score} sao</option>)}</select></label><label>Nội dung đánh giá<textarea value={editText} onChange={event => setEditText(event.target.value)} maxLength={1000} required /></label><div><button type="button" onClick={() => setEditing(false)} disabled={busy}>Hủy</button><button type="submit" disabled={busy}>Lưu chỉnh sửa</button></div></form>}
    <div className={styles.filters} role="group" aria-label="Lọc bình luận"><label className={styles.sortLabel}><span className={styles.srOnly}>Sắp xếp bình luận</span><select value={sort} disabled={busy} onChange={event => filter(() => setSort(event.target.value))}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label><button type="button" disabled={busy} aria-pressed={images} onClick={() => filter(() => setImages(!images))}><Icon name="image" />Có hình ảnh</button><button type="button" disabled={busy} aria-pressed={five} onClick={() => filter(() => setFive(!five))}><Icon name="star" />5 sao</button><button type="button" disabled={busy} aria-pressed={verified} onClick={() => filter(() => setVerified(!verified))}><Icon name="bag" />Đã mua hàng</button></div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => { setLoading(true); refresh().then(() => setError("")).catch(error => setError(error.message)).finally(() => setLoading(false)); }}>Thử tải lại</button>{!data.viewer && <> · <Link href={loginHref}>Đăng nhập</Link></>}</p>}
    <div className={styles.list} aria-busy={loading}>{loading ? <p className={styles.emptyList} role="status">Đang tải...</p> : roots.length ? roots.map(renderItem) : <p className={styles.emptyList}>{images || five || verified ? "Không có kết quả phù hợp." : "Chưa có bình luận."}</p>}</div>
    {(page > 1 || data.hasMore) && <nav className={styles.pagination} aria-label="Trang bình luận"><button type="button" disabled={page === 1 || busy || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Trang trước</button><span>Trang {page}</span><button type="button" disabled={!data.hasMore || busy || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Trang sau</button></nav>}
    <dialog ref={dialogRef} className={styles.lightbox} onClose={() => setLightbox(null)} onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} aria-label="Ảnh khách hàng" data-lenis-prevent><button type="button" aria-label="Đóng ảnh" onClick={() => dialogRef.current?.close()}>×</button>{lightbox && <Image src={`/api/product-discussion/images/${lightbox}`} alt="Ảnh khách hàng đính kèm phóng lớn" width={1400} height={1400} unoptimized />}</dialog>
  </section>;
}
