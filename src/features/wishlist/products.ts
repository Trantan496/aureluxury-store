import type { Product } from "../catalog/catalog.ts";
import { productDetailHref } from "../catalog/product-detail.ts";

/** Serializable product shape shared by the wishlist grid and the recommendation grid. */
export type WishlistProduct = {
  id: string; slug: string; name: string; href: string;
  imageUrl: string | null; imageAlt: string; price: string | null; inStock: boolean;
};

export function formatCatalogPrice(price: string | null | undefined, currency: string | null | undefined): string | null {
  if (!price || !currency) return null;
  const amount = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(price));
  return currency === "VND" ? `${amount} ₫` : `${amount} ${currency}`;
}

/** Returns null for records that cannot link to a valid detail page. */
export function toWishlistProduct(product: Product): WishlistProduct | null {
  const href = productDetailHref(product.slug);
  if (!href || !product.slug) return null;
  const photo = product.images?.find(image => image.url);
  return {
    id: product.id, slug: product.slug, name: product.name, href,
    imageUrl: photo?.url ?? null, imageAlt: photo?.alt ?? product.name,
    price: formatCatalogPrice(product.price, product.currency), inStock: (product.stock ?? 0) > 0,
  };
}

/** Recommendations: newest purchasable products with a price, excluding saved items. */
export function pickRecommendations(products: readonly Product[], savedIds: ReadonlySet<string>, limit = 4): WishlistProduct[] {
  const picked: WishlistProduct[] = [];
  for (const product of products) {
    if (picked.length >= limit) break;
    if (savedIds.has(product.id) || !product.price || (product.stock ?? 0) <= 0) continue;
    const mapped = toWishlistProduct(product);
    if (mapped?.price) picked.push(mapped);
  }
  return picked;
}

