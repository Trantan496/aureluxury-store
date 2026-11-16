import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProductTagStore, formatSemicolonTags, parseSemicolonTags } from "../src/features/products/product-tags.ts";
import { extractSearchIntent, rankCatalogProducts, type ScorableProduct } from "../src/features/catalog/search-ranking.ts";
import { categoriesForGender, clothingCategories } from "../src/features/products/category-options.ts";
import { rankComplementaryProducts, type MappableProduct } from "../src/features/catalog/outfit-mapping.ts";

test("Case 1: parseSemicolonTags & formatSemicolonTags split by semicolon, deduplicate and clean input", () => {
  const parsed = parseSemicolonTags("  áo polo ; ÁO POLO ; Polo ;  áo thun có cổ ; ; \x00áo polo  ");
  assert.deepEqual(parsed, ["áo polo", "Polo", "áo thun có cổ"]);
  assert.equal(formatSemicolonTags(parsed), "áo polo; Polo; áo thun có cổ");
});

test("Case 2: createProductTagStore persists product tags and finds exact productId for natural sentence queries", async () => {
  const tempFile = path.join(os.tmpdir(), `aurel-tags-test-${Date.now()}-${Math.random()}.json`);
  const store = createProductTagStore(tempFile);
  try {
    await store.setTagsForProduct(59, "áo polo; polo; áo thun có cổ");
    await store.setTagsForProduct(57, "áo len; áo cardigan; cardigan");

    const tags = await store.getTagsForProduct(59);
    assert.deepEqual(tags, ["áo polo", "polo", "áo thun có cổ"]);

    const matchedIds = await store.findProductIdsMatchingQuery("Hôm nay tôi muốn mua áo polo");
    assert.deepEqual(matchedIds, [59]);

    await store.deleteTagsForProduct(59);
    assert.deepEqual(await store.getTagsForProduct(59), []);
  } finally {
    await rm(tempFile, { force: true });
  }
});

test("Case 3: conversational query 'Hôm nay tôi muốn mua áo polo' ranks Polo product Top 1 via intent extraction and tags", () => {
  const intent = extractSearchIntent("Hôm nay tôi muốn mua áo polo");
  assert.deepEqual(intent.intentTokens, ["ao", "polo"]);
  assert.equal(intent.intentPhrase, "ao polo");

  const catalog: ScorableProduct[] = [
    { name: "AUREL - MERINO CARDIGAN", category: { name: "Áo" }, tags: ["áo len", "áo cardigan"] },
    { name: "AUREL - BASE TEE", category: { name: "Áo" }, tags: ["áo thun", "áo phông"] },
    { name: "AUREL - ESSENTIAL PIQUÉ POLO – IVORY", category: { name: "Áo" }, tags: ["áo polo", "polo"] },
    { name: "AUREL - BROWN TRENCH COAT (NAM)", category: { name: "Áo khoác" }, tags: ["áo khoác", "trench coat"] },
  ];

  const ranked = rankCatalogProducts(catalog, "Hôm nay tôi muốn mua áo polo");
  assert.equal(ranked[0].name, "AUREL - ESSENTIAL PIQUÉ POLO – IVORY");
});

test("Case 4: consolidated categories collapse shirt/trouser subtypes into Áo / Áo Khoác / Quần", () => {
  assert.deepEqual(
    clothingCategories.map(c => c.name),
    ["Áo", "Áo Khoác", "Quần", "Đầm", "Chân Váy", "Phụ Kiện"],
  );
  const menNames = categoriesForGender("men").map(c => c.name);
  const womenNames = categoriesForGender("women").map(c => c.name);
  assert.deepEqual(menNames, ["Áo", "Áo Khoác", "Quần", "Phụ Kiện"]);
  assert.deepEqual(womenNames, ["Áo", "Áo Khoác", "Quần", "Đầm", "Chân Váy", "Phụ Kiện"]);
});

test("Case 5: outfit complementary mapping pairs Áo -> Quần, Áo Khoác -> Áo, Quần -> Áo", () => {
  const shirt: MappableProduct = { id: "59", name: "AUREL - ESSENTIAL PIQUÉ POLO – IVORY", category: { slug: "tops", name: "Áo" }, profile: { gender: "men" } };
  const coat: MappableProduct = { id: "64", name: "AUREL - BROWN TRENCH COAT (NAM)", category: { slug: "outerwear", name: "Áo Khoác" }, profile: { gender: "men" } };
  const trousers: MappableProduct = { id: "70", name: "AUREL - WIDE-LEG TROUSERS", category: { slug: "bottoms", name: "Quần" }, profile: { gender: "men" } };
  const otherShirt: MappableProduct = { id: "58", name: "AUREL - BASE TEE", category: { slug: "tops", name: "Áo" }, profile: { gender: "unisex" } };

  const candidates = [otherShirt, coat, trousers, shirt];

  // Viewing Áo -> suggests Quần first
  const forShirt = rankComplementaryProducts([shirt], candidates, { limit: 3 });
  assert.equal(forShirt[0].id, "70");

  // Viewing Áo Khoác -> suggests Áo first
  const forCoat = rankComplementaryProducts([coat], candidates, { limit: 3 });
  assert.ok(["58", "59"].includes(forCoat[0].id));

  // Viewing Quần -> suggests Áo first
  const forTrousers = rankComplementaryProducts([trousers], candidates, { limit: 3 });
  assert.ok(["58", "59"].includes(forTrousers[0].id));
});
