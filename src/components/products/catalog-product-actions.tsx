"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./catalog-browser.module.css";

export function CatalogProductActions({ productName, slug, detailHref }: { productName: string; slug?: string; detailHref: string | null }) {
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);

  async function save() {
    if (!slug || lock.current || saved) return;
    lock.current = true;
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", slug }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Không thể lưu sản phẩm.");
      setSaved(true); setNotice("Đã lưu vào yêu thích.");
    } catch (error) { setNotice((error as Error).message); }
    finally { lock.current = false; }
  }

  return <><button type="button" className={styles.wishlistButton} aria-label={saved ? `${productName} đã lưu yêu thích` : `Lưu ${productName} vào yêu thích`} aria-pressed={saved} disabled={!slug || saved} onClick={() => void save()}><svg viewBox="0 0 24 24" aria-hidden="true" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.55"><path d="M20.7 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.7-8.6a5.4 5.4 0 0 0 0-7.7Z"/></svg></button>{detailHref && <Link href={detailHref} className={styles.bagButton} aria-label={`Chọn biến thể ${productName} để thêm vào giỏ`}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.55"><path d="M4 8h16v12H4zM8 8V6a4 4 0 0 1 8 0v2"/></svg></Link>}<span className={styles.actionStatus} role="status">{notice}</span></>;
}
