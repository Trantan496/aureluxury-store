"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagementDTO } from "@/features/products/management";
import { showroomProduct } from "@/features/products/showroom-model";
import type { GalleryRole } from "@/features/products/gallery";
import type { DetailRelated } from "@/lib/product-related";
import { currencies, type Currency } from "@/features/money/money";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { adminRequest, adminFieldLabels } from "./admin-client";
import styles from "@/components/products/product-detail.module.css";
export function ProductShowroom({ initial, related, currencyEnabled }: { initial: ManagementDTO; related: DetailRelated; currencyEnabled: boolean }) {
  const [row,setRow] = useState(initial), [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [error,setError] = useState(false), [publish,setPublish] = useState(initial.isActive), [selectedCurrency,setSelectedCurrency] = useState<Currency>("VND");
  const [deleteCode,setDeleteCode] = useState("");
  const [uploadingRole,setUploadingRole] = useState<GalleryRole>();
  const lock = useRef(false), router = useRouter();
  const product = showroomProduct({...row,variantColors:row.variantColors??initial.variantColors},selectedCurrency,currencyEnabled,true);
  async function task(work: () => Promise<ManagementDTO>, success: string) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setMessage(""); setError(false);
    try { const saved = await work(); setRow(saved); setMessage(success); return true; }
    catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "Không thể hoàn tất thao tác. Ảnh cũ được giữ nguyên."); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function gallery(input: Record<string,unknown>, file?: File) {
    return task(async () => {
      if (file && (!file.size || file.size > 8*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(file.type))) throw new Error("Chọn JPG, PNG hoặc WebP tối đa 8 MB.");
      const response = await fetch(`/api/admin/products/${row.id}/gallery`, { method: "POST", credentials: "same-origin", headers: file ? { "Content-Type": file.type, "x-product-version": row.version, "x-image-role": String(input.role), ...(input.imageId ? { "x-image-id": String(input.imageId) } : {}) } : { "Content-Type": "application/json" }, body: file ?? JSON.stringify({ version: row.version, input }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error?.code === "CONFLICT" ? "Sản phẩm đã thay đổi hoặc đang xuất bản. Lưu nháp hay tải lại trước khi sửa ảnh." : `Không thể lưu ảnh${result.error?.field ? ` (${adminFieldLabels[result.error.field] ?? result.error.field})` : ""}. Ảnh cũ được giữ nguyên.`);
      return result.data;
    },"Đã lưu ảnh và bố cục.");
  }
  async function save(draft: boolean) {
    const shouldPublish = !draft && publish;
    if (shouldPublish && !window.confirm("Xuất bản sản phẩm này để khách hàng xem trên website?")) return;
    const ok = await task(() => adminRequest<ManagementDTO>({ operation: "finalize", id: row.id, version: row.version, input: { draft, publish: shouldPublish, confirmed: shouldPublish } }), draft ? "Đã lưu nháp. Sản phẩm chưa xuất bản." : shouldPublish ? "Đã lưu và xuất bản sản phẩm." : "Đã lưu sản phẩm ở trạng thái chưa xuất bản.");
    if (ok && draft) setPublish(false);
    router.refresh();
  }
  async function upload(role: GalleryRole,file: File,imageId?: string) {
    if (lock.current) return false;
    setUploadingRole(role);
    try { return await gallery({ operation:"upload",role,...(imageId ? { imageId:Number(imageId) } : {}) },file); }
    finally { setUploadingRole(undefined); }
  }
  return <>
    <div className={styles.previewToolbar}><Link href={`/admin/products/${row.id}`}>← Quay lại chỉnh sửa thông tin</Link><span className={row.isActive ? styles.publishedState : styles.draftState}>{row.isActive ? "Bản xem trước · Đang xuất bản" : "Bản xem trước · Chưa xuất bản"}</span>{row.isActive && <Link href={`/products/${row.slug}`} target="_blank" rel="noopener noreferrer">Xem trên website ↗</Link>}<label className={styles.publishSelect}>Khi lưu<select value={publish ? "publish" : "unpublished"} disabled={busy} onChange={e => setPublish(e.target.value === "publish")}><option value="unpublished">Chưa xuất bản</option><option value="publish">Xuất bản</option></select></label><button type="button" disabled={busy} onClick={() => void save(true)}>Lưu nháp</button><button type="button" disabled={busy} className={styles.primarySave} onClick={() => void save(false)}>Lưu sản phẩm</button></div>
    {(busy || message) && <div role={error ? "alert" : "status"} className={`${styles.previewStatus} ${error ? styles.previewError : ""}`}>{busy ? "Đang lưu…" : message}{error && <button type="button" disabled={busy} onClick={() => void task(() => adminRequest<ManagementDTO>({operation:"get",id:row.id}),"Đã tải lại dữ liệu được lưu.")}>Tải lại dữ liệu</button>}</div>}
    <p className={styles.previewStatus}>Bản xem trước dùng cùng bố cục với trang sản phẩm trên website. Chọn Xuất bản rồi Lưu sản phẩm để khách xem; nút Xem trên website mở trang có giỏ hàng, mua ngay và yêu thích.{row.isActive && " Chọn Lưu nháp trước khi thay đổi ảnh của sản phẩm đang xuất bản."}</p>
    <ProductDetailView product={product} mode="preview" related={related} editor={row.isActive ? undefined : { busy, uploadingRole, upload, action: gallery }} currencyControl={currencyEnabled ? <label className={styles.previewCurrency}>Loại tiền<select value={selectedCurrency ?? ""} onChange={e => setSelectedCurrency(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label> : undefined}/>
    <details className={styles.productDelete}><summary>Xóa sản phẩm</summary><label>Nhập mã sản phẩm để xác nhận<input value={deleteCode} onChange={e => setDeleteCode(e.target.value)} autoComplete="off"/></label><button type="button" disabled={busy || row.isActive || !row.productCode || deleteCode !== row.productCode} onClick={() => { if (!window.confirm("Xóa vĩnh viễn sản phẩm này?")) return; void task(async () => { await adminRequest({ operation:"delete",id:row.id,version:row.version,confirmation:deleteCode }); router.replace("/admin/products"); return row; },"Đã xóa sản phẩm."); }}>Xóa vĩnh viễn</button></details>
  </>;
}
