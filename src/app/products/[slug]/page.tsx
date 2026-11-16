import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getProductDetail } from "@/lib/catalog";
import { currency, currencies, currencyEnabled, type Currency } from "@/features/money/money";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { ProductReviewsSection } from "@/components/products/product-reviews-section";
import { productRelated } from "@/lib/product-related";
import { descriptionText } from "@/features/products/description";
import { getDiscussion } from "@/features/reviews/discussion-service";
import type { DiscussionPayload } from "@/features/reviews/discussion-types";
import type { PublicProductReviewsPayload } from "@/features/reviews/types";
import { EmptyState } from "@/components/ui/empty-state";
import styles from "@/components/products/product-detail.module.css";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const readProduct = cache(getProductDetail);
async function selection(searchParams: PageProps["searchParams"]) {
  const query = await searchParams;
  const raw = query.currency;
  let selected: Currency | undefined;
  let invalid = false;
  if (currencyEnabled() && raw !== undefined && raw !== "") { try { selected = currency(raw); } catch { invalid = true; } }
  const variant = typeof query.variant === "string" && /^[1-9]\d{0,9}$/.test(query.variant) ? query.variant : undefined;
  return { selected, invalid, variant };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { selected } = await selection(searchParams);
  const result = await readProduct(slug, selected);
  if (result.status === "not_found") notFound();
  if (result.status !== "success") return { title: { absolute: "Sản phẩm | AUREL" }, robots: { index: false } };
  const product = result.product;
  return {
    title: { absolute: `${product.name} | AUREL` },
    ...(product.description ? { description: descriptionText(product.description).slice(0, 160) } : {}),
    openGraph: { title: product.name, ...(product.description ? { description: descriptionText(product.description).slice(0, 160) } : {}) },
  };
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { selected, invalid, variant } = await selection(searchParams);
  const result = await readProduct(slug, selected);
  if (result.status === "not_found") notFound();
  if (result.status === "error") return <div className={styles.page}><EmptyState symbol="!" title="Chưa thể tải sản phẩm" description="Dữ liệu sản phẩm hiện không thể truy cập. Vui lòng thử lại sau." href={`/products/${encodeURIComponent(slug)}`} action="Thử tải lại" reload/></div>;
  const product = result.product;
  const initialReviews: PublicProductReviewsPayload = {
    available: false,
    summary: product.rating ?? null,
    reviews: [],
    viewer: { canSubmit: false, reason: "UNAVAILABLE", ownReview: null },
  };
  let initialDiscussion: DiscussionPayload | undefined;
  try {
    initialDiscussion = await getDiscussion(new URLSearchParams({ productSlug: slug }));
  } catch {
    // Keep PDP usable even if reviews query fails transiently.
  }
  return (
    <ProductDetailView
      key={`${slug}:${product.currency}:${variant ?? ""}`}
      product={product}
      mode="production"
      initialVariantId={variant}
      related={await productRelated(product)}
      currencyControl={currencyEnabled() ? <form className={styles.currency} method="get">{variant && <input type="hidden" name="variant" value={variant}/>}<label htmlFor="product-currency">Loại tiền<select id="product-currency" name="currency" defaultValue={selected ?? "VND"}>{currencies.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label><button type="submit">Xem giá</button>{invalid && <p className={styles.note} role="alert">Loại tiền không hợp lệ. Vui lòng chọn VND, USD hoặc EUR.</p>}</form> : undefined}
      reviewsSlot={<ProductReviewsSection productSlug={product.slug} productName={product.name} initialData={initialReviews} initialDiscussion={initialDiscussion} />}
    />
  );
}
