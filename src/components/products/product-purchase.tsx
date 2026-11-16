"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { DetailVariant } from "@/features/catalog/product-detail";
import styles from "./product-detail.module.css";

export function ProductPurchase({ slug, selected }: { slug: string; selected: DetailVariant | null }) {
  const router = useRouter(), statusId = useId(), lock = useRef(false);
  const [busy, setBusy] = useState<"bag" | "buy" | "favorite" | null>(null);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<{ text: string; variantId?: string; login: boolean; error: boolean } | null>(null);
  const unavailable = !selected ? "Chưa có biến thể để đặt mua." : selected.isActive === false ? "Biến thể này chưa được mở bán." : selected.stock <= 0 ? "Biến thể này đã hết hàng. Hãy chọn màu hoặc size khác." : !selected.price ? "Giá của biến thể này chưa khả dụng." : selected.price.currency !== "VND" ? "Đặt hàng hiện hỗ trợ VND. Hãy chuyển sang giá VND để mua." : "";
  const productHref = `/products/${slug}${selected ? `?variant=${encodeURIComponent(selected.id)}` : ""}`;
  const visibleNotice = notice?.variantId === selected?.id ? notice : null;

  async function act(action: "bag" | "buy" | "favorite") {
    if (lock.current || (action !== "favorite" && unavailable)) return;
    const variantId = selected?.id;
    lock.current = true; setBusy(action); setNotice(null);
    try {
      if (action === "buy") {
        router.push(`/checkout?variantId=${encodeURIComponent(String(variantId))}`);
        return;
      }
      const body = action === "favorite" ? { action: "favorite", slug } : { action: "cart", variantId: Number(variantId), quantity: 1, add: true };
      const response = await fetch("/api/shop", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ text: result.error ?? "Không thể hoàn tất. Vui lòng thử lại.", variantId, login: response.status === 401, error: true });
        return;
      }
      if (action === "favorite") setSaved(true);
      setNotice({ text: action === "favorite" ? "Đã lưu sản phẩm vào danh sách yêu thích." : "Đã thêm đúng màu và size bạn chọn vào giỏ hàng.", variantId, login: false, error: false });
      router.refresh();
    } catch {
      setNotice({ text: "Chưa thể kết nối cửa hàng. Vui lòng thử lại.", variantId, login: false, error: true });
    } finally { lock.current = false; setBusy(null); }
  }

  return <div className={styles.purchaseArea} aria-busy={busy !== null}>
    <div className={styles.purchaseStack}>
      <button type="button" className={styles.addToBag} disabled={Boolean(unavailable) || busy !== null} aria-label="Thêm màu và size đã chọn vào giỏ hàng" aria-describedby={statusId} onClick={() => void act("bag")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h16v13H4zM8 8V6a4 4 0 0 1 8 0v2"/></svg>{busy === "bag" ? "ADDING…" : "ADD TO BAG"}</button>
      <button type="button" className={styles.buyNow} disabled={Boolean(unavailable) || busy !== null} aria-label="Thêm sản phẩm đã chọn và đến trang đặt hàng COD" aria-describedby={statusId} onClick={() => void act("buy")}>{busy === "buy" ? "ĐANG CHUYỂN ĐẾN ĐẶT HÀNG…" : "BUY NOW"}</button>
    </div>
    <div className={styles.purchaseLinks}><button type="button" disabled={busy !== null || saved} onClick={() => void act("favorite")}><svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6Z"/></svg>{busy === "favorite" ? "Đang lưu…" : saved ? "Đã lưu yêu thích" : "Lưu yêu thích"}</button><Link href="/cart">Xem giỏ hàng</Link><Link href="/favorites">Danh sách yêu thích</Link></div>
    <div id={statusId} className={styles.purchaseFeedback}>
      {unavailable && <p className={styles.note}>{unavailable}</p>}
      {visibleNotice && <p role={visibleNotice.error ? "alert" : "status"} className={styles.note}>{visibleNotice.text}{visibleNotice.login && <> <Link href={`/login?next=${encodeURIComponent(productHref)}`}>Đăng nhập để tiếp tục</Link></>}</p>}
    </div>
  </div>;
}
