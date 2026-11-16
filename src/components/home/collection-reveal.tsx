"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./collection.module.css";

export function CollectionReveal({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    const surface = panel.current;
    if (!host || !surface) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let active = true;
    const update = () => {
      frame = 0;
      if (motion.matches) {
        host.removeAttribute("data-motion");
        surface.style.removeProperty("--panel-inset");
        return;
      }
      const height = window.innerHeight;
      const top = surface.getBoundingClientRect().top;
      // The panel rises in normal scroll flow. Only its side mask changes;
      // text and cards never scale, and there is no React render on scroll.
      const progress = Math.min(1, Math.max(0, 1 - top / (height * .55)));
      surface.style.setProperty("--panel-inset", `${4 * (1 - progress)}%`);
      host.dataset.motion = "enabled";
    };
    const schedule = () => { if (active && !frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      if (active) schedule();
    });
    observer.observe(host);
    const headingObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          headingObserver.unobserve(entry.target);
        }
      }
    }, { threshold: .15 });
    host.querySelectorAll<HTMLElement>("[data-collection-heading]").forEach(heading => {
      if (heading.getBoundingClientRect().top >= window.innerHeight) {
        heading.dataset.visible = "false";
        headingObserver.observe(heading);
      }
    });
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      headingObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", update);
    };
  }, []);

  return <div ref={root} className={styles.sequence}>
    <div className={styles.heroStage}>{hero}</div>
    <div ref={panel} className={styles.surface}>{children}</div>
  </div>;
}
