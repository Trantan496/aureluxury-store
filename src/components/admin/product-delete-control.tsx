"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ManagementDTO } from "@/features/products/management";
import { adminRequest } from "./admin-client";
import styles from "./products.module.css";

type DeleteResult = { deleted: true; id: number; slug: string; auditCompletionRecorded: boolean };

export function ProductDeleteControl({ id, productCode, isActive }: { id: number; productCode: string | null; isActive: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams();
  const [current, setCurrent] = useState<ManagementDTO | null>(null);
  const [confirmation, setConfirmation] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");

  async function open() {
    setBusy(true); setMessage(""); setConfirmation(""); setCurrent(null);
    dialog.current?.showModal();
    try { setCurrent(await adminRequest<ManagementDTO>({ operation: "get", id })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải thông tin sản phẩm."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!current || confirmation !== current.productCode) return;
    setBusy(true); setMessage("");
    try {
      const result = await adminRequest<DeleteResult>({ operation: "delete", id: current.id, version: current.version, confirmation });
      const next = new URLSearchParams(searchParams.toString());
      next.set("deleted", "1");
      if (!result.auditCompletionRecorded) next.set("audit", "pending"); else next.delete("audit");
      dialog.current?.close();
      router.replace(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa sản phẩm.");
    } finally { setBusy(false); }
  }

  if (isActive) return <span className={styles.deleteHint}>Lưu trữ trước khi xóa</span>;
  if (!productCode) return <span className={styles.deleteHint}>Thiếu mã xác nhận</span>;
  return <div className={styles.deleteControl}><button type="button" onClick={() => void open()}>Xóa</button><dialog ref={dialog} className={styles.deleteDialog} aria-labelledby={`delete-product-${id}`} onCancel={event => { if (busy) event.preventDefault(); else setMessage(""); }}><h2 id={`delete-product-${id}`}>Xóa vĩnh viễn sản phẩm?</h2><p>Thao tác này xóa sản phẩm và các biến thể, giá, ảnh metadata đã gắn. Áp dụng chỉ khi không còn đơn hàng, giỏ hàng hoặc liên kết khác.</p>{current ? <><p>Nhập đúng mã <strong>{current.productCode}</strong> để xác nhận.</p><label>Mã xác nhận<input autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></label></> : <p role="status">{busy ? "Đang tải thông tin sản phẩm…" : "Chưa có thông tin để xác nhận."}</p>}{message && <p role="alert" className={styles.error}>{message}</p>}<div className={styles.deleteDialogActions}><button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Hủy</button><button type="button" className={styles.deleteConfirm} disabled={busy || !current?.productCode || confirmation !== current.productCode} onClick={() => void remove()}>{busy ? "Đang xóa…" : "Xóa vĩnh viễn"}</button></div></dialog></div>;
}
