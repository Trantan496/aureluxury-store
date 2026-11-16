import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { testTarget, assertTestDatabase } from "../scripts/test-database-safety.ts";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProductService, type ServiceResult } from "../src/features/products/product-service.ts";
import { csvText, csvCell, parseBundle, type ManagementDTO, type AuditEvent } from "../src/features/products/management.ts";
import { importColumns, type ImportTable } from "../src/features/products/import-dry-run.ts";
import { assertAdminOrigin, readAdminJson } from "../src/features/products/admin-http.ts";

const target = testTarget(process.env.TEST_DATABASE_URL, process.env.TEST_DATABASE_CONFIRM);
assert.equal(process.env.NODE_ENV, "test"); assert.equal(process.env.DATABASE_URL, target.toString());
function ok<T>(result: ServiceResult<T>): T { if (!result.ok) throw new Error(`Unexpected ${result.error.code}:${result.error.field ?? ""}`); return result.data; }
function denied(result: ServiceResult<unknown>, code: string) { assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, code); }
function inputOf(p: ManagementDTO) {
  return { productCode: p.productCode, name: p.name, slug: p.slug, categoryId: p.categoryId, collection: p.collection, description: p.description, brand: p.brand, isActive: p.isActive,
    options: p.profile ? Object.fromEntries(["collar", "fabric", "gender", "fit", "garmentType", "styleTags", "seasonTags", "occasionTags", "layerRole", "pattern", "silhouette"].map(k => [k, p.profile![k as keyof typeof p.profile]])) : {},
    variants: p.variants.map(v => ({ id: v.id, sku: v.sku, color: v.color, size: v.size, stock: v.stock, isActive: v.isActive, prices: Object.fromEntries(v.prices.map(p => [p.currency, p.amount])) })),
    images: p.images.map(i => ({ id: i.id, storageKey: i.storageKey, altText: i.altText, sortOrder: i.sortOrder, variantSku: p.variants.find(v => v.id === i.variantId)?.sku ?? "", imageType: i.imageType, isPrimary: i.isPrimary, sourceReference: i.sourceReference, rightsReference: i.rightsReference, websitePermission: i.websitePermission, embeddingPermission: i.embeddingPermission, trainingPermission: i.trainingPermission })) };
}
test("ADMIN product management on guarded PostgreSQL", { timeout: 120000 }, async t => {
  const gate = new pg.Client({ connectionString: target.toString() }); await gate.connect(); await assertTestDatabase(sql => gate.query(sql));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), max: 5 }) });
  const suffix = randomBytes(5).toString("hex"), prefix = "p292-" + suffix;
  const userId = 1000000000 + parseInt(suffix.slice(0, 6), 16), customerId = userId + 1;
  const events: AuditEvent[] = [];
  let actor: number | null = userId, auditFailure = false, categoryId = 0, usersCreated = false, orderId = 0;
  const service = createProductService({ resolveSession: async () => actor === null ? null : { userId: actor, expiresAt: Date.now() + 60000 }, audit: async e => { if (auditFailure) throw new Error("audit unavailable"); events.push(e); }, transaction: work => db.$transaction(async tx => {
    const identity = await tx.$queryRaw<{ database: string; role: string }[]>`SELECT current_database() AS database,current_user AS role`;
    assert.equal(identity[0].database, "aurel_ai_test"); assert.equal(identity[0].role, "aurel_ai_test_runner");
    return work(tx);
  }, { isolationLevel: "Serializable", timeout: 20000 }) });
  let sequence = 0;
  const draft = () => { const n = ++sequence; return { productCode: "AUR-" + Date.now().toString().slice(-10) + n, name: `${prefix}-${n}`, slug: `${prefix}-${n}`, categoryId, collection: "test-collection", description: "Isolated test fixture", brand: null, isActive: false, options: { gender: "unisex", fabric: "cotton" }, variants: [{ sku: `${prefix}-${n}`.toUpperCase(), color: "black", size: "M", stock: 2, isActive: true, prices: { VND: "120000", USD: "12.10", EUR: "11.00" } }], images: [{ storageKey: "/images/p292-test-only.jpg", altText: "Test only", sortOrder: 0, variantSku: "", imageType: "front", isPrimary: true, sourceReference: null, rightsReference: null, websitePermission: "unknown", embeddingPermission: "unknown", trainingPermission: "unknown" }] }; };
  let product: ManagementDTO;
  try {
    await assertTestDatabase(sql => gate.query(sql));
    await db.user.createMany({ data: [{ id: userId, email: `${prefix}@test.invalid`, fullName: "Isolated ADMIN", role: "ADMIN" }, { id: customerId, email: `${prefix}-customer@test.invalid`, fullName: "Isolated customer", role: "CUSTOMER" }] }); usersCreated = true;
    categoryId = (await db.category.create({ data: { name: prefix, slug: prefix } })).id;
    await t.test("every management operation rejects anonymous and CUSTOMER actors", async () => {
      for (const identity of [null, customerId]) {
        actor = identity;
        for (const operation of [() => service.managementList(), () => service.managementCategories({ q: "" }), () => service.managementGet(1), () => service.managementRemoveImage(1, 1, "x"), () => service.managementSave(draft()), () => service.managementStatus(1, "x", false), () => service.managementDelete(1, "x", "AUR-1234"), () => service.managementImport({}), () => service.managementExport({}), () => service.managementCategory({ name: prefix, slug: prefix })]) denied(await operation(), identity === null ? "UNAUTHENTICATED" : "FORBIDDEN");
      }
      actor = userId;
    });
    await t.test("aggregate validation, SKU uniqueness, ownership and failed writes roll back", async () => {
      const value = draft();
      assert.ok(ok(await service.managementCategories({ q: prefix })).rows.some(c => c.id === categoryId));
      denied(await service.managementSave({ ...value, role: "ADMIN" }), "INVALID_INPUT");
      denied(await service.managementSave({ ...value, variants: [{ ...value.variants[0], prices: { VND: "1.50" } }] }), "INVALID_INPUT");
      denied(await service.managementSave({ ...value, variants: [value.variants[0], value.variants[0]] }), "INVALID_INPUT");
      product = ok(await service.managementSave(value));
      const other = draft(); other.variants[0].sku = value.variants[0].sku;
      const authoritative = ok(await service.managementSave(other));
      assert.notEqual(authoritative.variants[0].sku, product.variants[0].sku);
      assert.notEqual(authoritative.variants[0].sku, other.variants[0].sku);
      await assert.rejects(db.productVariant.update({ where: { id: authoritative.variants[0].id }, data: { sku: product.variants[0].sku } }));
      denied(await service.managementRemoveImage(product.id, 2147483646, product.version), "NOT_FOUND");
      const extra = inputOf(product); const image = Object.fromEntries(Object.entries(extra.images[0]).filter(([key]) => key !== "id"));
      product = ok(await service.managementSave({ ...extra, images: [...extra.images, { ...image, isPrimary: false }] }, product.id, product.version));
      product = ok(await service.managementRemoveImage(product.id, product.images[1].id, product.version));
      assert.equal(product.images.length, 1);
      const changed = inputOf(product); changed.variants[0].id = 2147483646;
      denied(await service.managementSave(changed, product.id, product.version), "INVALID_INPUT");
    });
    await t.test("concurrent saves allow one winner and reject stale stock overwrites", async () => {
      const a = inputOf(product), b = inputOf(product); a.variants[0].stock = 3; b.variants[0].stock = 4;
      const results = await Promise.all([service.managementSave(a, product.id, product.version), service.managementSave(b, product.id, product.version)]);
      assert.equal(results.filter(r => r.ok).length, 1); denied(results.find(r => !r.ok)!, "CONFLICT");
      denied(await service.managementSave(a, product.id, product.version), "CONFLICT");
      product = ok(await service.managementGet(product.id));
    });
    await t.test("CSV preview binds content, confirms atomically and refuses duplicate/replayed imports", async () => {
      const value = draft();
      const files = Object.fromEntries(Object.keys(importColumns).map(k => [k, importColumns[k as ImportTable].join(",")])) as Record<ImportTable, string>;
      files.products = csvText("products", [{ product_code: value.productCode, name: prefix, slug: value.slug, category_slug: prefix, collection: "", description: "", is_active: false }]);
      files.product_variants = csvText("product_variants", [{ product_code: value.productCode, sku: value.variants[0].sku, color: "black", size: "M", stock: 1, is_active: true }]);
      const before = await db.product.count();
      const preview = ok(await service.managementImport(files)); assert.equal(preview.report.valid, true); assert.equal(await db.product.count(), before);
      denied(await service.managementImport({ ...files, products: files.products.replace(prefix, prefix + "-changed") }, preview.token), "CONFLICT");
      const imported = ok(await service.managementImport(files, preview.token)); assert.equal(imported.imported, 1);
      denied(await service.managementImport(files, preview.token), "CONFLICT");
      const duplicate = ok(await service.managementImport(files)); assert.equal(duplicate.report.valid, false); assert.ok(duplicate.report.errors.some(e => e.field === "product_code"));
      const exported = ok(await service.managementExport({ page: 1 })); assert.ok(exported.files.products.includes(value.productCode));
    });
    await t.test("archive/restore preserves records and validates active variants", async () => {
      product = ok(await service.managementStatus(product.id, product.version, true)); assert.equal(product.isActive, true);
      const { findProductDetail, findCatalogProducts } = await import("../src/lib/db/queries/products.ts");
      const { toProductDetail } = await import("../src/features/catalog/product-detail.ts");
      const where = { slug: product.slug, isActive: true as const };
      process.env.MULTI_CURRENCY_ENABLED = "false";
      let detail = toProductDetail((await findProductDetail(where, "USD"))!);
      assert.deepEqual(detail.variants[0].price, {amount:"120000",currency:"VND"}); assert.equal(detail.images.length, 0);
      process.env.MULTI_CURRENCY_ENABLED = "true";
      detail = toProductDetail((await findProductDetail(where, "USD"))!);
      assert.deepEqual(detail.variants[0].price, { amount: "12.10", currency: "USD" });
      const catalog = await findCatalogProducts({ q: prefix, category: "", invalid: false, currency: "VND" });
      assert.equal(catalog.find(p => p.slug === product.slug)?.price, "120000");
      const licensed = inputOf(product); licensed.images[0].websitePermission = "granted"; licensed.images[0].rightsReference = "isolated test evidence";
      product = ok(await service.managementSave(licensed, product.id, product.version));
      assert.equal(toProductDetail((await findProductDetail(where, "EUR"))!).images.length, 1);
      const noUsd = inputOf(product); delete noUsd.variants[0].prices.USD;
      product = ok(await service.managementSave(noUsd, product.id, product.version));
      assert.equal(toProductDetail((await findProductDetail(where, "USD"))!).variants[0].price, null);
      const { prisma: reader } = await import("../src/lib/db/client.ts"); await reader.$disconnect();
      process.env.MULTI_CURRENCY_ENABLED = "false";
      product = ok(await service.managementStatus(product.id, product.version, false)); assert.equal(product.isActive, false);
      assert.equal(product.variants.length, 1);
      const input = inputOf(product); input.variants[0].isActive = false;
      product = ok(await service.managementSave(input, product.id, product.version));
      denied(await service.managementStatus(product.id, product.version, true), "INVALID_INPUT");
      denied(await service.managementSave({ ...inputOf(product), isActive: true }, product.id, product.version), "INVALID_INPUT");
    });
    await t.test("permanent deletion requires code, rejects order references and fails closed without audit", async () => {
      denied(await service.managementDelete(product.id, product.version, "wrong"), "INVALID_INPUT");
      orderId = (await db.order.create({ data: { orderNumber: prefix, userId, totalAmount: "0", shippingName: "Test", shippingPhone: "Test", shippingAddress: "Test", items: { create: { variantId: product.variants[0].id, productName: prefix, sku: product.variants[0].sku, color: "black", size: "M", quantity: 1, unitPrice: "0" } } } })).id;
      denied(await service.managementDelete(product.id, product.version, product.productCode), "CONFLICT");
      await db.orderItem.deleteMany({ where: { orderId } }); await db.order.delete({ where: { id: orderId } }); orderId = 0;
      auditFailure = true; denied(await service.managementDelete(product.id, product.version, product.productCode), "DATABASE_ERROR"); auditFailure = false;
      assert.ok(await db.product.findUnique({ where: { id: product.id } }));
      const deleted = ok(await service.managementDelete(product.id, product.version, product.productCode)); assert.equal(deleted.auditCompletionRecorded, true);
      assert.deepEqual(events.map(e => e.action), ["delete_intent", "delete_committed"]);
      assert.equal(await db.product.count({ where: { id: product.id } }), 0);
    });
    await t.test("CSRF, encoding/header/size validation and spreadsheet formulas are guarded", async () => {
      assert.throws(() => assertAdminOrigin("https://evil.invalid", "http://localhost:3000", "cross-site"));
      assert.throws(() => assertAdminOrigin(null, "http://localhost:3000", null));
      assert.doesNotThrow(() => assertAdminOrigin("http://localhost:3000", "http://localhost:3000", "same-origin"));
      assert.throws(() => parseBundle({ products: "name,wrong\nfoo,bar" }));
      assert.throws(() => parseBundle({ products: "x".repeat(2_000_001) }));
      assert.ok(csvCell(" =HYPERLINK(\"bad\")").startsWith('"\''));
      await assert.rejects(readAdminJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0xff]) })));
    });
  } finally {
    await assertTestDatabase(sql => gate.query(sql));
    const owned = await db.product.findMany({ where: { categoryId, slug: { startsWith: prefix + "-" } }, select: { id: true } });
    const ids = owned.map(p => p.id);
    if (orderId) { await db.orderItem.deleteMany({ where: { orderId } }); await db.order.delete({ where: { id: orderId, orderNumber: prefix } }); }
    await db.productImage.deleteMany({ where: { productId: { in: ids } } });
    await db.productPrice.deleteMany({ where: { variant: { productId: { in: ids } } } });
    await db.productProfile.deleteMany({ where: { productId: { in: ids } } });
    await db.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await db.product.deleteMany({ where: { id: { in: ids }, categoryId, slug: { startsWith: prefix + "-" } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId, slug: prefix } });
    if (usersCreated) await db.user.deleteMany({ where: { id: { in: [userId, customerId] }, email: { in: [`${prefix}@test.invalid`, `${prefix}-customer@test.invalid`] } } });
    await db.$disconnect(); await gate.end();
  }
});
