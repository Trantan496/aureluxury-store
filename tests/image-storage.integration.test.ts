import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProductService, type ProductDataTransaction, type ServiceResult } from "../src/features/products/product-service.ts";
import { readPublishedImage } from "../src/features/products/image-storage.ts";
import { assertTestDatabase, testTarget } from "../scripts/test-database-safety.ts";
function ok<T>(result: ServiceResult<T>) { if (!result.ok) throw new Error(result.error.code); return result.data; }
test("database image storage authorizes before reading, paginates without blobs and gates publication", { timeout: 60000 }, async () => {
  const target = testTarget(process.env.TEST_DATABASE_URL, process.env.TEST_DATABASE_CONFIRM);
  assert.equal(process.env.NODE_ENV, "test"); assert.equal(process.env.DATABASE_URL, target.toString());
  const gate = new pg.Client({ connectionString: target.toString() }); await gate.connect(); await assertTestDatabase(sql => gate.query(sql));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
  const rollback = new Error("Image fixture rollback"), prefix = "image-" + randomBytes(5).toString("hex");
  try {
    await assert.rejects(db.$transaction(async tx => {
      const admin = await tx.user.create({ data: { email: prefix + "@test.invalid", role: "ADMIN", fullName: "Isolated image test" } });
      const customer = await tx.user.create({ data: { email: prefix + "-c@test.invalid", role: "CUSTOMER", fullName: "Isolated image test" } });
      let actor: number | null = null, read = false;
      const service = createProductService({ resolveSession: async () => actor ? { userId: actor, expiresAt: Date.now() + 60000 } : null, transaction: <T>(work: (t: ProductDataTransaction) => Promise<T>) => work(tx) });
      const input = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#ffffff" } }).png().toBuffer();
      const readFile = async () => { read = true; return input; };
      assert.equal((await service.imageUpload(readFile)).ok, false); assert.equal(read, false);
      actor = customer.id; const denied = await service.imageUpload(readFile); assert.equal(denied.ok, false); assert.equal(read, false);
      assert.equal((await service.imageLibrary()).ok, false);
      actor = admin.id; const saved = ok(await service.imageUpload(readFile)); assert.equal(read, true);
      const library = ok(await service.imageLibrary()); assert.ok(library.rows.some(i => i.id === saved.id)); assert.ok(!("data" in library.rows[0]));
      assert.equal(ok(await service.imageStored(saved.id)).length, saved.byteSize);
      assert.equal(await readPublishedImage(tx, saved.storageKey), null);
      const category = await tx.category.create({ data: { name: prefix, slug: prefix } });
      const product = await tx.product.create({ data: { name: prefix, slug: prefix, categoryId: category.id, isActive: true } });
      const image = await tx.productImage.create({ data: { productId: product.id, storageKey: saved.storageKey, websitePermission: "unknown" } });
      assert.equal(ok(await service.imageLibrary(1, prefix.toUpperCase())).total, 1);
      assert.equal(ok(await service.imageLibrary(1, prefix)).rows[0].storageKey, saved.storageKey);
      assert.equal(ok(await service.imageLibrary(1, "no-such-product")).total, 0);
      assert.equal(ok(await service.imageLibrary(1, "%")).total, 0);
      assert.equal(ok(await service.imageLibrary(1, "' OR 1=1 --")).total, 0);
      await tx.product.update({ where: { id: product.id }, data: { name: prefix + " renamed" } });
      assert.equal(ok(await service.imageLibrary(1, "renamed")).total, 1);
      actor = customer.id; assert.equal((await service.imageLibrary(1, prefix)).ok, false); actor = admin.id;
      assert.equal(await readPublishedImage(tx, saved.storageKey), null);
      await tx.productImage.update({ where: { id: image.id }, data: { websitePermission: "granted", rightsReference: "Test explicit rights" } });
      assert.equal((await readPublishedImage(tx, saved.storageKey))?.length, saved.byteSize);
      await tx.product.update({ where: { id: product.id }, data: { isActive: false } }); assert.equal(await readPublishedImage(tx, saved.storageKey), null);
      await tx.product.update({ where: { id: product.id }, data: { isActive: true } });
      await tx.productImage.update({ where: { id: image.id }, data: { websitePermission: "denied" } }); assert.equal(await readPublishedImage(tx, saved.storageKey), null);
      throw rollback;
    }, { timeout: 30000 }), error => error === rollback);
  } finally { await db.$disconnect(); await gate.end(); }
});
