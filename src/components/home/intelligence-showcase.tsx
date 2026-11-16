"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./intelligence-showcase.module.css";

export function IntelligenceShowcase() {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const target = section.current;
    if (!target || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      target.dataset.reveal = "visible";
      observer.disconnect();
    }, { threshold: 0.12 });
    // Keep SSR/no-JS content visible; only prepare an offscreen section.
    if (target.getBoundingClientRect().top >= window.innerHeight) {
      target.dataset.reveal = "pending";
      observer.observe(target);
    }
    const reveal = () => {
      if (motion.matches) {
        target.dataset.reveal = "visible";
        observer.disconnect();
      }
    };
    motion.addEventListener("change", reveal);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", reveal);
    };
  }, []);

  return (
    <section ref={section} id="intelligence" className={styles.section} aria-labelledby="intelligence-title" lang="en">
      <div className={styles.composition}>
        <div className={styles.media}>
          <Image
            src="/images/aurel/intelligence-runway.webp"
            alt="Model walking down a golden-lit fashion runway"
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1824px) 54vw, 975px"
            quality={90}
            className={styles.image}
          />
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>Our latest AI innovation</p>
          <h2 id="intelligence-title" className={styles.heading}>STILL UNSURE<br /><span className={styles.headingAccent}>WHAT <strong className={styles.headingEmphasis}>SUITS YOU?</strong></span></h2>
          <p className={styles.description}>AUREL AI can help you choose what fits you best.</p>
          <Link className={styles.cta} href="/products">
            Discover your style
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
              <path d="M3 10h14M11 4l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
