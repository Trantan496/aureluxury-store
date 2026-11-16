"use client";
import { useEffect, useState } from "react";
import type { ProductRatingSummary } from "@/features/catalog/product-detail";
import styles from "./product-detail.module.css";
const starPath = "m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-1Z";
export function ProductRating({ rating: initialRating, preview = false, productSlug }: { rating?: ProductRatingSummary | null; preview?: boolean; productSlug?: string }) {
  const [update, setUpdate] = useState<{ productSlug: string; rating: ProductRatingSummary | null } | null>(null);
  useEffect(() => {
    function receive(event: Event) {
      const detail = (event as CustomEvent<{ productSlug: string; rating: ProductRatingSummary | null }>).detail;
      if (detail?.productSlug === productSlug) setUpdate(detail);
    }
    window.addEventListener("aurel:product-rating", receive);
    return () => window.removeEventListener("aurel:product-rating", receive);
  }, [productSlug]);
  const rating = update && update.productSlug === productSlug ? update.rating : initialRating;
  const actual = rating && Number.isFinite(rating.average) && rating.average >= 1 && rating.average <= 5 && Number.isSafeInteger(rating.count) && rating.count > 0 ? rating : null;
  if (!actual && !preview) return null;
  const { average, count } = actual ?? { average: 5, count: 1 };
  return <div className={styles.rating}>
    <span className={styles.ratingStars} role="img" aria-label={actual ? `${average} trên 5 sao` : "5 sao minh họa, không phải đánh giá khách hàng"}>{Array.from({ length: 5 }, (_, index) => <span key={index} className={styles.ratingStar} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d={starPath}/></svg><span style={{ width: `${Math.max(0, Math.min(1, average - index)) * 100}%` }}><svg viewBox="0 0 24 24" fill="currentColor"><path d={starPath}/></svg></span></span>)}</span>
    <span>{Number(average.toFixed(1))} <span>({count} {count === 1 ? "review" : "reviews"})</span></span>
    {!actual && <span className={styles.ratingDemo}>DEMO · Chưa có đánh giá thực</span>}
  </div>;
}
