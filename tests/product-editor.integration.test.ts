import { descriptionPrefix } from "../src/features/products/description.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProductService, type ProductDataTransaction, type ServiceResult } from "../src/features/products/product-service.ts";
import { editorDraft, editorPayload } from "../src/features/products/editor-state.ts";
import { extractFeatures } from "../src/features/products/feature-export.ts";
import { profile, type TaxonomyRegistry } from "../src/features/products/foundation.ts";
import { testTarget, assertTestDatabase } from "../scripts/test-database-safety.ts";
import { csvText } from "../src/features/products/management.ts";
import { importColumns, parseCsv, type ImportTable } from "../src/features/products/import-dry-run.ts";
const target = testTarget(process.env.TEST_DATABASE_URL, process.env.TEST_DATABASE_CONFIRM);
assert.equal(process.env.NODE_ENV, "test"); assert.equal(process.env.DATABASE_URL, target.toString());
function ok<T>(r: ServiceResult<T>) { if (!r.ok) throw new Error(`${r.error.code}:${r.error.field ?? ""}`); return r.data; }
function denied(r: ServiceResult<unknown>, code: string) { assert.equal(r.ok, false); if (!r.ok) assert.equal(r.error.code, code); }
async function fixture() {
  const gate = new pg.Client({ connectionString: target.toString() }); await gate.connect(); await assertTestDatabase(sql => gate.query(sql));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), max: 5 }) });
  const prefix = "editor-" + randomBytes(5).toString("hex");
  return { gate, db, prefix };
}
function draft(name: string, slug: string, categoryId: number) {
  return { name, slug, categoryId, productCode: "FORGED", collection: null, brand: "AUREL", description: null, isActive: false, ageGroup: "gen-z", options: { gender: "men" } as Record<string, unknown>, variants: [{ sku: "FORGED-SKU", color: "black", size: "M", stock: 1, isActive: true, prices: { VND: "120000", USD: "12.10", EUR: "" } }], images: [{ storageKey: "/images/test.jpg", altText: null, variantSku: "FORGED-SKU", sortOrder: 0, imageType: "front", isPrimary: true, sourceReference: null, rightsReference: null, websitePermission: "unknown", embeddingPermission: "unknown", trainingPermission: "unknown" }] };
}
test("concurrent creation allocates unique authoritative codes, stable rename and SKUs", { timeout: 60000 }, async () => {
  const { gate, db, prefix } = await fixture(); let categoryId = 0, userId = 0;
  try {
    userId = (await db.user.create({ data: { email: `${prefix}@test.invalid`, role: "ADMIN", fullName: "Isolated test" } })).id;
    categoryId = (await db.category.create({ data: { name: prefix, slug: prefix } })).id;
    const service = createProductService({ resolveSession: async () => ({ userId, expiresAt: Date.now() + 60000 }), transaction: work => db.$transaction(work, { isolationLevel: "Serializable", timeout: 20000 }) });
    const name = `Áo sơ mi linen oversized ${prefix}`;
    const created = (await Promise.all([service.managementSave(draft(name, prefix + "-a", categoryId)), service.managementSave(draft(name, prefix + "-b", categoryId))])).map(ok);
    assert.equal(new Set(created.map(p => p.productCode)).size, 2);
    assert.ok(created.every(p => p.productCode?.startsWith("AUR-SML-OVS-EDI-")));
    assert.ok(created.every(p => p.variants[0].sku.startsWith(p.productCode!) && p.variants[0].sku !== "FORGED-SKU"));
    assert.ok(created.every(p => p.images[0].variantId === p.variants[0].id)); assert.ok(created.every(p => p.profile?.ageGroup === "gen-z" && p.slug.includes("nam-gen-z")));
    const input = editorPayload(editorDraft(created[0]), true); input.name = "Tên mới hoàn toàn"; input.brand = null; input.description = descriptionPrefix + "**Linen**\n\nMềm và thoáng"; input.productCode = "FORGED"; input.variants[0].sku = "CHANGED";
    const renamed = ok(await service.managementSave(input, created[0].id, created[0].version));
    assert.equal(renamed.description, input.description); assert.equal(renamed.brand, null); assert.equal(editorDraft(renamed).brand, ""); assert.equal(renamed.slug, created[0].slug); assert.equal(renamed.productCode, created[0].productCode); assert.equal(renamed.variants[0].sku, created[0].variants[0].sku);
    denied(await service.managementSave(input, created[0].id, created[0].version), "CONFLICT");
    const remove = editorPayload(editorDraft(renamed), true); remove.images = [];
    remove.removedImageIds = [created[1].images[0].id];
    denied(await service.managementSave(remove, renamed.id, renamed.version), "INVALID_INPUT");
    assert.equal(await db.productImage.count({ where: { productId: renamed.id } }), 1);
    remove.removedImageIds = [renamed.images[0].id]; remove.brand = "Updated while removing";
    const removed = ok(await service.managementSave(remove, renamed.id, renamed.version));
    assert.equal(removed.images.length, 0); assert.equal(removed.brand, "Updated while removing");
    assert.equal(await db.productImage.count({ where: { productId: created[1].id } }), 1);
    const duplicate = ok(await service.managementSave(draft(name, "forged-client-slug", categoryId))); assert.notEqual(duplicate.slug, created[0].slug); assert.notEqual(duplicate.slug, "forged-client-slug");
    assert.equal(await db.product.count({ where: { categoryId } }), 3);
    await assert.rejects(db.product.update({ where: { id: created[1].id }, data: { productCode: renamed.productCode } }));
    await assert.rejects(db.productVariant.update({ where: { id: created[1].variants[0].id }, data: { sku: renamed.variants[0].sku } }));
  } finally {
    await assertTestDatabase(sql => gate.query(sql));
    if (categoryId) {
      const scope = { product: { categoryId } };
      await db.productImage.deleteMany({ where: scope }); await db.productPrice.deleteMany({ where: { variant: scope } }); await db.productProfile.deleteMany({ where: scope }); await db.productVariant.deleteMany({ where: scope });
      await db.product.deleteMany({ where: { categoryId } }); await db.category.delete({ where: { id: categoryId, slug: prefix } });
    }
    if (userId) await db.user.delete({ where: { id: userId, email: `${prefix}@test.invalid` } });
    await db.$disconnect(); await gate.end();
  }
});
test("shared taxonomy persists across operations, rejects duplicates/customer and exports custom data", { timeout: 60000 }, async () => {
  const { gate, db, prefix } = await fixture(); const rollback = new Error("Intentional fixture rollback");
  try {
    await assert.rejects(db.$transaction(async tx => {
      const admin = await tx.user.create({ data: { email: `${prefix}@test.invalid`, role: "ADMIN", fullName: "Isolated" } });
      const customer = await tx.user.create({ data: { email: `${prefix}-customer@test.invalid`, role: "CUSTOMER", fullName: "Isolated" } });
      const category = await tx.category.create({ data: { name: prefix, slug: prefix } }); let actor = admin.id;
      const dependencies = { resolveSession: async () => ({ userId: actor, expiresAt: Date.now() + 60000 }), transaction: <T>(work: (data: ProductDataTransaction) => Promise<T>) => work(tx) };
      const first = createProductService(dependencies), second = createProductService(dependencies);
      const label = `Lụa tơ tằm ${prefix}`;
      const added = ok(await first.managementAddOption({ key: "fabric", label }));
      denied(await first.managementAddOption({ key: "collar", label: "CO TRON" }), "INVALID_INPUT");
      const feed = ok(await second.managementTaxonomy()); assert.equal(feed.extended, true); assert.ok(feed.values.fabric.some(o => o.token === added.token));
      denied(await second.managementAddOption({ key: "fabric", label: label.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }), "INVALID_INPUT");
      actor = customer.id; denied(await second.managementTaxonomy(), "FORBIDDEN"); denied(await second.managementAddOption({ key: "fabric", label: "Forbidden" }), "FORBIDDEN"); actor = admin.id;
      const value = draft(prefix, prefix, category.id); value.options = { fabric: added.token, styleTags: ["not-applicable"] };
      const saved = ok(await first.managementSave(value)); assert.equal(saved.profile?.fabric, added.token); assert.deepEqual(saved.profile?.styleTags, ["not-applicable"]);
      const registry = Object.fromEntries(Object.entries(feed.values).map(([k, entries]) => [k, entries.map(o => o.token)])) as TaxonomyRegistry;
      const features = extractFeatures({ id: saved.id, category, description: null, isActive: false, profile: profile(value.options, registry), variants: saved.variants, images: saved.images }, "embedding", registry);
      assert.equal(features.features.fabric, added.token); assert.deepEqual(features.features.style_tags, ["not-applicable"]);
      assert.equal(features.schema_version, "aurel-product-features-v2"); assert.equal(saved.profile?.taxonomyVersion, "aurel-fashion-v2");
      const csv = ok(await second.managementExport({ page: 1 })); assert.ok(csv.files.product_options.includes(added.token));
      const files = Object.fromEntries((Object.keys(importColumns) as ImportTable[]).map(table => [table, csvText(table, parseCsv(csv.files[table]).map(row => ({ ...row, ...(row.product_code ? { product_code: "AUR-ROUNDTRIP-001" } : {}), ...(table === "products" ? { slug: prefix + "-roundtrip" } : {}), ...(row.sku ? { sku: "ROUNDTRIP-SKU" } : {}) })))]));
      const preview = ok(await second.managementImport(files)); assert.equal(preview.report.valid, true);
      assert.equal(ok(await second.managementImport(files, preview.token)).imported, 1);
      // Registry is append-only: roll back the entire isolated transaction, never disable guards.
      throw rollback;
    }, { isolationLevel: "Serializable", timeout: 30000 }), error => error === rollback);
    assert.equal(await db.taxonomyOption.count({ where: { token: { contains: prefix } } }), 0);
    assert.equal(await db.user.count({ where: { email: { startsWith: prefix } } }), 0);
  } finally { await db.$disconnect(); await gate.end(); }
});
