"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./product-reviews.module.css";

type CommentsData = { signedIn: boolean; comments: { id: number; authorName: string; comment: string; createdAt: string; canDelete: boolean }[] };

export function ProductComments({ productSlug }: { productSlug: string }) {
  const [data, setData] = useState<CommentsData | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/product-comments?productSlug=${encodeURIComponent(productSlug)}`, { cache: "no-store", signal });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Không thể tải bình luận.");
    return json.data as CommentsData;
  }, [productSlug]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => { if (!controller.signal.aborted) setData(data); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [load]);
  async function mutate(method: "POST" | "DELETE", body: object) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/product-comments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể lưu bình luận.");
      if (method === "POST") setComment("");
      setData(await load());
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void mutate("POST", { productSlug, comment }); }
  return <div className={styles.list}>
    <h3>Bình luận sản phẩm</h3>
    <p className={styles.panelHint}>Mọi tài khoản đều có thể bình luận. Bình luận hiển thị ngay; shop có quyền xóa nội dung không phù hợp.</p>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); void load().then(setData).catch(error => setError(error.message)); }}>Thử tải lại</button></p>}
    {!data && !error && <p role="status">Đang tải bình luận...</p>}
    {data && (data.signedIn ? <form onSubmit={submit} className={styles.form}>
      <div className={styles.textareaWrap}><label htmlFor={id}>Viết bình luận</label><textarea id={id} value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} required disabled={busy} /></div>
      <button type="submit" className={styles.submitBtn} disabled={busy || !comment.trim()}>{busy ? "Đang xử lý..." : "Gửi bình luận"}</button>
    </form> : <Link href={`/login?next=${encodeURIComponent(`/products/${productSlug}`)}`}>Đăng nhập để bình luận</Link>)}
    {data?.comments.length === 0 && <p className={styles.emptyList}>Chưa có bình luận. Hãy là người đầu tiên chia sẻ.</p>}
    {data?.comments.map(item => <article key={item.id} className={styles.threadItem}>
      <div className={styles.commentHeader}><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</time></div>
      <p className={styles.commentText}>{item.comment}</p>
      {item.canDelete && <button type="button" className={styles.actionBtn} disabled={busy} onClick={() => { if (window.confirm("Xóa bình luận này?")) void mutate("DELETE", { commentId: item.id }); }}>Xóa bình luận</button>}
    </article>)}
  </div>;
}
