import type { CatalogQuery } from "./catalog";

export function buildCatalogHref(
  query: CatalogQuery,
  overrides: Partial<{
    q: string;
    gender: "women" | "men" | "";
    category: string;
    size: string;
    color: string;
    minPrice: string;
    maxPrice: string;
    page: number | null;
  }> = {},
) {
  const params = new URLSearchParams();
  const nextQ = overrides.q !== undefined ? overrides.q : query.q;
  const nextGender = overrides.gender !== undefined ? overrides.gender : query.gender ?? "";
  const nextCategory = overrides.category !== undefined ? overrides.category : query.category;
  const nextSize = overrides.size !== undefined ? overrides.size : query.size ?? "";
  const nextColor = overrides.color !== undefined ? overrides.color : query.color ?? "";
  const nextMin =
    overrides.minPrice !== undefined
      ? overrides.minPrice
      : query.minPrice !== undefined
        ? String(query.minPrice)
        : "";
  const nextMax =
    overrides.maxPrice !== undefined
      ? overrides.maxPrice
      : query.maxPrice !== undefined
        ? String(query.maxPrice)
        : "";

  if (nextQ) params.set("q", nextQ);
  if (nextGender) params.set("gender", nextGender);
  if (nextCategory) params.set("category", nextCategory);
  if (nextSize) params.set("size", nextSize);
  if (nextColor) params.set("color", nextColor);
  if (nextMin) params.set("minPrice", nextMin);
  if (nextMax) params.set("maxPrice", nextMax);
  if (query.brand) params.set("brand", query.brand);

  if (overrides.page !== null) {
    const p = overrides.page ?? query.page;
    if (p !== undefined) params.set("page", String(p));
    else if (!nextQ && !nextGender && !nextCategory && !nextSize && !nextColor && !nextMin && !nextMax) {
      params.set("page", "1");
    }
  }

  const qs = params.toString();
  return qs ? `/products?${qs}` : "/products?page=1";
}
