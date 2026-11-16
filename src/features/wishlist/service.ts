import "server-only";
import { prisma } from "@/lib/db/client";
import { currencyCatalogProductSelect, imageRightsSelect, mapCatalogProduct } from "@/features/catalog/prisma-catalog";
import { storefrontCurrency } from "@/features/money/money";
import { pickRecommendations, toWishlistProduct, type WishlistProduct } from "./products";

const select = imageRightsSelect(currencyCatalogProductSelect, true);

export type WishlistData = { favorites: WishlistProduct[]; recommendations: WishlistProduct[]; isAuthenticated: boolean };

/**
 * Loads the active customer's favorites (if signed in) and up to four purchasable recommendations.
 * For guests, favorites are empty and recommendations allow browsing without error.
 */
export async function loadWishlist(userId?: number): Promise<WishlistData> {
  const currency = storefrontCurrency();
  const rows = userId
    ? await prisma.favorite.findMany({
        where: { userId, product: { isActive: true } }, orderBy: { createdAt: "desc" }, take: 100,
        select: { product: { select } },
      })
    : [];
  const favorites = rows.flatMap(row => toWishlistProduct(mapCatalogProduct(row.product, currency)) ?? []);
  let recommendations: WishlistProduct[] = [];
  try {
    const saved = new Set(rows.map(row => String(row.product.id)));
    const records = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(rows.length > 0 ? { id: { notIn: rows.map(row => row.product.id) } } : {}),
        variants: { some: { isActive: true, stock: { gt: 0 }, prices: { some: { currency } } } },
      },
      select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12,
    });
    recommendations = pickRecommendations(records.map(record => mapCatalogProduct(record, currency)), saved);
  } catch { /* Recommendations are non-blocking. */ }
  return { favorites, recommendations, isAuthenticated: Boolean(userId) };
}
