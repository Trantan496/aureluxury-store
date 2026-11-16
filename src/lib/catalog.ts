import "server-only";
import { loadCatalog, type CatalogQuery, type CatalogResult, type ProductReader } from "../features/catalog/catalog";
import type { pageInfo } from "../features/catalog/pagination";
import type { Product } from "../features/catalog/catalog";
import { loadProductDetail } from "../features/catalog/product-detail";
import type { Currency } from "../features/money/money";

export function getProductDetail(slug: string, selected?: Currency) {
  return loadProductDetail(async (where, unit) => {
    const { findProductDetail } = await import("./db/queries/products");
    const product=await findProductDetail(where, unit);
    if(product){const {prisma}=await import("./db/client");const {readVariantColours}=await import("../features/products/variant-colours");product.variantColors=await readVariantColours(prisma,(product.variants??[]).map(v=>v.color));}
    return product;
  }, slug, selected);
}

// Lazy import keeps missing configuration/client initialization inside loadCatalog's error boundary.
const readProducts: ProductReader = async query => {
  const { findCatalogProducts } = await import("./db/queries/products");
  return findCatalogProducts(query);
};
export function getCatalog(query: CatalogQuery) { return loadCatalog(readProducts, query); }

export type CatalogPageResult = { status: "success"; products: readonly Product[]; pagination: ReturnType<typeof pageInfo> } | { status: "error" };
export async function getCatalogPage(query: CatalogQuery): Promise<CatalogPageResult> {
  try {
    const { findCatalogPage } = await import("./db/queries/products");
    return { status: "success", ...await findCatalogPage(query) };
  } catch { return { status: "error" }; }
}

export async function getSearchPage(query: CatalogQuery): Promise<CatalogPageResult> {
  try { const { findSearchPage } = await import("./db/queries/products"); return { status: "success", ...await findSearchPage(query) }; }
  catch { return { status: "error" }; }
}

export async function getSearchRecommendations(
  limit = 8,
  context?: { query?: string; sources?: readonly Product[] },
): Promise<CatalogResult> {
  try {
    const { findSearchRecommendations } = await import("./db/queries/products");
    return { status: "success", products: await findSearchRecommendations(limit, context) };
  } catch {
    return { status: "error" };
  }
}
