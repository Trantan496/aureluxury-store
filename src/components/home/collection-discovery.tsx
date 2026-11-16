"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CollectionPiece } from "@/features/collection/preview";
import { CollectionGrid } from "./collection-grid";
import styles from "./collection-search.module.css";

const suggestions = ["Minimalist everyday outfits", "Oversized neutral pieces", "What goes with wide-leg trousers?"];

export function CollectionDiscovery({ pieces, demo, children, error }: {
  pieces: readonly CollectionPiece[]; demo: boolean; children: ReactNode; error?: ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = section.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      target.dataset.visible = String(entry.isIntersecting);
    }, { threshold: .1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!demo) return; // The production /products route validates catalog queries server-side.
    event.preventDefault();
    const value = draft.trim();
    if (!value || value.length > 100) {
      setMessage("Enter a style, color or product name (up to 100 characters).");
      input.current?.focus();
      return;
    }
    setMessage("");
    setQuery(value);
  }

  function clear() {
    setDraft(""); setQuery(""); setMessage(""); input.current?.focus();
  }

  return <>
    <section ref={section} className={styles.search} aria-labelledby="discovery-title">
      <header className={styles.heading}>
        <h2 id="discovery-title">Find what feels like you.</h2>
        <p>Tell us what you&apos;re looking for. We&apos;ll help you discover your style.</p>
      </header>
      <form action="/products" method="get" role="search" aria-label="Fashion discovery" onSubmit={submit} className={styles.form}>
        <label htmlFor="discovery-query" className={styles.srOnly}>Describe your style, outfit, or occasion</label>
        <div className={styles.field}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input ref={input} id="discovery-query" name="q" type="search" maxLength={100} value={draft}
            onChange={event => { setDraft(event.target.value); setMessage(""); }}
            placeholder="Describe your style, outfit, or occasion..." aria-describedby="discovery-help discovery-message" aria-invalid={!!message}/>
          <button type="submit">Explore <span aria-hidden="true">→</span></button>
        </div>
        <div className={styles.suggestions} aria-label="Suggested searches">
          {suggestions.map(suggestion => <button type="button" key={suggestion} onClick={() => {
            setDraft(suggestion); setMessage(""); input.current?.focus();
          }}>{suggestion}</button>)}
        </div>
        <p id="discovery-help" className={styles.help}>{demo ? "Demo keyword search across the preview pieces below. No AI styling recommendations." : "Search the product catalog by keyword."}</p>
        <p id="discovery-message" className={styles.message} role="status">{message || (query ? `Showing demo matches for “${query}”.` : "")}</p>
        {query && <button type="button" onClick={clear} className={styles.clear}>Clear search</button>}
      </form>
    </section>
    {children}
    {error ?? <CollectionGrid pieces={pieces} demo={demo} query={query}/>}
  </>;
}
