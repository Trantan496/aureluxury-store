import type { ManagementDTO } from "./management.ts";
import type { ProductDetail } from "../catalog/product-detail.ts";
import type { Currency } from "../money/money.ts";
import { publicProductImageUrl } from "./images.ts";
import { storefrontCurrency } from "../money/money.ts";
export function showroomProduct(row: ManagementDTO, selected?: Currency, currencyEnabled = false,includeInactive=false): ProductDetail {
  const unit = storefrontCurrency(selected, currencyEnabled);
  return {
    slug: row.slug, name: row.name, brand: row.brand, description: row.description,
    variantColors:row.variantColors,
    category: { name: row.category.name, slug: row.category.slug }, currency: unit,
    profile: row.profile ? { fabric: row.profile.fabric, fit: row.profile.fit, gender: row.profile.gender } : null,
    variants: row.variants.filter(v => includeInactive||v.isActive).map(v => {
      const price = v.prices.find(p => p.currency === unit);
      return { id: String(v.id), sku: v.sku, color: v.color, size: v.size, stock: v.stock, price: price ? { amount: price.amount, currency: price.currency } : null,...(includeInactive?{isActive:v.isActive}:{}) };
    }),
    images: [...row.images].sort((a,b) => a.sortOrder - b.sortOrder || a.id - b.id).flatMap(i => {
      const url = publicProductImageUrl(i.storageKey);
      return url ? [{ id: String(i.id), url, alt: i.altText || row.name, imageType: i.imageType, isPrimary: i.isPrimary, sortOrder: i.sortOrder, variantId: i.variantId ? String(i.variantId) : null }] : [];
    }),
  };
}
