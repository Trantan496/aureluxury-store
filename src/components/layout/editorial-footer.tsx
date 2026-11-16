import Link from "next/link";
import styles from "./editorial-footer.module.css";

export function EditorialFooter() {
  return <footer className={styles.footer} lang="en">
    <div className={styles.top}>
      <div className={styles.brand}><Link href="/">AUREL</Link><p>Considered pieces.<br/>Enduring personal expression.</p></div>
      <nav aria-label="Footer explore"><h2>EXPLORE</h2><Link href="/#collection">New Collection</Link><Link href="/products">Shop</Link><Link href="/#aurel-edit">The AUREL Edit</Link></nav>
      <div><h2>CUSTOMER CARE</h2><p className={styles.pending}>Contact, shipping & returns,<br/>size guide and FAQs<br/>will be available at launch.</p><Link href="/products">Search the collection ↗</Link></div>
      <div><h2>FOLLOW</h2><p className={styles.pending}>Our official social channels<br/>will be announced here.</p><span className={styles.soon}>INSTAGRAM / PINTEREST · COMING SOON</span></div>
    </div>
  </footer>;
}
