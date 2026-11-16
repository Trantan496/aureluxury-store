import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import { testTarget, assertTestDatabase, fingerprint, reviewedMigrations } from "./test-database-safety.ts";
import { taxonomy, profileFields } from "../src/features/products/foundation.ts";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProductService } from "../src/features/products/product-service.ts";
import { catalogProductSelect, imageRightsSelect } from "../src/features/catalog/prisma-catalog.ts";

// Dedicated bounded migration check. No setup/grants/new databases/concurrency matrix.
const confirmation = process.argv.find(value => value.startsWith("--confirm-test-database="))?.split("=")[1];
const config = parse(readFileSync(".env.test"));
const target = testTarget(config.TEST_DATABASE_URL, confirmation);
const mainConfig = parse(readFileSync(".env"));
const mainUrl = new URL(mainConfig.DATABASE_URL);
assert.equal(mainUrl.pathname, "/aurel_ai");
assert.ok(["localhost", "127.0.0.1"].includes(mainUrl.hostname));
const hashEnv = () => createHash("sha256").update(readFileSync(".env")).digest("hex");
const originalEnv = hashEnv();
reviewedMigrations();
const main = new pg.Client({ connectionString: mainUrl.toString(), options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000 });
const db = new pg.Client({ connectionString: target.toString(), connectionTimeoutMillis: 5000 });
let before: Awaited<ReturnType<typeof fingerprint>> | undefined;
try {
  await main.connect();
  assert.equal((await main.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
  before = await fingerprint(main);
  await db.connect(); await assertTestDatabase(sql => db.query(sql));
  assert.equal((await db.query("SELECT pg_try_advisory_lock(242024) AS locked")).rows[0].locked, true);
  const access = await main.query("SELECT bool_or(has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT,UPDATE,DELETE,TRUNCATE')) AS writable FROM pg_tables WHERE schemaname='public'", ["aurel_ai_test_runner"]);
  assert.equal(access.rows[0].writable, false);
  await assertTestDatabase(sql => db.query(sql));
  const migrate = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: target.toString() }, windowsHide: true, encoding: "utf8", timeout: 120000,
  });
  // Never echo CLI stderr/config/connection strings.
  assert.equal(migrate.status, 0, "Confirmed-test migrate deploy failed; inspect test migration status");
  const migration = (await db.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
  assert.ok(migration.some(row => row.migration_name === "20261021090000_product_foundation"));
  const baseline = await fingerprint(db);
  await assertTestDatabase(sql => db.query(sql)); await db.query("BEGIN");
  // Explicit negative IDs are transaction-local and do not consume sequences.
  const ids = [-2109101, -2109102, -2109103, -2109104];
  for (const table of ["Category", "Product", "ProductVariant", "ProductImage"]) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "${table}" WHERE id = ANY($1::int[])`, [ids])).rows[0].n, 0);
  }
  async function fails(sql: string, parameters: unknown[], expected: string) {
    await assertTestDatabase(query => db.query(query)); await db.query("SAVEPOINT invalid_input");
    let code: string | undefined;
    try { await db.query(sql, parameters); } catch (error) { code = (error as { code?: string }).code; }
    await db.query("ROLLBACK TO SAVEPOINT invalid_input"); assert.equal(code, expected);
  }
  await db.query('INSERT INTO "Category" (id,name,slug) VALUES ($1,$2,$3)', [ids[0], "P291 isolated check", "p291-isolated-check"]);
  await db.query('INSERT INTO "Product" (id,name,slug,"categoryId","productCode") VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$4,$8)', [ids[0], "P291 isolated check", "p291-check-one", ids[0], "AUR-2109101", ids[1], "p291-check-two", "AUR-2109102"]);
  await fails('UPDATE "Product" SET "productCode"=$1 WHERE id=$2', ["AUR-2109101", ids[1]], "23505");
  await fails('UPDATE "Product" SET "productCode"=$1 WHERE id=$2', ["bad", ids[1]], "23514");
  assert.ok((await db.query('SELECT "updatedAt" FROM "Product" WHERE id=$1', [ids[0]])).rows[0].updatedAt);
  await db.query('INSERT INTO "ProductProfile" ("productId",gender,"updatedAt") VALUES ($1,$2,now())', [ids[0], "unisex"]);
  for (const key of profileFields) {
    const valid = taxonomy[key][0];
    await db.query(`UPDATE "ProductProfile" SET "${key}"=$1 WHERE "productId"=$2`, [key.endsWith("Tags") ? [valid] : valid, ids[0]]);
    await fails(`UPDATE "ProductProfile" SET "${key}"=$1 WHERE "productId"=$2`, [key.endsWith("Tags") ? ["invented"] : "invented", ids[0]], "23514");
  }
  await db.query('INSERT INTO "ProductVariant" (id,"productId",sku,color,size,stock) VALUES ($1,$2,$3,$4,$5,0)', [ids[0], ids[0], "P291-CHECK-M", "Black", "M"]);
  await fails('INSERT INTO "ProductVariant" (id,"productId",sku,color,size) VALUES ($1,$2,$3,$4,$5)', [ids[1], ids[0], "p291-check-m", "White", "L"], "23505");
  await fails('INSERT INTO "ProductVariant" (id,"productId",sku,color,size) VALUES ($1,$2,$3,$4,$5)', [ids[1], ids[0], "P291-OTHER", " black ", "m"], "23505");
  await fails('UPDATE "ProductVariant" SET stock=-1 WHERE id=$1', [ids[0]], "23514");
  await fails('INSERT INTO "ProductPrice" (id,"variantId",currency,amount,"updatedAt") VALUES ($1,$2,$3,$4,now())', [ids[0], ids[0], "VND", "1.01"], "23514");
  await db.query('INSERT INTO "ProductImage" (id,"productId","variantId","storageKey","isPrimary") VALUES ($1,$2,$3,$4,true)', [ids[0], ids[0], ids[0], "/images/products/p291-check.webp"]);
  await fails('INSERT INTO "ProductImage" (id,"productId","variantId","storageKey") VALUES ($1,$2,$3,$4)', [ids[1], ids[1], ids[0], "/images/products/p291-check.webp"], "23503");
  await fails('UPDATE "ProductImage" SET "embeddingPermission"=$1 WHERE id=$2', ["granted", ids[0]], "23514");
  await fails('INSERT INTO "ProductImage" (id,"productId","storageKey","isPrimary") VALUES ($1,$2,$3,true)', [ids[1], ids[0], "/images/products/p291-check.webp"], "23505");
  await db.query("ROLLBACK");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), max: 1 }) });
  const rollback = new Error("P291 rollback fixture");
  try {
    await prisma.$transaction(async tx => {
      const identity = await tx.$queryRaw<{ database: string; role: string }[]>`SELECT current_database() AS database, current_user AS role`;
      assert.equal(identity[0].database, "aurel_ai_test"); assert.equal(identity[0].role, "aurel_ai_test_runner");
      const id = 2109101;
      assert.equal(await tx.user.count({ where: { id } }), 0);
      assert.equal(await tx.product.count({ where: { id } }), 0);
      assert.equal(await tx.category.count({ where: { id } }), 0);
      assert.equal(await tx.productVariant.count({ where: { id } }), 0);
      assert.equal(await tx.productImage.count({ where: { id } }), 0);
      await tx.user.create({ data: { id, email: "p291-check@fixture.invalid", fullName: "P291 isolated fixture", role: "ADMIN" } });
      await tx.category.create({ data: { id, slug: "p291-service-check", name: "P291 fixture" } });
      await tx.product.create({ data: { id, slug: "p291-service-check", name: "P291 fixture", categoryId: id } });
      await tx.productVariant.create({ data: { id, productId: id, sku: "P291-SERVICE-M", color: "Black", size: "M", stock: 0 } });
      await tx.productImage.create({ data: { id, productId: id, storageKey: "/images/products/p291-check.webp" } });
      const publicBefore = await tx.product.findUnique({ where: { id }, select: imageRightsSelect(catalogProductSelect, true) });
      assert.equal(publicBefore?.images.length, 0);
      const service = createProductService({ resolveSession: async () => ({ userId: id, expiresAt: Date.now() + 60000 }),
        transaction: async work => work(tx), productFoundation: true, multiCurrency: false });
      const foundation = await service.setFoundation(id, { productCode: "AUR-2109101", options: { collar: "Round Neck", fabric: "Cotton", gender: "Unisex", fit: "Regular Fit" } });
      assert.equal(foundation.ok, true);
      const invalidRights = await service.setImageMetadata(id, id, { embeddingPermission: "granted" });
      assert.equal(invalidRights.ok, false);
      const image = await service.setImageMetadata(id, id, { imageType: "front", isPrimary: true, sourceReference: "fixture-owned", rightsReference: "fixture-reviewed", websitePermission: "granted", embeddingPermission: "granted", trainingPermission: "denied" }, id);
      assert.equal(image.ok, true);
      const publicAfter = await tx.product.findUnique({ where: { id }, select: imageRightsSelect(catalogProductSelect, true) });
      assert.equal(publicAfter?.images.length, 1);
      const dataset = await service.exportFeatures({ purpose: "embedding" });
      assert.equal(dataset.ok, true);
      if (dataset.ok) {
        const rows = dataset.data.jsonl.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
        const row = rows.find(row => row.product_id === String(id));
        assert.equal(row.features.fabric, "cotton"); assert.equal(row.features.image_references.length, 1);
        assert.equal("sku" in row.features, false);
      }
      const denied = createProductService({ resolveSession: async () => null, transaction: async work => work(tx), productFoundation: true });
      assert.equal((await denied.setFoundation(id, {})).ok, false);
      throw rollback;
    }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await prisma.$disconnect(); }
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(digest(await fingerprint(db)), digest(baseline), "Fixture transaction must restore test rows and sequences");
  assert.equal(digest(await fingerprint(main)), digest(before), "Main fingerprint changed");
  mkdirSync(".local/product-foundation", { recursive: true });
  writeFileSync(".local/product-foundation/check.json", JSON.stringify({ checkedAt: new Date().toISOString(), database: "aurel_ai_test", migration: "20261021090000_product_foundation", constraintsPassed: true, cleanup: "transaction rollback", mainUnchanged: true }, null, 2));
  console.log("Test migration, constraints, authorized service/feature export and rollback passed.");
} finally {
  try { await db.query("ROLLBACK"); } catch { /* Connection may not have opened. */ }
  await db.end();
  try {
    if (before) assert.equal(createHash("sha256").update(JSON.stringify(await fingerprint(main))).digest("hex"), createHash("sha256").update(JSON.stringify(before)).digest("hex"), "Main fingerprint changed");
    assert.equal(hashEnv(), originalEnv, ".env changed");
    console.log("Main rows/schema/sequences and .env unchanged.");
  } finally { await main.end(); }
}
