import { audienceGroup } from "./audience.ts";
import { productCode, collectionCode, option, profile, imageMetadata, type TaxonomyRegistry } from "./foundation.ts";
import { validateData, InputError } from "./validation.ts";
import { currency, money, MoneyError } from "../money/money.ts";

export const importColumns = {
  products: ["product_code", "name", "slug", "category_slug", "collection", "description", "is_active"],
  product_options: ["product_code", "collar", "fabric", "gender", "fit"],
  product_variants: ["product_code", "sku", "color", "size", "stock", "is_active"],
  product_prices: ["sku", "currency", "amount"],
  product_images: ["product_code", "sku", "storage_key", "alt_text", "image_type", "sort_order", "is_primary", "source_reference", "rights_reference", "website_permission", "embedding_permission", "training_permission"],
  product_ai_attributes: ["product_code", "garment_type", "style_tags", "season_tags", "occasion_tags", "layer_role", "pattern", "silhouette", "age_group"],
} as const;
export type ImportTable = keyof typeof importColumns;
type Row = Record<string, string>;
export type ImportBundle = Record<ImportTable, Row[]>;
export type ImportBaseline = { productCodes: string[]; slugs: string[]; skus: string[]; categorySlugs: string[] };
function numeric(value: string, field: string) {
  if (!/^(0|[1-9]\d*)$/.test(value) || Number(value) > 2147483647) throw new InputError(field);
  return Number(value);
}
function bool(value: string, field: string) {
  if (!["true", "false"].includes(value)) throw new InputError(field);
  return value === "true";
}
function unique(set: Set<string>, value: string, field: string) {
  if (set.has(value)) throw new InputError(field);
  set.add(value);
}
// Insert-only planning. No writes, auto SKU generation, FX or inferred prices.
export function dryRunImport(bundle: ImportBundle, baseline: ImportBaseline, registry: TaxonomyRegistry = {}) {
  const errors: { table: ImportTable; row: number; field: string }[] = [];
  const products = new Set<string>(), variants = new Map<string, string>();
  const codes = new Set(baseline.productCodes), slugs = new Set(baseline.slugs);
  const skus = new Set(baseline.skus.map(value => value.trim().toUpperCase()));
  const categories = new Set(baseline.categorySlugs), combinations = new Set<string>();
  const optionsSeen = new Set<string>(), aiSeen = new Set<string>(), prices = new Set<string>(), primary = new Set<string>();
  const optionsPresent = new Set<string>();
  function parent(row: Row) { const code = productCode(row.product_code); if (!products.has(code)) throw new InputError("product_code"); return code; }
  for (const table of Object.keys(importColumns) as ImportTable[]) {
    bundle[table].forEach((row, index) => {
      try {
        if (Object.keys(row).some(key => !(importColumns[table] as readonly string[]).includes(key)) || importColumns[table].some(key => typeof row[key] !== "string")) throw new InputError("columns");
        if (table === "products") {
          const code = productCode(row.product_code);
          validateData("product", { name: row.name, slug: row.slug, categoryId: 1, ...(row.description ? { description: row.description } : {}), isActive: bool(row.is_active, "is_active") });
          collectionCode(row.collection || null);
          if (!categories.has(row.category_slug)) throw new InputError("category_slug");
          if (codes.has(code)) throw new InputError("product_code");
          if (slugs.has(row.slug)) throw new InputError("slug");
          codes.add(code); slugs.add(row.slug); products.add(code);
        } else if (table === "product_options") {
          const code = parent(row);
          profile(Object.fromEntries(["collar", "fabric", "gender", "fit"].map(key => [key, row[key] || null])), registry);
          unique(optionsSeen, code, "product_code"); optionsPresent.add(code);
        } else if (table === "product_variants") {
          const code = parent(row), color = option("color", row.color, registry), size = option("size", row.size, registry);
          const sku = row.sku.trim().toUpperCase();
          if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(sku)) throw new InputError("sku");
          validateData("variant", { productId: 1, sku, color, size, stock: numeric(row.stock, "stock"), isActive: bool(row.is_active, "is_active") });
          if (skus.has(sku)) throw new InputError("sku");
          unique(combinations, JSON.stringify([code, color, size]), "combination"); skus.add(sku); variants.set(sku, code);
        } else if (table === "product_prices") {
          const sku = row.sku.trim().toUpperCase();
          if (!variants.has(sku)) throw new InputError("sku");
          const unit = currency(row.currency); money(row.amount, unit);
          unique(prices, JSON.stringify([sku, unit]), "currency");
        } else if (table === "product_images") {
          const code = parent(row), sku = row.sku.trim().toUpperCase();
          if (sku && variants.get(sku) !== code) throw new InputError("sku");
          validateData("image", { productId: 1, storageKey: row.storage_key, ...(row.alt_text ? { altText: row.alt_text } : {}), sortOrder: numeric(row.sort_order, "sort_order") });
          const meta = imageMetadata({ imageType: row.image_type || null, isPrimary: bool(row.is_primary, "is_primary"),
            sourceReference: row.source_reference || null, rightsReference: row.rights_reference || null,
            websitePermission: row.website_permission, embeddingPermission: row.embedding_permission, trainingPermission: row.training_permission });
          if ([row.website_permission, row.embedding_permission, row.training_permission].includes("granted") && !row.rights_reference.trim()) throw new InputError("rights_reference");
          if (meta.isPrimary) unique(primary, code, "is_primary");
        } else {
          const code = parent(row);
          audienceGroup(row.age_group || null);
          profile({ garmentType: row.garment_type || null, layerRole: row.layer_role || null, pattern: row.pattern || null, silhouette: row.silhouette || null,
            styleTags: row.style_tags ? row.style_tags.split("|") : [], seasonTags: row.season_tags ? row.season_tags.split("|") : [], occasionTags: row.occasion_tags ? row.occasion_tags.split("|") : [] }, registry);
          unique(aiSeen, code, "product_code");
        }
      } catch (error) { errors.push({ table, row: index + 2, field: error instanceof InputError || error instanceof MoneyError ? error.field : "value" }); }
    });
  }
  return { dryRun: true, writes: 0, valid: errors.length === 0, errors,
    warnings: [...products].filter(code => !optionsPresent.has(code)).map(product_code => ({ product_code, code: "MISSING_DESCRIPTIVE_OPTIONS" })),
    validatedAgainstSnapshot: true, requiresLiveRevalidationBeforeImport: true };
}

// RFC4180-style quoted fields; record numbers in reports include the header.
export function parseCsv(text: string, maxRows = 100000): Row[] {
  if (text.length > 10_000_000) throw new Error("CSV exceeds size limit");
  const records: string[][] = []; let record: string[] = [], field = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ",") { record.push(field); field = ""; closed = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field); records.push(record); if (records.length > maxRows + 1) throw new Error("CSV exceeds row limit"); record = []; field = ""; closed = false;
    } else { if (closed || c === '"') throw new Error("Malformed CSV quoting"); field += c; }
  }
  if (quoted) throw new Error("Unterminated CSV quote");
  if (field || record.length || closed) { record.push(field); records.push(record); if (records.length > maxRows + 1) throw new Error("CSV exceeds row limit"); }
  const header = records.shift();
  if (!header || new Set(header).size !== header.length || header.some(key => !/^[a-z_]+$/.test(key))) throw new Error("Invalid CSV header");
  return records.map(values => { if (values.length !== header.length) throw new Error("CSV column count mismatch"); return Object.fromEntries(header.map((key, i) => [key, values[i]])); });
}

export function importHeaderMatches(table: ImportTable, header: string) { return header === importColumns[table].join(",") || (table === "product_ai_attributes" && header === importColumns[table].slice(0, -1).join(",")); }
