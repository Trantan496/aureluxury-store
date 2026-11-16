"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./editorial.module.css";

export function EditorialImage({ src, alt, sizes, label = "AUREL", tone = 0 }: {
  src: string | null; alt: string; sizes: string; label?: string; tone?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const available = src && src !== failed;
  return <div className={styles.imageSurface} data-tone={tone % 4}>
    {available ? <Image src={src} unoptimized={src.startsWith("/images/uploads/")} alt={alt} fill sizes={sizes} onError={() => setFailed(src)} className={styles.image} />
      : <div className={styles.placeholder} role="img" aria-label={`${alt} — image forthcoming`}>
        <span className={styles.placeholderMark} aria-hidden="true">{label}</span>
        <span className={styles.placeholderNote}>IMAGE FORTHCOMING</span>
      </div>}
  </div>;
}
