"use client";
import Image from "next/image";
import { useState } from "react";
import type { ProductDetail } from "@/features/catalog/product-detail";
import styles from "./product-detail.module.css";

export function ProductGallery({ images, name }: { images: ProductDetail["images"]; name: string }) {
  const [selected, setSelected] = useState(images[0]?.id);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const active = images.find(image => image.id === selected) ?? images[0];
  return <div className={styles.gallery}>
    <div className={styles.mainImage}>
      {active && !failed.includes(active.id) ? <Image key={active.id} src={active.url} unoptimized={active.url.startsWith("/images/uploads/")} alt={active.alt || name} fill sizes="(min-width: 901px) 52vw, (min-width: 701px) 50vw, 100vw" className={styles.image} preload onError={() => setFailed(previous => [...previous, active.id])}/>
        : <p className={styles.placeholder} role="status">{active ? "Ảnh sản phẩm hiện không tải được. Bạn có thể chọn ảnh khác nếu có." : "Sản phẩm chưa có hình ảnh công khai."}</p>}
    </div>
    {images.length > 1 && <ul className={styles.thumbnails} aria-label="Hình ảnh sản phẩm">{images.map((image, index) => <li key={image.id}>
      <button type="button" className={styles.thumbnail} aria-label={`Xem ảnh ${index + 1} của ${name}`} aria-pressed={active?.id === image.id} onClick={() => setSelected(image.id)}>
        <Image src={image.url} unoptimized={image.url.startsWith("/images/uploads/")} alt="" fill sizes="64px" className={styles.image}/>
      </button>
    </li>)}</ul>}
  </div>;
}
