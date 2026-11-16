import test from "node:test";
import assert from "node:assert/strict";
import { option, profile, productCode, imageMetadata } from "../src/features/products/foundation.ts";
import { dryRunImport, importColumns, parseCsv, type ImportBundle } from "../src/features/products/import-dry-run.ts";
import { extractFeatures, exportFeatureDataset, type FeatureSource } from "../src/features/products/feature-export.ts";
import { productDetailSelect, catalogProductSelect, imageRightsSelect } from "../src/features/catalog/prisma-catalog.ts";
import { createProductService } from "../src/features/products/product-service.ts";

const baseline = { productCodes: [], slugs: [], skus: [], categorySlugs: ["tops"] };
function bundle(): ImportBundle {
  return { products: [{ product_code: "AUR-0001", name: "Import validation fixture", slug: "validation-fixture", category_slug: "tops", collection: "", description: "", is_active: "true" }],
    product_options: [], product_variants: [{ product_code: "AUR-0001", sku: "AUR-0001-BLK-M", color: "Black", size: "m", stock: "0", is_active: "true" }],
    product_prices: [], product_images: [], product_ai_attributes: [] };
}
test("import detects duplicate public codes/slugs/SKUs and snapshot conflicts", () => {
  const data = bundle(); assert.equal(dryRunImport(data, baseline).valid, true);
  data.products.push({ ...data.products[0] }); data.product_variants.push({ ...data.product_variants[0], sku: "aur-0001-blk-m" });
  assert.deepEqual(dryRunImport(data, baseline).errors.map(error => error.field), ["product_code", "sku"]);
  assert.equal(dryRunImport(bundle(), { ...baseline, slugs: ["validation-fixture"] }).valid, false);
  assert.throws(() => productCode("0001"));
});
test("typed taxonomy normalizes labels and rejects unknown, duplicate or invented not-applicable values", () => {
  assert.equal(option("collar", " Round Neck "), "round-neck");
  assert.equal(option("size", "m"), "M");
  assert.equal(profile({}).collar, null);
  assert.throws(() => profile({ collar: "not-applicable" }));
  assert.throws(() => profile({ styleTags: ["Classic", "classic"] }));
  assert.throws(() => profile({ role: "ADMIN" }));
  assert.throws(() => imageMetadata({ trainingPermission: true }));
});
test("only explicit variants exist; normalized combinations, integer stock and exact currency prices validated", () => {
  const data = bundle(); data.product_variants.push({ ...data.product_variants[0], sku: "OTHER-SKU" });
  assert.equal(dryRunImport(data, baseline).errors[0].field, "combination");
  const bad = bundle(); bad.product_variants[0].stock = "-1";
  assert.equal(dryRunImport(bad, baseline).errors[0].field, "stock");
  const prices = bundle(); prices.product_prices.push({ sku: "AUR-0001-BLK-M", currency: "VND", amount: "1.01" });
  assert.equal(dryRunImport(prices, baseline).valid, false);
  prices.product_prices[0] = { sku: "AUR-0001-BLK-M", currency: "USD", amount: "1.01" };
  assert.equal(dryRunImport(prices, baseline).valid, true);
});
const source: FeatureSource = { id: 1, category: { slug: "tops" }, description: null, isActive: true, profile: null,
  variants: [{ color: "Black", size: "m", stock: 0, isActive: true }], images: [
    { id: 1, storageKey: "/images/products/test.webp", sourceReference: "owned-source", rightsReference: "reviewed-license",
      websitePermission: "granted", embeddingPermission: "unknown", trainingPermission: "denied" },
  ] };
test("feature export separates identity/eligibility, missing values and purpose-specific rights", () => {
  const row = extractFeatures(source); assert.deepEqual(row.features.color, ["black"]);
  assert.equal(row.product_id, "1"); assert.equal(row.eligibility.in_stock, false);
  assert.equal("product_id" in row.features, false); assert.equal("price" in row.features, false);
  assert.deepEqual(row.features.image_references, []); assert.ok(row.missing.includes("fabric"));
  const allowed = { ...source, images: [{ ...source.images[0], embeddingPermission: "granted" }] };
  assert.equal(extractFeatures(allowed).features.image_references.length, 1);
  assert.equal(extractFeatures(allowed, "training").features.image_references.length, 0);
  const report = exportFeatureDataset([source, source]); assert.equal(report.report.errors.length, 1);
  assert.equal(exportFeatureDataset([]).jsonl, "");
});
test("CSV quoting and image parent/rights validation produce row-specific errors", () => {
  assert.deepEqual(parseCsv('name,description\r\n"A, B","a ""quote"""\r\n'), [{ name: "A, B", description: 'a "quote"' }]);
  assert.throws(() => parseCsv('name\n"unclosed'));
  for (const columns of Object.values(importColumns)) assert.deepEqual(parseCsv(columns.join(",") + "\n"), []);
  const data = bundle(); data.product_images.push({ product_code: "AUR-0001", sku: "AUR-0001-BLK-M", storage_key: "/images/products/test.webp", alt_text: "", image_type: "front", sort_order: "0", is_primary: "true", source_reference: "", rights_reference: "", website_permission: "granted", embedding_permission: "unknown", training_permission: "unknown" });
  assert.deepEqual(dryRunImport(data, baseline).errors, [{ table: "product_images", row: 2, field: "rights_reference" }]);
});
test("disabled staged features do not query new tables or columns", async () => {
  assert.deepEqual(productDetailSelect(undefined, false), catalogProductSelect);
  assert.equal(imageRightsSelect(catalogProductSelect, false), catalogProductSelect);
  assert.match(JSON.stringify(imageRightsSelect(catalogProductSelect, true)), /websitePermission.*granted/);
  assert.doesNotMatch(JSON.stringify(productDetailSelect(undefined, false)), /prices|profile|productCode|Permission/);
  const service = createProductService({ resolveSession: async () => ({ userId: 1, expiresAt: Date.now() + 60000 }),
    transaction: async work => work({ user: { findUnique: async () => ({ role: "ADMIN" }) } } as never) });
  for (const result of [await service.setFoundation(1, {}), await service.exportFeatures(), await service.setImageMetadata(1, 1, {}), await service.getPrice(1, 1, "USD")]) {
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "FEATURE_UNAVAILABLE");
  }
});
