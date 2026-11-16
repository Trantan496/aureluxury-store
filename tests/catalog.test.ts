import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog, normalizeSearchInput, parseCatalogQuery } from "../src/features/catalog/catalog.ts";
test("empty data remains a successful result", async () => {
  assert.deepEqual(await loadCatalog(async () => [], parseCatalogQuery({})), { status: "success", products: [] });
});
test("reader failures remain distinct from empty data", async () => {
  assert.deepEqual(await loadCatalog(async () => { throw new Error("private connection details"); }, parseCatalogQuery({})), { status: "error" });
});
test("available records pass through without invented merchandise", async () => {
  const records = [{ id: "test-fixture", name: "Test fixture, never published" }];
  assert.deepEqual(await loadCatalog(async () => records, parseCatalogQuery({})), { status: "success", products: records });
});
test("query accepts allowed category and trims search", () => {
  assert.deepEqual(parseCatalogQuery({ q: " linen ", category: "everyday" }), { q: "linen", category: "everyday", invalid: false });
});
test("storefront audience navigation accepts real gender/accessories filters and rejects repeats", () => {
  assert.deepEqual(parseCatalogQuery({ gender: "women" }), { gender: "women", q: "", category: "", invalid: false });
  assert.equal(parseCatalogQuery({ gender: "men", category: "accessories" }).invalid, false);
  for (const gender of ["admin", "unisex", ["women", "men"]]) assert.equal(parseCatalogQuery({ gender }).invalid, true);
});
test("editorial wardrobe categories are accepted by the catalog boundary", () => {
  for (const category of ["tops", "bottoms", "outerwear"]) {
    assert.deepEqual(parseCatalogQuery({ category }), { q: "", category, invalid: false });
  }
});
test("rejects repeated, oversized, and unknown query inputs", () => {
  for (const params of [{ q: ["a", "b"] }, { q: "x".repeat(101) }, { category: "../invalid" }, { category: ["everyday"] }]) {
    assert.equal(parseCatalogQuery(params).invalid, true);
  }
});
test("normalizes Vietnamese search with or without diacritics", () => {
  assert.equal(normalizeSearchInput("Áo Khoác"), "ao khoac");
  assert.equal(normalizeSearchInput("ao khoac"), "ao khoac");
  assert.equal(normalizeSearchInput("  wide   leg\n trousers  "), "wide leg trousers");
});
test("keeps a bounded trimmed query for URL-backed search", () => {
  assert.deepEqual(parseCatalogQuery({ q: "  cardigan  ", page: "2" }), { q: "cardigan", category: "", invalid: false, page: 2 });
});
