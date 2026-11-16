import test from "node:test";
import assert from "node:assert/strict";
import { ageGroups, audienceGroup, audienceSlug } from "../src/features/products/audience.ts";
import { editorDraft, editorPayload, draftSlug } from "../src/features/products/editor-state.ts";
import { importHeaderMatches, importColumns } from "../src/features/products/import-dry-run.ts";
import { extractFeatures } from "../src/features/products/feature-export.ts";
import { profile } from "../src/features/products/foundation.ts";
test("age groups are explicit labels, nullable and never inferred from numeric ages", () => {
  for (const option of ageGroups) assert.equal(audienceGroup(option.token), option.token);
  assert.equal(audienceGroup(undefined), null); assert.equal(audienceGroup(""), null);
  assert.throws(() => audienceGroup("18-25")); assert.throws(() => audienceGroup(18)); assert.throws(() => audienceGroup("ADMIN"));
});
test("draft slug is derived from name and audience; persisted URL stays stable", () => {
  assert.equal(audienceSlug("Áo sơ mi linen", "men", "gen-z"), "ao-so-mi-linen-nam-gen-z");
  const draft = editorDraft(null); draft.name = "Áo"; draft.options.gender = "women"; draft.ageGroup = "gen-y"; draft.slug = "forged";
  assert.equal(editorPayload(draft, false).slug, "ao-nu-gen-y"); assert.equal(editorPayload(draft, false).ageGroup, "gen-y");
  draft.persistedId = 1; draft.slug = "url-da-luu"; assert.equal(draftSlug(draft), "url-da-luu");
});
test("CSV accepts old AI headers while new schema preserves audience column", () => {
  const header = importColumns.product_ai_attributes;
  assert.ok(importHeaderMatches("product_ai_attributes", header.join(",")));
  assert.ok(importHeaderMatches("product_ai_attributes", header.slice(0, -1).join(",")));
  assert.ok(!importHeaderMatches("product_ai_attributes", "product_code,age_group"));
});
test("feature audience uses v3 and missing stays explicit, v1 remains compatible", () => {
  const source = { id: 1, category: { slug: "ao" }, description: null, isActive: false, variants: [], images: [] };
  assert.equal(extractFeatures({ ...source, profile: null }).schema_version, "aurel-product-features-v1");
  const row = extractFeatures({ ...source, profile: { ...profile({ gender: "unisex" }), ageGroup: "middle-aged" } });
  assert.equal(row.schema_version, "aurel-product-features-v3"); assert.equal(row.features.age_group, "middle-aged");
  assert.ok(extractFeatures({ ...source, profile: { ...profile({}), ageGroup: null } }).missing.includes("age_group"));
});
