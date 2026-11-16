import { currency, type Currency } from "../money/money.ts";
import { pagination } from "./pagination.ts";
import type {VariantColours} from "../products/variant-matrix.ts";
export type ProductRatingSummary = { average: number; count: number };
export type CatalogQuery = { gender?: "women" | "men"; q: string; category: string; invalid: boolean; page?: number; pageSize?: number; currency?: Currency; minPrice?: number; maxPrice?: number; size?: string; color?: string; brand?: string };
export type Product = {
  variantColors?:VariantColours;
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  category?: { id: string; slug: string; name: string };
  variants?: readonly { id: string; sku: string; color: string; size: string; price: string | null; currency?: Currency | null; priceStatus?: "available" | "missing" | "legacy_unassigned"; stock: number }[];
  images?: readonly { id: string; url: string | null; alt: string | null; sortOrder: number; imageType?: string | null; isPrimary?: boolean; variantId?: string | null }[];
  profile?: { fabric: string | null; fit: string | null; gender: string | null } | null;
  rating?: ProductRatingSummary | null;
  price?: string | null;
  currency?: Currency | null;
  priceStatus?: "available" | "missing" | "legacy_unassigned";
  colors?: readonly string[];
  sizes?: readonly string[];
  tags?: readonly string[];
  stock?: number;
};
export type CatalogResult = { status: "success"; products: readonly Product[] } | { status: "error" };
export type ProductReader = (query: CatalogQuery) => Promise<readonly Product[]>;

export function normalizeSearchInput(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

export function parseCatalogQuery(params: Record<string, string | string[] | undefined>): CatalogQuery {
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const gender = params.gender === "" ? undefined : params.gender;
  let invalid = (gender !== undefined && gender !== "women" && gender !== "men") || Array.isArray(params.q) || Array.isArray(params.category) || q.length > 100 ||
    (category !== "" && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category) || category.length > 100));
  const filters: Pick<CatalogQuery, "minPrice" | "maxPrice" | "size" | "color" | "brand"> = {};
  for (const key of ["minPrice", "maxPrice"] as const) {
    const raw = params[key];
    if (raw === undefined || raw === "") continue;
    if (typeof raw !== "string" || !/^\d{1,12}$/.test(raw)) invalid = true;
    else filters[key] = Number(raw);
  }
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) invalid = true;
  for (const key of ["size", "color", "brand"] as const) {
    const raw = params[key];
    if (raw === undefined || raw === "") continue;
    if (typeof raw !== "string" || raw.length > 100 || /[\u0000-\u001f]/.test(raw)) invalid = true;
    else filters[key] = raw.trim();
  }
  const paging: { page?: number; pageSize?: number } = {};
  if (params.page !== undefined || params.pageSize !== undefined) {
    try {
      for (const field of ["page", "pageSize"] as const) {
        const raw = params[field];
        if (raw !== undefined) {
          if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) throw new Error("Invalid pagination");
          paging[field] = Number(raw);
        }
      }
      pagination(paging);
    } catch { invalid = true; delete paging.page; delete paging.pageSize; }
  }
  let selected: Currency | undefined;
  if (params.currency !== undefined) { try { selected = currency(params.currency); } catch { invalid = true; } }
  return { ...filters, ...(!invalid && (gender === "women" || gender === "men") ? { gender } : {}), ...(selected ? { currency: selected } : {}), q: q.slice(0, 100), category: invalid ? "" : category, invalid, ...paging };
}

export async function loadCatalog(reader: ProductReader, query: CatalogQuery): Promise<CatalogResult> {
  try { return { status: "success", products: await reader(query) }; }
  catch { return { status: "error" }; }
}
