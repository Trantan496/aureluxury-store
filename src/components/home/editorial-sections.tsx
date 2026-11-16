import Link from "next/link";
import { wardrobeCategories } from "@/features/editorial/content";
import { EditorialImage } from "./editorial-image";
import styles from "./editorial.module.css";

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
}

export function EditorialDiscovery() {
  return <div lang="en" className={styles.editorial}>
    <div className={styles.divider}><p>TIMELESS PIECES FOR A MORE INTENTIONAL WARDROBE</p></div>
    <section className={styles.discovery} id="explore" aria-labelledby="explore-title">
      <p className={styles.eyebrow}>AUREL / EXPLORE</p>
      <h2 id="explore-title">WHAT ARE YOU<br/>LOOKING FOR?</h2>
      <p className={styles.subtitle}>Find something that feels like you.</p>
      <form action="/products" method="get" className={styles.searchForm} role="search">
        <label htmlFor="editorial-search" className={styles.srOnly}>Search products</label>
        <SearchIcon/>
        <input id="editorial-search" name="q" type="search" maxLength={100} placeholder="Search for pieces, styles, collections..."/>
        <button type="submit" aria-label="Submit product search"><SearchIcon/></button>
      </form>
      <nav className={styles.suggestions} aria-label="Suggested product searches">
        {["Tailored Coats", "Knitwear", "Wide-Leg Trousers", "Everyday Essentials"].map(term => <Link key={term} href={`/products?q=${encodeURIComponent(term)}`}>{term}</Link>)}
      </nav>
    </section>
    <section className={styles.categories} id="wardrobe" aria-labelledby="wardrobe-title">
      <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>AUREL / THE WARDROBE</p><h2 id="wardrobe-title">SHOP BY CATEGORY</h2></div><Link className={styles.textLink} href="/products">EXPLORE ALL <span aria-hidden="true">↗</span></Link></header>
      <div className={styles.categoryGrid}>
        {wardrobeCategories.map((category, index) => <Link className={styles.categoryCard} href={`/products?category=${category.id}`} key={category.id}>
          <EditorialImage src={category.image} alt={category.alt} sizes="(min-width: 900px) 30vw, 90vw" tone={index}/>
          <div className={styles.categoryCopy}><h3>{category.title}</h3><p>{category.description}</p><span>EXPLORE <span aria-hidden="true">↗</span></span></div>
        </Link>)}
      </div>
      <p className={styles.note}>Design preview · imagery illustrates styling direction, not available inventory.</p>
    </section>
  </div>;
}

