import { type Currency, minorDigits, money } from "../money/money.ts";
import type { Prisma } from "../../generated/prisma/client";
import type { Product, CatalogQuery } from "./catalog";
import { publicProductImageUrl } from "../products/images.ts";
import { formatAurelProductName } from "../products/product-name.ts";

export const catalogProductSelect = {
  id: true, slug: true, name: true, description: true, brand: true,
  category: { select: { id: true, slug: true, name: true } },
  variants: {
    where: { isActive: true }, orderBy: { id: "asc" },
    select: { id: true, sku: true, color: true, size: true, price: true, stock: true },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, storageKey: true, altText: true, sortOrder: true },
  },
} satisfies Prisma.ProductSelect;

export const currencyCatalogProductSelect = { ...catalogProductSelect, variants: {
  ...catalogProductSelect.variants, select: { ...catalogProductSelect.variants.select,
    prices: { select: { currency: true, amount: true } } },
} } satisfies Prisma.ProductSelect;
export type CurrencyCatalogRecord = Prisma.ProductGetPayload<{ select: typeof currencyCatalogProductSelect }>;
export type CatalogRecord = Prisma.ProductGetPayload<{ select: typeof catalogProductSelect }>;

// Keep the exact legacy select when the separate foundation migration is disabled.
export function imageRightsSelect<T extends typeof catalogProductSelect | typeof currencyCatalogProductSelect>(select: T, enabled: boolean): T {
  return enabled ? { ...select, images: { ...select.images, where: { websitePermission: "granted" } } } : select;
}

// The disabled branch contains no reference to the staged ProductPrice relation.
export function productDetailSelect(selected: Currency | undefined, enabled: boolean) {
  return enabled && selected ? { ...catalogProductSelect, variants: {
    ...catalogProductSelect.variants, select: { ...catalogProductSelect.variants.select,
      prices: { where: { currency: selected }, select: { currency: true, amount: true } },
    },
  } } satisfies Prisma.ProductSelect : catalogProductSelect;
}

export function mapProductDetailRecord(record: CatalogRecord | CurrencyCatalogRecord, selected?: Currency): Product {
  if (selected) {
    // Reject corrupt/excess-scale amounts before the existing mapper's toFixed;
    // never silently round a database value into an apparently valid price.
    for (const variant of record.variants) if ("prices" in variant) {
      for (const price of variant.prices as { currency: Currency; amount: Prisma.Decimal }[]) {
        if (price.currency === selected) money(price.amount.toString(), selected);
      }
    }
  }
  return mapCatalogProduct(record, selected);
}

export function catalogWhere(query: CatalogQuery): Prisma.ProductWhereInput {
  // Match literal input; do not interpret SQL LIKE wildcards as a wider search.
  const q = query.q.replace(/[\\%_]/g, "\\$&");
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    isActive: true,
    ...(query.gender ? { profile: { is: { gender: { in: [query.gender, "unisex"] } } } } : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.brand ? { brand: { equals: query.brand, mode: "insensitive" as const } } : {}),
    ...(query.size || query.color || query.minPrice !== undefined || query.maxPrice !== undefined ? { variants: { some: {
      isActive: true,
      ...(query.size ? { size: { equals: query.size, mode: "insensitive" as const } } : {}),
      ...(query.color ? { color: { equals: query.color, mode: "insensitive" as const } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { prices: { some: { currency: query.currency ?? "VND", amount: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) } } } } : {}),
    } } } : {}),
    ...(q ? { OR: [
      { name: contains }, { description: contains }, { brand: contains },
      { category: { name: contains } },
      { variants: { some: { isActive: true, OR: [{ color: contains }, { size: contains }, { sku: contains }] } } },
    ] } : {}),
  };
}

export function mapCatalogProduct(record: CatalogRecord | CurrencyCatalogRecord, selected?: Currency): Product {
  const variants = record.variants.map(variant => {
    const prices = "prices" in variant ? variant.prices as { currency: Currency; amount: Prisma.Decimal }[] : [];
    const priced = selected ? prices.find(price => price.currency === selected) : undefined;
    return { id: String(variant.id), sku: variant.sku, color: variant.color, size: variant.size,
      price: selected ? priced?.amount.toFixed(minorDigits[selected]) ?? null : variant.price?.toFixed(2) ?? null,
      ...(selected ? { currency: selected, priceStatus: priced ? "available" as const : "missing" as const } : { currency: null, priceStatus: "legacy_unassigned" as const }), stock: variant.stock };
  });
  const available = variants.filter(v => v.price !== null);
  const minimum = available.reduce<string | null>((current, variant) => {
    const value = variant.price!;
    // All values in this list already have the same fixed scale; legacy has no assigned currency.
    return current === null || BigInt(value.replace(".", "")) < BigInt(current.replace(".", "")) ? value : current;
  }, null);
  return {
    id: String(record.id), slug: record.slug, name: formatAurelProductName(record.name),
    description: record.description, brand: record.brand,
    category: { ...record.category, id: String(record.category.id) },
    variants,
    images: record.images.map(image => ({ id: String(image.id), url: publicProductImageUrl(image.storageKey), alt: image.altText, sortOrder: image.sortOrder })),
    price: minimum,
    ...(selected ? { currency: selected, priceStatus: minimum === null ? "missing" as const : "available" as const } : { currency: null, priceStatus: "legacy_unassigned" as const }),
    colors: [...new Set(variants.map(variant => variant.color))],
    sizes: [...new Set(variants.map(variant => variant.size))],
    stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
  };
}
