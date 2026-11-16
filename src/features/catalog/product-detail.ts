import type { Product, ProductRatingSummary } from "./catalog.ts";
import { money, type Currency } from "../money/money.ts";
import { publicProductImageUrl } from "../products/images.ts";
import type { GalleryImage } from "../products/gallery.ts";
import type {VariantColours} from "../products/variant-matrix.ts";

export type DetailVariant = { id: string; sku: string; color: string; size: string; stock: number; price: { amount: string; currency: Currency } | null; isActive?:boolean };
export type { ProductRatingSummary };
export type ProductDetail = {
  variantColors?:VariantColours;
  slug: string; name: string; brand: string | null; description: string | null;
  category: { name: string; slug: string } | null;
  currency: Currency | null;
  variants: readonly DetailVariant[];
  images: readonly GalleryImage[];
  rating?: ProductRatingSummary | null;
  profile?: { fabric: string | null; fit: string | null; gender: string | null } | null;
};
export type ProductDetailResult = { status: "success"; product: ProductDetail } | { status: "not_found" } | { status: "error" };
export type DetailWhere = { slug: string; isActive: true };
export type ProductDetailReader = (where: DetailWhere, selected?: Currency) => Promise<Product | null>;

export function validProductSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export function productDetailHref(slug: unknown): string | null { return validProductSlug(slug) ? `/products/${slug}` : null; }

export function toProductDetail(product: Product): ProductDetail {
  if (!validProductSlug(product.slug)) throw new Error("Invalid product slug");
  return {
    slug: product.slug, name: product.name, brand: product.brand ?? null, description: product.description ?? null,
    category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
    currency: product.currency ?? null,
    ...(product.variantColors?{variantColors:product.variantColors}:{}),
    ...(product.rating !== undefined ? { rating: product.rating } : {}),
    ...(product.profile !== undefined ? { profile: product.profile } : {}),
    variants: (product.variants ?? []).map(variant => ({
      id: variant.id, sku: variant.sku, color: variant.color, size: variant.size, stock: variant.stock,
      // Unassigned legacy amounts are never sent to the detail Client Components.
      price: variant.priceStatus === "available" && variant.currency && variant.price !== null
        ? { amount: money(variant.price, variant.currency), currency: variant.currency } : null,
    })),
    images: (product.images ?? []).flatMap(image => {
      const url = publicProductImageUrl(image.url ?? "");
      return url ? [{ id: image.id, url, alt: image.alt || product.name, ...(image.imageType !== undefined ? { imageType: image.imageType, isPrimary: image.isPrimary, sortOrder: image.sortOrder, variantId: image.variantId } : {}) }] : [];
    }),
  };
}

export async function loadProductDetail(reader: ProductDetailReader, slug: unknown, selected?: Currency): Promise<ProductDetailResult> {
  if (!validProductSlug(slug)) return { status: "not_found" };
  try {
    const product = await reader({ slug, isActive: true }, selected);
    return product ? { status: "success", product: toProductDetail(product) } : { status: "not_found" };
  } catch { return { status: "error" }; }
}

export function selectDetailVariant(variants: readonly DetailVariant[], currentId?: string, change: { color?: string; size?: string } = {}): DetailVariant | null {
  const current = variants.find(variant => variant.id === currentId) ?? variants.find(variant => variant.isActive!==false&&variant.stock > 0) ?? variants.find(variant=>variant.isActive!==false) ?? variants[0];
  if (!current) return null;
  if (change.color !== undefined) {
    const matches = variants.filter(variant => variant.color === change.color);
    return matches.find(variant => variant.size === current.size) ?? matches.find(variant => variant.stock > 0) ?? matches[0] ?? current;
  }
  return change.size === undefined ? current : variants.find(variant => variant.color === current.color && variant.size === change.size) ?? current;
}

export function formatDetailPrice(price: NonNullable<DetailVariant["price"]>): string {
  const [whole, fraction] = money(price.amount, price.currency).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction === undefined ? "" : `,${fraction}`} ${price.currency}`;
}
