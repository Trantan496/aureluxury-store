"use client";
import { useState } from "react";
import { selectDetailVariant, formatDetailPrice, type DetailVariant } from "@/features/catalog/product-detail";
import styles from "./product-detail.module.css";

export function VariantSelection({ variants }: { variants: readonly DetailVariant[] }) {
  const [selectedId, setSelectedId] = useState(() => selectDetailVariant(variants)?.id);
  const selected = selectDetailVariant(variants, selectedId);
  const colors = [...new Set(variants.map(variant => variant.color))];
  const sizes = [...new Set(variants.map(variant => variant.size))];
  function choose(change: { color?: string; size?: string }) { setSelectedId(selectDetailVariant(variants, selectedId, change)?.id); }
  return <div className={styles.selection}>
    {selected ? <>
      <fieldset><legend>Màu sắc: {selected.color}</legend><div className={styles.choices}>{colors.map(color => <button type="button" key={color} className={styles.choice} aria-pressed={selected.color === color} onClick={() => choose({ color })}>{color}</button>)}</div></fieldset>
      <fieldset><legend>Kích cỡ: {selected.size}</legend><div className={styles.choices}>{sizes.map(size => <button type="button" key={size} className={styles.choice} aria-pressed={selected.size === size} disabled={!variants.some(variant => variant.color === selected.color && variant.size === size)} onClick={() => choose({ size })}>{size}</button>)}</div></fieldset>
      <div aria-live="polite" aria-atomic="true">
        <p className={styles.price}>{selected.price ? formatDetailPrice(selected.price) : "Giá chưa khả dụng"}</p>
        {!selected.price && <p className={styles.note}>Giá bán sẽ hiển thị khi được thiết lập theo loại tiền xác định.</p>}
        <p className={styles.stock}>{selected.stock > 0 ? `Còn hàng · ${selected.stock} sản phẩm` : selected.stock === 0 ? "Hết hàng" : "Chưa có thông tin tồn kho hợp lệ"}</p>
        <p className={styles.sku}>SKU: {selected.sku}</p>
      </div>
    </> : <p className={styles.note} role="status">Sản phẩm chưa có biến thể đang hoạt động.</p>}
    <div><button type="button" className={styles.purchase} disabled aria-describedby="purchase-note">Thêm vào giỏ — Chưa khả dụng</button><p id="purchase-note" className={styles.note}>Chức năng mua hàng đang được chuẩn bị. Chưa có sản phẩm nào được thêm vào giỏ.</p></div>
  </div>;
}
