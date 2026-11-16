"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AdminIcon } from "./admin-icon";
import styles from "./products.module.css";
export type StoredImage = { id: string; storageKey: string; width: number; height: number; byteSize: number };
type Library = { page: number; total: number; rows: StoredImage[] };
export async function uploadProductImage(file: File): Promise<StoredImage> {
  if (!file.size || file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Chọn ảnh JPG, PNG hoặc WebP, tối đa 8 MB/ảnh.");
  const response = await fetch("/api/admin/images", { method: "POST", body: file, headers: { "Content-Type": file.type }, credentials: "same-origin" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Không tải được ảnh. Kiểm tra định dạng, kích thước hoặc đăng nhập lại.");
  return result.data;
}
export function ImageStorage({ disabled, onUpload, onSelect, libraryOnly = false }: { disabled: boolean; onUpload: (files: File[]) => void; onSelect: (image: StoredImage) => void; libraryOnly?: boolean }) {
  const input = useRef<HTMLInputElement>(null), requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(libraryOnly);
  const [library, setLibrary] = useState<Library | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const load = useCallback(async (page = 1) => {
    const request = ++requestId.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/images?page=${page}&q=${encodeURIComponent(query.trim())}`, { credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error();
      if (request === requestId.current) setLibrary(result.data);
    } catch { if (request === requestId.current) setError("Không tải được kho ảnh. Vui lòng thử lại."); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [query]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [open, load]);
  return <>
    {!libraryOnly && <><input ref={input} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" multiple tabIndex={-1} aria-label="Chọn ảnh từ máy" disabled={disabled} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) { setLibrary(null); onUpload(files); } }}/><button type="button" className={styles.addImage} title="JPG, PNG, WebP · Tối đa 8 MB/ảnh" disabled={disabled} onClick={() => input.current?.click()}><AdminIcon name="plus"/><span>Thêm ảnh</span></button></>}
    <details open={libraryOnly || undefined} className={styles.storagePanel} onToggle={e => setOpen(e.currentTarget.open)}><summary><AdminIcon name="folder"/>Kho ảnh</summary>
      <div className={styles.storageSearch}><input type="search" aria-label="Tìm ảnh theo tên sản phẩm" placeholder="Nhập tên sản phẩm…" maxLength={200} value={query} onChange={e => { requestId.current++; setQuery(e.target.value); setLibrary(null); setError(""); setLoading(false); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void load(); } }}/><button type="button" className={styles.subtle} disabled={loading} onClick={() => void load()}>Tìm</button></div>
      <div className={styles.storageToolbar}><small>{library ? `${library.total} ảnh đã lưu` : "Ảnh đã tải lên"}</small><button type="button" className={styles.subtle} disabled={loading} onClick={() => void load(library?.page ?? 1)}>Làm mới</button></div>
      {loading && <p role="status" className={styles.muted}>Đang tải ảnh…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && library?.total === 0 && <p className={styles.muted}>Không có ảnh phù hợp.</p>}
      <div className={styles.storageGrid}>{library?.rows.map(image => <button key={image.id} type="button" disabled={disabled} onClick={() => onSelect(image)} aria-label={`Chọn ảnh ${image.width} × ${image.height}`}><Image src={image.storageKey} alt="" width={100} height={100} unoptimized/></button>)}</div>
      {library && library.total > 12 && <div className={styles.storageToolbar}><button type="button" className={styles.subtle} disabled={loading || library.page <= 1} onClick={() => void load(library.page - 1)}>Trước</button><small>Trang {library.page}</small><button type="button" className={styles.subtle} disabled={loading || library.page * 12 >= library.total} onClick={() => void load(library.page + 1)}>Sau</button></div>}
    </details>
  </>;
}
