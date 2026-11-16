import { CatalogBrowser } from "@/components/products/catalog-browser";
import styles from "@/components/products/catalog-browser.module.css";
export const metadata = { title: "Sản phẩm" };
export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <main className={styles.page}><CatalogBrowser params={await searchParams}/></main>;
}
