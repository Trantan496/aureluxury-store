
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CollectionPiece } from "@/features/collection/preview";
import { matchesCollectionQuery } from "@/features/collection/search";
import styles from "./collection.module.css";

export function CollectionGrid({
  pieces,
  query = "",
}: {
  pieces: readonly CollectionPiece[];
  demo: boolean;
  query?: string;
}) {
  const [category, setCategory] = useState("all");
  const root = useRef<HTMLDivElement>(null);

  const visible = pieces.filter(
    (piece) =>
      (category === "all" || piece.category === category) &&
      matchesCollectionQuery(piece, query)
  );

  const canFilter = pieces.some((piece) => piece.category !== null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = "true";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 }
    );

    host.querySelectorAll<HTMLElement>("[data-piece]").forEach((card) => {
      const rect = card.getBoundingClientRect();
      // First-paint content is already at rest. Only reveal offscreen arrivals.
      if (rect.top >= window.innerHeight || rect.bottom <= 0) {
        card.dataset.animate = "true";
        card.dataset.visible = "false";
        observer.observe(card);
      }
    });

    return () => observer.disconnect();
  }, [category, query]);

  return (
    <div ref={root}>
      <div
        className={styles.tabs}
        role="group"
        aria-label="Filter collection"
      >
        {[
          ["all", "All Pieces"],
          ["clothing", "Clothing"],
          ["accessories", "Accessories"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            disabled={value !== "all" && !canFilter}
            onClick={() => setCategory(value)}
            aria-controls="collection-pieces"
          >
            {label}
          </button>
        ))}
      </div>

      <p className={styles.srOnly} role="status">
        {visible.length} pieces shown
      </p>

      <ul id="collection-pieces" className={styles.grid}>
        {visible.map((piece, index) => (
          <li
            key={piece.id}
            className={styles.card}
            data-piece
            style={
              {
                "--stagger": `calc(${index % 4} * var(--motion-stagger))`,
              } as CSSProperties
            }
          >
            <div className={styles.imageFrame}>
              {piece.href && <Link href={piece.href} className={styles.imageLink} aria-label={`Xem ${piece.name}`}/>}
              {piece.image && (
                <Image
                  src={piece.image}
                  unoptimized={piece.image.startsWith("/images/uploads/")}
                  alt={piece.imageAlt ?? piece.name}
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 900px) 29vw, 44vw"
                  className={styles.productImage}
                />
              )}
            </div>

            <div className={styles.details}>
              <h3>{piece.href ? <Link href={piece.href}>{piece.name}</Link> : piece.name}</h3>
              {piece.demoPrice && <p>{piece.demoPrice}</p>}
              {piece.price && <p>{piece.price}</p>}
            </div>
          </li>
        ))}
      </ul>

      {!visible.length && (
        <p className={styles.notice}>
          No pieces found. Try another keyword or category.
        </p>
      )}
    </div>
  );
}
