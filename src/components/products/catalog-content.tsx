import { EmptyState } from "@/components/ui/empty-state";
import type { CatalogResult } from "@/features/catalog/catalog";
import Link from "next/link";
import Image from "next/image";
import { productDetailHref } from "@/features/catalog/product-detail";
import { CatalogProductActions } from "./catalog-product-actions";
import styles from "./catalog-browser.module.css";
export function CatalogContent({ result, search = false, query = "", premium = false, label = "Sản phẩm" }: { result: CatalogResult; search?: boolean; query?: string; premium?: boolean; label?: string }) {
  if (result.status === "error") return <EmptyState symbol="!" title="Chưa thể tải sản phẩm" description="Dữ liệu hiện không thể truy cập. Vui lòng thử lại sau; bạn vẫn có thể khám phá cửa hàng." href={search && query ? `/products?q=${encodeURIComponent(query)}` : "/products"} action="Thử tải lại" reload/>;
  if (!result.products.length) return <EmptyState title={search ? "Chưa tìm thấy sản phẩm" : "Những lựa chọn mới đang được chuẩn bị"} description={search ? `Chưa có sản phẩm phù hợp với “${query}”. Bạn có thể thử từ khóa khác hoặc xem toàn bộ danh mục.` : "Hiện chưa có sản phẩm được đăng bán. Hãy quay lại sau để khám phá những lựa chọn đầu tiên của cửa hàng."} href={search ? "/products" : "/#collection"} action={search ? "Xem danh mục" : "Khám phá phong cách"}/>;
  return <ul className={premium ? styles.productGrid : "product-grid"} aria-label={label}>{result.products.map(product => {
    const photo = product.images?.find(image => image.url), href = productDetailHref(product.slug);
    const image = photo?.url ? <Image src={photo.url} alt={photo.alt ?? product.name} fill sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw" unoptimized={photo.url.startsWith("/images/uploads/")}/> : null;
    if (!premium) return <li className="product-card" key={product.id}>{image && <div className={styles.legacyImage}>{href ? <Link href={href} aria-label={`Xem ${product.name}`}>{image}</Link> : image}</div>}<h2>{href ? <Link href={href}>{product.name}</Link> : product.name}</h2><p>{product.price && product.currency ? `${new Intl.NumberFormat("vi-VN").format(Number(product.price))} ${product.currency}` : "Giá chưa khả dụng"}</p><p>{product.colors?.join(" · ")} / {product.sizes?.join(" · ")}</p>{product.stock === 0 && <p>Hết hàng</p>}</li>;
    return <li className={styles.productCard} key={product.id}><div className={styles.productImage}>{image && (href ? <Link href={href} aria-label={`Xem ${product.name}`}>{image}</Link> : image)}<CatalogProductActions productName={product.name} slug={product.slug} detailHref={href}/></div><div className={styles.productDetails}><p className={styles.productCategory}>{product.category?.name ?? product.brand ?? "AUREL"}</p><h2>{href ? <Link href={href}>{product.name}</Link> : product.name}</h2><p className={styles.productPrice}>{product.price && product.currency ? `${new Intl.NumberFormat("vi-VN").format(Number(product.price))} ${product.currency}` : "Giá chưa khả dụng"}</p>{product.colors && product.colors.length > 0 && <p className={styles.productColors}>{product.colors.slice(0, 4).join(" · ")}</p>}{product.stock === 0 && <p className={styles.soldOut}>Hết hàng</p>}</div></li>;
  })}</ul>;
}
