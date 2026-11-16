import Link from "next/link";
import type { CatalogResult } from "@/features/catalog/catalog";
import { getCollectionPreview } from "@/features/collection/preview";
import { CatalogContent } from "@/components/products/catalog-content";
import { CollectionGrid } from "./collection-grid";
import styles from "./collection.module.css";

export function CollectionSection({ result }: { result: CatalogResult }) {
  const preview = getCollectionPreview(result);
  return <section className={styles.collection} aria-labelledby="collection-title" id="collection" lang="en">
    <header className={styles.heading} data-collection-heading>
      <h2 id="collection-title">The New Collection</h2>
      <p>Discover our newest arrivals made for every silhouette.</p>
    </header>
    {preview.status === "error" ? <div lang="vi"><CatalogContent result={result}/></div> : <CollectionGrid pieces={preview.pieces} demo={preview.demo}/> }
    <Link className={styles.explore} href="/products">EXPLORE ALL PIECES <span aria-hidden="true">→</span></Link>
  </section>;
}
