import test from "node:test";
import assert from "node:assert/strict";
import { codeStem, codeCandidate, productSlug } from "../src/features/products/product-code.ts";
import { editorDraft, editorPayload, newVariant, removeDraftVariant } from "../src/features/products/editor-state.ts";
import { profile, productCode } from "../src/features/products/foundation.ts";
import { customOption } from "../src/features/products/taxonomy-registry.ts";
import { editorInputFields, validateEditor } from "../src/features/products/management.ts";
import { object } from "../src/features/products/validation.ts";
import {categoriesForGender,matchingCategory,clothingCategories} from "../src/features/products/category-options.ts";

test("clothing categories follow gender without mixing editorial collections",()=>{
  const men=categoriesForGender("men"),women=categoriesForGender("women");
  assert.ok(men.some(c=>c.slug==="tops"));assert.ok(women.some(c=>c.slug==="tops"));
  assert.ok(women.some(c=>c.slug==="dam"));assert.ok(!men.some(c=>c.slug==="dam"));
  assert.equal(categoriesForGender(null).length,clothingCategories.length);
  assert.equal(categoriesForGender("unisex").length,clothingCategories.length);
  assert.equal(new Set(clothingCategories.map(c=>c.slug)).size,clothingCategories.length);
  assert.ok(!clothingCategories.some(c=>/sale|office|ban-chay|collection/.test(c.slug)));
  const rows=[{id:4,name:"Áo",slug:"legacy-shirt"}];
  assert.equal(matchingCategory(rows,clothingCategories[0])?.id,4);
});
test("Vietnamese code normalization, phrase abbreviations and bounded fallback", () => {
  assert.equal(codeCandidate(codeStem("Áo sơ mi linen oversized")), "AUR-SML-OVS-001");
  assert.equal(codeStem("  ÁO SƠ MI LINEN OVERSIZED! "), codeStem("Áo sơ mi linen oversized"));
  assert.equal(productSlug("Đầm lụa & áo"), "dam-lua-ao");
  assert.equal(codeCandidate(codeStem("✨")), "AUR-SP-001");
  assert.equal(productCode(codeCandidate(codeStem("Áo", false), 9999, false)).length, 16);
  assert.throws(() => codeCandidate("AUR-X", 10000, false));
  assert.equal(productCode("AUR-SML-OVS-1000"), "AUR-SML-OVS-1000");
});
test("copy/remove variants preserves prices as strings and image associations", () => {
  const draft = editorDraft(null), original = newVariant("a");
  original.id = 22; original.sku = "EXISTING"; original.prices.USD = "9999999999999.99";
  const copy = newVariant("b", original); assert.equal(copy.id, undefined); assert.equal(copy.sku, "");
  copy.prices.USD = "12.10"; assert.equal(original.prices.USD, "9999999999999.99");
  draft.name = "Áo sơ mi linen oversized"; draft.slug = productSlug(draft.name); draft.categoryId = "1"; draft.variants = [original, copy];
  draft.images = [{ key: "image", storageKey: "/images/a.jpg", altText: "", variantKey: "b", sortOrder: "0", imageType: "", isPrimary: true, sourceReference: "", rightsReference: "", websitePermission: "unknown", embeddingPermission: "unknown", trainingPermission: "unknown" }];
  const payload = editorPayload(draft, true); assert.equal(payload.variants[0].sku, "EXISTING"); assert.equal(payload.images[0].variantSku, payload.variants[1].sku); assert.equal(payload.variants[1].prices.USD, "12.10");
  assert.equal(removeDraftVariant(draft, "a"), draft);
  const removed = removeDraftVariant(draft, "b"); assert.equal(removed.variants.length, 1); assert.equal(removed.images[0].variantKey, "");
});
test("taxonomy values normalize accents/case, distinguish unknown and not-applicable", () => {
  assert.deepEqual(customOption("fabric", "  Lụa  tơ tằm "), { key: "fabric", token: "lua-to-tam", label: "Lụa tơ tằm" });
  assert.equal(customOption("fabric", "LUA TO TAM").token, customOption("fabric", "Lụa tơ tằm").token);
  for (const input of ["", "1", "aaa", "<script>", "12345"]) assert.throws(() => customOption("fabric", input));
  assert.throws(() => customOption("role", "ADMIN"));
  assert.equal(customOption("size", "38").token, "38");
  const registry = { fabric: ["lua-to-tam", "not-applicable"], styleTags: ["not-applicable"] };
  assert.equal(profile({}, registry).fabric, null);
  assert.equal(profile({ fabric: "not-applicable" }, registry).fabric, "not-applicable");
  assert.equal(profile({ fabric: "lua-to-tam" }, registry).fabric, "lua-to-tam");
  assert.throws(() => profile({ styleTags: ["minimal", "not-applicable"] }, registry));
});
test("aggregate editor validation rejects duplicate combinations, money and unproven rights", () => {
  const draft = editorDraft(null); draft.name = "Áo linen"; draft.slug = "ao-linen"; draft.categoryId = "1"; draft.variants = [newVariant("a")];
  const input = editorPayload(draft, true); assert.equal(validateEditor(input).variants[0].stock, 0);
  assert.throws(() => validateEditor({ ...input, variants: [...input.variants, { ...input.variants[0], sku: "OTHER" }] }));
  assert.throws(() => validateEditor({ ...input, variants: [{ ...input.variants[0], prices: { VND: "1.50" } }] }));
  assert.throws(() => validateEditor({ ...input, images: [{ storageKey: "/images/a.jpg", altText: null, sortOrder: 0, variantSku: "", imageType: null, isPrimary: true, sourceReference: null, rightsReference: null, websitePermission: "granted", embeddingPermission: "unknown", trainingPermission: "unknown" }] }));
  assert.throws(() => validateEditor({ ...input, role: "ADMIN" }));
});
test("simple upload payload expresses website use and preserves explicit denial and AI rights", () => {
  const draft = editorDraft(null);
  draft.images = [{ key: "upload", storageKey: "/images/uploads/6b5f2fe8-1ad7-4f11-af93-32bb4c83c650.webp", altText: "", variantKey: "", sortOrder: "0", imageType: "", isPrimary: true, sourceReference: "", rightsReference: "", websitePermission: "unknown", embeddingPermission: "unknown", trainingPermission: "denied" }];
  const uploaded = editorPayload(draft, true).images[0];
  assert.equal(uploaded.websitePermission, "granted"); assert.ok(uploaded.rightsReference);
  assert.equal(uploaded.embeddingPermission, "unknown"); assert.equal(uploaded.trainingPermission, "denied");
  draft.images[0].websitePermission = "denied";
  assert.equal(editorPayload(draft, true).images[0].websitePermission, "denied");
});
test("editorInputFields allows searchTags from editorPayload for prepare and pendingConvert", () => {
  const draft = editorDraft(null);
  draft.name = "AUREL - Áo Polo Len";
  draft.categoryId = "1";
  draft.searchTags = "áo polo; polo";
  const payload = editorPayload(draft, true);
  assert.equal(object(payload, editorInputFields).searchTags, "áo polo; polo");
});
