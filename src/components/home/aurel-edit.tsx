"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { aurelLooks } from "@/features/editorial/content";
import { EditorialImage } from "./editorial-image";
import styles from "./aurel-edit.module.css";

const count = aurelLooks.length;

export function AurelEdit() {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const navigate = useRef<(index: number) => void>(() => {});
  const active = useRef(0);

  useEffect(() => {
    const host = root.current;
    const pin = scene.current;
    const view = viewport.current;
    const rail = track.current;
    if (!host || !pin || !view || !rail) return;
    const desktop = matchMedia("(min-width: 1100px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let measureFrame = 0;
    let travel = 0;
    let offsets: number[] = [];
    let pinned = false;
    let measured = false;
    let sceneHeight = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let readingSequence = false;
    let readingOffset = 0;
    let lastIndex = -1;
    const cards = Array.from(rail.children) as HTMLElement[];

    const update = () => {
      frame = 0;
      // A resize can dispatch scroll before ResizeObserver. Do not interpret
      // the browser's temporary scroll/snap adjustment as a new chosen look.
      if (measured && (viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight || desktop.matches !== pinned || Math.abs(rail.scrollWidth - view.clientWidth - travel) > 1)) {
        scheduleMeasure();
        return;
      }
      const bounds = host.getBoundingClientRect();
      readingSequence = bounds.top <= 64 && bounds.bottom > 64;
      readingOffset = Math.max(0, 64 - bounds.top);
      const position = pinned
        ? Math.min(travel, readingOffset)
        : view.scrollLeft;
      if (pinned) rail.style.transform = `translate3d(${-position}px, 0, 0)`;
      const ratio = travel > 0 ? position / travel : 0;
      let index = 0;
      let distance = Infinity;
      offsets.forEach((offset, i) => {
        const current = Math.abs(Math.min(travel, offset) - position);
        if (current < distance) { index = i; distance = current; }
      });
      active.current = index;
      if (progress.current) progress.current.style.transform = `scaleX(${ratio * .9 + .1})`;
      if (index !== lastIndex) {
        lastIndex = index;
        if (counter.current) counter.current.textContent = String(index + 1).padStart(2, "0");
        if (previous.current) previous.current.disabled = index === 0;
        if (next.current) next.current.disabled = index === count - 1;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => {
      measureFrame = 0;
      const wasPinned = pinned;
      const oldTravel = travel;
      const oldHeight = sceneHeight;
      const bounds = host.getBoundingClientRect();
      const documentTop = window.scrollY + bounds.top;
      const withinSequence = readingSequence;
      const oldReadingOffset = readingOffset;
      const oldIndex = active.current;
      pinned = desktop.matches;
      host.dataset.pinned = String(pinned);
      travel = Math.max(0, rail.scrollWidth - view.clientWidth);
      offsets = cards.map(card => card.offsetLeft - cards[0].offsetLeft);
      sceneHeight = pin.offsetHeight;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      host.style.height = pinned ? `${sceneHeight + travel}px` : "auto";
      if (!pinned) rail.style.removeProperty("transform");
      const changed = wasPinned !== pinned || oldTravel !== travel || oldHeight !== sceneHeight;
      if (measured && changed) {
        const position = Math.min(travel, offsets[oldIndex] ?? 0);
        view.scrollLeft = pinned ? 0 : position;
        // Shrinking the tall pinned section must not strand the reader at the
        // footer. Preserve their position while they are inside this sequence.
        if (withinSequence) {
          const verticalOffset = pinned ? position : wasPinned ? 0 : Math.min(oldReadingOffset, Math.max(0, sceneHeight - 64));
          window.scrollTo({ top: documentTop - 64 + verticalOffset, behavior: "instant" });
        }
      }
      measured = true;
      update();
    };
    const scheduleMeasure = () => { if (!measureFrame) measureFrame = requestAnimationFrame(measure); };
    navigate.current = (requested: number) => {
      const index = Math.min(count - 1, Math.max(0, requested));
      const destination = Math.min(travel, offsets[index] ?? 0);
      const behavior = reduced.matches ? "instant" : "smooth";
      if (pinned) window.scrollTo({ top: window.scrollY + host.getBoundingClientRect().top - 64 + destination, behavior });
      else view.scrollTo({ left: destination, behavior });
    };
    // A keyboard user can Tab directly to any card link. Reveal that card
    // without changing focus or letting the overflow viewport scroll itself.
    const onFocus = (event: FocusEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>("[data-look]");
      if (!card || !pinned) return;
      const index = cards.indexOf(card);
      if (index < 0) return;
      const destination = Math.min(travel, offsets[index]);
      view.scrollLeft = 0;
      window.scrollTo({ top: window.scrollY + host.getBoundingClientRect().top - 64 + destination, behavior: "instant" });
      update();
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(view);
    observer.observe(rail);
    observer.observe(pin);
    cards.forEach(card => observer.observe(card));
    desktop.addEventListener("change", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", schedule, { passive: true });
    view.addEventListener("scroll", schedule, { passive: true });
    rail.addEventListener("focusin", onFocus);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      desktop.removeEventListener("change", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", schedule);
      view.removeEventListener("scroll", schedule);
      rail.removeEventListener("focusin", onFocus);
      host.style.removeProperty("height");
      rail.style.removeProperty("transform");
      delete host.dataset.pinned;
    };
  }, []);

  return <section ref={root} id="aurel-edit" className={styles.section} lang="en" aria-labelledby="edit-title">
    <div ref={scene} className={styles.scene}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>CURATED BY AUREL</p><h2 id="edit-title">THE AUREL EDIT</h2></div>
        <div className={styles.intro}><p>Considered outfits for a more intentional you.</p><span>{count} styling concepts · design preview</span></div>
      </header>
      <div ref={viewport} className={styles.viewport} id="aurel-lookbook" role="region" aria-roledescription="carousel" aria-label={`${count} curated looks`} tabIndex={0}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          const destination = event.key === "ArrowRight" ? active.current + 1 : event.key === "ArrowLeft" ? active.current - 1 : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
          if (destination !== null) { event.preventDefault(); navigate.current(destination); }
        }}>
        <div ref={track} className={styles.track}>
          {aurelLooks.map((look, index) => {
            const isLeadEdit = index < 6;
            return <article key={look.id} className={styles.look} data-look={look.id} aria-labelledby={`look-${look.id}`} aria-roledescription="slide" aria-label={`${look.number} of ${count}`}>
              <div className={styles.campaign}><EditorialImage src={look.image} alt={look.imageAlt} sizes="(min-width: 1100px) 48vw, 90vw" label={isLeadEdit ? undefined : `ÉDIT / ${String(look.number).padStart(2, "0")}`} tone={index}/></div>
              {isLeadEdit ? <div className={`${styles.copy} ${styles.leadCopy}`}>
                <div className={styles.leadMeta}><span>THE AUREL EDIT</span><i aria-hidden="true"/><span>EDIT {String(look.number).padStart(2, "0")}</span></div>
                <h3 id={`look-${look.id}`}>{look.title}</h3>
                <p className={styles.description}>{look.description}</p>
                <span className={styles.leadCta} aria-disabled="true" lang="vi">{look.number === count ? "Khám phá AUREL" : "Khám phá bài viết"} <span aria-hidden="true">↗</span></span>
              </div> : <div className={styles.copy}>
                <p className={styles.eyebrow}>LOOK {String(look.number).padStart(2, "0")} / {String(count).padStart(2, "0")}</p>
                <h3 id={`look-${look.id}`}>{look.title}</h3>
                <p className={styles.description}>{look.description}</p>
                <div className={styles.pieces}><p className={styles.eyebrow}>THE STYLING PALETTE</p><ul>{look.products.map(product => <li key={product.id}><Link href={product.href} aria-label={`Search ${product.name}`}>
                  <div className={styles.productImage}><EditorialImage src={product.image} alt={`${product.name} — design preview`} sizes="80px"/></div><span>{product.name}</span>
                </Link></li>)}</ul></div>
                <div className={styles.ctaArea}>{look.demo ? <><span className={styles.demoCta} aria-disabled="true">SHOP THE LOOK <span aria-hidden="true">↗</span></span><p>Styling concept · not available to purchase.</p><Link href={look.href}>Explore available pieces <span aria-hidden="true">↗</span></Link></> : <Link className={styles.demoCta} href={look.href}>SHOP THE LOOK <span aria-hidden="true">↗</span></Link>}</div>
              </div>}
            </article>;
          })}
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.progressGroup}><p aria-live="polite" aria-atomic="true"><span ref={counter}>01</span><span className={styles.total}> / {String(count).padStart(2, "0")}</span></p><div className={styles.progressTrack} aria-hidden="true"><div ref={progress}/></div></div>
        <p className={styles.scrollHint}><span className={styles.desktopHint}>SCROLL TO EXPLORE</span><span className={styles.mobileHint}>SWIPE TO EXPLORE</span></p>
        <div className={styles.buttons}><button ref={previous} type="button" aria-label="Previous look" aria-controls="aurel-lookbook" disabled onClick={() => navigate.current(active.current - 1)}>←</button><button ref={next} type="button" aria-label="Next look" aria-controls="aurel-lookbook" onClick={() => navigate.current(active.current + 1)}>→</button></div>
      </div>
    </div>
  </section>;
}
