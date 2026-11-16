import test from "node:test";
import assert from "node:assert/strict";
import { formatAurelProductName } from "../src/features/products/product-name.ts";
import {
  normalizeSearchText,
  tokenizeSearchQuery,
  rankCatalogProducts,
  type ScorableProduct,
} from "../src/features/catalog/search-ranking.ts";

test("Case 1: formatAurelProductName guarantees AUREL - UPPERCASE NAME format and strips numbers", () => {
  assert.equal(formatAurelProductName("Brown Trench Coat (Nam)"), "AUREL - BROWN TRENCH COAT (NAM)");
  assert.equal(formatAurelProductName("11. Navy Bomber Jacket (Nam)"), "AUREL - NAVY BOMBER JACKET (NAM)");
  assert.equal(formatAurelProductName("AUREL — Élan Long Coat 02"), "AUREL - ÉLAN LONG COAT");
  assert.equal(formatAurelProductName("aurel - soft knit"), "AUREL - SOFT KNIT");
  assert.equal(formatAurelProductName("TEST thanh toán payOS 1.000đ — Không giao hàng"), "AUREL - TEST THANH TOÁN PAYOS — KHÔNG GIAO HÀNG");
  assert.equal(formatAurelProductName("   Aurel    Everyday   Tote   "), "AUREL - EVERYDAY TOTE");
  assert.equal(formatAurelProductName(""), "");
  assert.equal(formatAurelProductName(null), "");
});

test("Case 2: normalizeSearchText and tokenizeSearchQuery handle Vietnamese accents and stop words", () => {
  assert.equal(normalizeSearchText("Áo Khoác Dạ Ngắn"), "ao khoac da ngan");
  assert.equal(normalizeSearchText("AUREL Cozy Bow Fleece Jacket - Ivory Cream"), "aurel cozy bow fleece jacket ivory cream");
  assert.deepEqual(tokenizeSearchQuery("Tìm mua Áo Khoác Nâu"), ["ao", "khoac", "nau"]);
  assert.deepEqual(tokenizeSearchQuery("wide leg trousers size M"), ["wide", "leg", "trousers", "size", "m"]);
});

test("Case 3: exact title match is ranked Top 1", () => {
  const products: ScorableProduct[] = [
    { name: "AUREL Everyday Tote", category: { name: "Phụ kiện" } },
    { name: "AUREL Tailored Coat", category: { name: "Áo khoác" } },
    { name: "AUREL Soft Knit", category: { name: "Áo len" } },
  ];

  const ranked = rankCatalogProducts(products, "Tailored Coat");
  assert.equal(ranked[0].name, "AUREL Tailored Coat");
});

test("Case 4: word order independence ranks correct product Top 1 when tokens are permuted", () => {
  const products: ScorableProduct[] = [
    { name: "AUREL Soft Knit", category: { name: "Áo len" }, variants: [{ color: "Cream" }] },
    { name: "AUREL Brown Trench Coat (Nam)", category: { name: "Áo khoác" }, variants: [{ color: "Brown" }] },
    { name: "AUREL Relaxed Trouser", category: { name: "Quần" }, variants: [{ color: "Taupe" }] },
  ];

  // Searching "trench coat nâu" (permuted words, Vietnamese + English)
  const ranked1 = rankCatalogProducts(products, "trench coat nâu");
  assert.equal(ranked1[0].name, "AUREL Brown Trench Coat (Nam)");

  // Searching "nâu coat trench"
  const ranked2 = rankCatalogProducts(products, "nâu coat trench");
  assert.equal(ranked2[0].name, "AUREL Brown Trench Coat (Nam)");
});

test("Case 5: cross-language fashion synonyms expand Vietnamese to English catalog terms", () => {
  const products: ScorableProduct[] = [
    { name: "AUREL Denim Trousers", category: { name: "Quần" } },
    { name: "AUREL Navy Bomber Jacket (Nam)", category: { name: "Áo khoác" } },
    { name: "AUREL Silk Scarf", category: { name: "Phụ kiện" } },
  ];

  // User enters Vietnamese keyword "áo khoác"
  const ranked = rankCatalogProducts(products, "áo khoác");
  assert.equal(ranked[0].name, "AUREL Navy Bomber Jacket (Nam)");
});

test("Case 6: SKU exact match ranks target product Top 1", () => {
  const products: ScorableProduct[] = [
    { name: "AUREL Soft Knit", variants: [{ sku: "AUR-101010" }] },
    { name: "AUREL Brown Trench Coat", variants: [{ sku: "AUR-188760250001" }] },
    { name: "AUREL Bomber Jacket", variants: [{ sku: "AUR-999999" }] },
  ];

  const ranked = rankCatalogProducts(products, "AUR-188760250001");
  assert.equal(ranked[0].name, "AUREL Brown Trench Coat");
});
