"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WishlistProduct } from "@/features/wishlist/products";
import { ArrowRightIcon, HeartIcon, ShoppingBagIcon } from "@/components/account/account-icons";
import styles from "./wishlist.module.css";

type Notice = { kind: "ok" | "error"; text: string };

function EmptyIllustration() {
  return <svg className={styles.illustration} viewBox="0 0 120 96" fill="none" aria-hidden="true" focusable="false">
    <path d="M14 66c10-9 30-12 52-11 20 1 33 5 42 11-8 8-24 12-46 12-22 0-38-4-48-12Z" fill="#E8DACB" opacity=".7"/>
    <path d="M60 68C38 52 30 44 30 34a15 15 0 0 1 28-7l2 3 2-3a15 15 0 0 1 28 7c0 10-8 18-30 34Z" fill="#FBF6F0" stroke="#68452F" strokeWidth="2.4" strokeLinejoin="round" transform="translate(0 -4)"/>
    <path d="M86 12l-3 8M95 17l-6 5M99 28l-8 1" stroke="#68452F" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

function Tile({ product, saved, pending, onToggle }: { product: WishlistProduct; saved: boolean; pending: boolean; onToggle: (product: WishlistProduct) => void }) {
  return <li className={styles.tile}>
    <Link href={product.href} className={styles.media} aria-label={`Xem ${product.name}`} tabIndex={-1}>
      {product.imageUrl ? <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="(min-width: 1024px) 22vw, 46vw" unoptimized={product.imageUrl.startsWith("/images/uploads/")}/> : <span className={styles.noImage} aria-hidden="true"><HeartIcon/></span>}
    </Link>
    <Link href={product.href} className={styles.name}>{product.name}</Link>
    <div className={styles.row}>
      <p className={styles.price}>{product.price ?? "Giá chưa khả dụng"}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.heart} aria-pressed={saved} aria-busy={pending} disabled={pending} aria-label={saved ? `Bỏ ${product.name} khỏi yêu thích` : `Lưu ${product.name} vào yêu thích`} onClick={() => onToggle(product)}><HeartIcon/></button>
        {product.inStock
          ? <Link href={product.href} className={styles.bag} aria-label={`Chọn tùy chọn ${product.name} để thêm vào giỏ`}><ShoppingBagIcon/></Link>
          : <span className={styles.soldOut}>Hết hàng</span>}
      </div>
    </div>
  </li>;
}

export function WishlistView({ initialFavorites, recommendations, isAuthenticated = true }: { initialFavorites: WishlistProduct[]; recommendations: WishlistProduct[]; isAuthenticated?: boolean }) {
  const [items, setItems] = useState(initialFavorites);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const lock = useRef(new Set<string>());
  const saved = new Set(items.map(item => item.slug));

  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function toggle(product: WishlistProduct) {
    if (!isAuthenticated) {
      setNotice({ kind: "error", text: "Vui lòng đăng nhập để lưu sản phẩm yêu thích." });
      return;
    }
    if (lock.current.has(product.slug)) return;
    lock.current.add(product.slug); setPending(new Set(lock.current)); setNotice(null);
    const wasSaved = items.some(item => item.slug === product.slug);
    const index = items.findIndex(item => item.slug === product.slug);
    setItems(current => wasSaved ? current.filter(item => item.slug !== product.slug) : [product, ...current]);
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wasSaved ? { action: "favorite", slug: product.slug, remove: true } : { action: "favorite", slug: product.slug }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Không thể cập nhật yêu thích.");
      setNotice({ kind: "ok", text: wasSaved ? "Đã bỏ khỏi danh sách yêu thích." : "Đã lưu vào danh sách yêu thích." });
    } catch (error) {
      setItems(current => wasSaved
        ? (current.some(item => item.slug === product.slug) ? current : [...current.slice(0, index), product, ...current.slice(index)])
        : current.filter(item => item.slug !== product.slug));
      setNotice({ kind: "error", text: (error as Error).message });
    } finally { lock.current.delete(product.slug); setPending(new Set(lock.current)); }
  }

  return <div className={styles.content}>
    <p className={notice ? (notice.kind === "ok" ? styles.noticeOk : styles.noticeError) : styles.noticeHidden} role={notice?.kind === "error" ? "alert" : "status"}>{notice?.text}</p>
    {items.length === 0
      ? <section className={styles.empty} aria-labelledby="wishlist-empty-title">
          <EmptyIllustration/>
          <h2 id="wishlist-empty-title">Bạn chưa có sản phẩm yêu thích nào</h2>
          <p>Hãy lưu lại những sản phẩm bạn yêu thích để dễ dàng theo dõi và mua sắm sau nhé.</p>
          <Link href="/products" className={styles.cta}>Tiếp tục mua sắm<ArrowRightIcon/></Link>
        </section>
      : <section aria-label="Sản phẩm đã lưu">
          <ul className={styles.grid}>{items.map(item => <Tile key={item.slug} product={item} saved pending={pending.has(item.slug)} onToggle={toggle}/>)}</ul>
        </section>}
    {recommendations.length > 0 && <section className={styles.recommend} aria-labelledby="wishlist-recommend-title">
      <div className={styles.recommendHead}>
        <h2 id="wishlist-recommend-title">Có thể bạn sẽ thích</h2>
        <Link href="/products">Xem thêm<ArrowRightIcon/></Link>
      </div>
      <ul className={styles.grid}>{recommendations.map(item => <Tile key={item.slug} product={item} saved={saved.has(item.slug)} pending={pending.has(item.slug)} onToggle={toggle}/>)}</ul>
    </section>}
  </div>;
}

