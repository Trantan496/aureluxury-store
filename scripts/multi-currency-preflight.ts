import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import pg from "pg";
import { fingerprint, reviewedMigrations, testTarget, testRole } from "./test-database-safety.ts";
import { prepareLegacyRehearsal, verifyLegacyRehearsal } from "./multi-currency-rehearsal.ts";

const name = process.argv[2];
assert.match(name ?? "", /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
assert.equal(process.argv[3], "--confirm-restore-test=" + name);
reviewedMigrations();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const envBefore = hash(readFileSync(".env"));
const sourceURL = new URL(parse(readFileSync(".env")).DATABASE_URL);
assert.equal(sourceURL.pathname, "/aurel_ai");
const restoreURL = testTarget(parse(readFileSync(".env.test")).TEST_DATABASE_URL, "aurel_ai_test");
restoreURL.pathname = "/" + name;
const source = new pg.Client({ connectionString: sourceURL.toString(), options: "-c default_transaction_read_only=on -c timezone=UTC" });
const restored = new pg.Client({ connectionString: restoreURL.toString(), options: "-c timezone=UTC" });
const blocker = new pg.Client({ connectionString: restoreURL.toString() });
const archive = `.local/backups/${name}.dump`;
const verified = JSON.parse(readFileSync(archive + ".verified.json", "utf8"));
const sql = readFileSync("prisma/migrations/20261020160500_multi_currency/migration.sql", "utf8");
let before: Awaited<ReturnType<typeof fingerprint>> | undefined;
const checks: string[] = [];
async function guard(client = restored) {
  assert.deepEqual((await client.query("SELECT current_database() AS name,current_user AS role")).rows[0], { name, role: testRole });
}
async function rejected(label: string, expectedCode: string, work: () => Promise<unknown>) {
  await guard();
  await restored.query("SAVEPOINT negative_case");
  let code: unknown;
  try { await work(); } catch (error) { code = (error as { code?: string }).code; }
  await restored.query("ROLLBACK TO SAVEPOINT negative_case");
  await restored.query("RELEASE SAVEPOINT negative_case");
  assert.equal(code, expectedCode, label);
  checks.push(label);
}
try {
  await source.connect(); await restored.connect(); await blocker.connect();
  assert.equal((await source.query("SELECT current_database() AS name")).rows[0].name, "aurel_ai");
  await guard(); await guard(blocker);
  assert.equal(verified.database, name); assert.equal(verified.source, "aurel_ai");
  assert.equal(verified.schemaAndDataMatch, true);
  assert.equal(hash(readFileSync(archive)), verified.archiveSHA256);
  before = await fingerprint(source);
  assert.equal(hash(JSON.stringify(before)), verified.sourceFingerprintSHA256, "Source must still match this fresh verified backup");
  assert.deepEqual(await fingerprint(restored), before);
  assert.equal((await restored.query(`SELECT to_regclass('public."ProductPrice"') AS name`)).rows[0].name, null);
  const legacyCounts = Object.fromEntries(["ProductVariant", "Order", "OrderItem"].map(table => [table, before!.data[table].count]));
  const sizes = (await source.query(`SELECT relname,pg_total_relation_size(oid)::text AS bytes FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('Order','OrderItem','ProductVariant') ORDER BY relname`)).rows;
  const migrations = (await source.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows;
  // Reproduce a reader blocking DDL, only on the restored copy. No source lock is taken.
  await blocker.query("BEGIN");
  await blocker.query('LOCK TABLE public."Order" IN ACCESS SHARE MODE');
  await restored.query("SET lock_timeout='500ms'; SET statement_timeout='30s'");
  let lockCode: unknown;
  try { await restored.query(sql); } catch (error) { lockCode = (error as { code?: string }).code; }
  finally { await restored.query("ROLLBACK"); await blocker.query("ROLLBACK"); }
  assert.equal(lockCode, "55P03");
  assert.deepEqual(await fingerprint(restored), before, "Timed out DDL must roll back completely");
  checks.push("DDL lock timeout 55P03 rolls back enum/schema changes");
  await restored.query("SET lock_timeout='3s'");
  assert.equal(await prepareLegacyRehearsal(restored, name), true);
  const started = performance.now();
  await guard(); await restored.query(sql);
  const migrationMilliseconds = Math.round((performance.now() - started) * 100) / 100;
  await verifyLegacyRehearsal(restored, name);
  checks.push("Legacy 12.34 / 24.68 preserved, currencies and lineTotal NULL, no ProductPrice backfill");
  const definitions = await fingerprint(restored);
  assert.equal(definitions.triggers.length, 2);
  assert.equal(definitions.functions.filter(row => ["check_order_currency_snapshot", "enforce_order_currency_snapshot"].includes(row.proname)).length, 2);
  for (const constraint of ["ProductPrice_amount_check", "Order_money_check", "OrderItem_money_check", "ProductPrice_variantId_fkey"]) assert.ok(definitions.constraints.some(row => row.conname === constraint));
  await guard(); await restored.query("BEGIN");
  try {
    const user = (await restored.query(`INSERT INTO "User" (email,"fullName","updatedAt") VALUES ('preflight@test.invalid','Test only',NOW()) RETURNING id`)).rows[0].id;
    const category = (await restored.query(`INSERT INTO "Category" (name,slug) VALUES ('Preflight','preflight-only') RETURNING id`)).rows[0].id;
    const product = (await restored.query(`INSERT INTO "Product" (name,slug,"categoryId") VALUES ('Preflight','preflight-only',$1) RETURNING id`, [category])).rows[0].id;
    const variants: number[] = [];
    for (const suffix of ["a", "b"]) variants.push((await restored.query(`INSERT INTO "ProductVariant" ("productId",sku,color,size,stock) VALUES ($1,$2,$2,'M',10) RETURNING id`, [product, "preflight-" + suffix])).rows[0].id);
    for (const currency of ["VND", "USD", "EUR"]) {
      const price = currency === "VND" ? "10" : "0.10";
      const total = currency === "VND" ? "50" : "0.50";
      for (const id of variants) await restored.query(`INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES ($1,$2,$3,NOW())`, [id, currency, price]);
      const order = (await restored.query(`INSERT INTO "Order" ("orderNumber","userId",currency,"totalAmount","shippingName","shippingPhone","shippingAddress") VALUES ($1,$2,$3,$4,'Test','0','Test') RETURNING id`, ["preflight-" + currency,user,currency,total])).rows[0].id;
      for (let i = 0; i < 2; i++) await restored.query(`INSERT INTO "OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,currency,"unitPrice","lineTotal") VALUES ($1,$2,'Test','Test','Test','M',$3,$4,$5,$6)`, [order,variants[i],i===0?3:2,currency,price,currency==="VND"?(i===0?"30":"20"):(i===0?"0.30":"0.20")]);
      await restored.query("SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED");
      await rejected("Wrong order total rejected: " + currency,"23514",async () => { await restored.query(`UPDATE "Order" SET "totalAmount"=1 WHERE id=$1`,[order]); await restored.query("SET CONSTRAINTS ALL IMMEDIATE"); });
      await rejected("Mixed item currency rejected: " + currency,"23514",async () => { await restored.query(`UPDATE "OrderItem" SET currency=$2 WHERE "orderId"=$1`,[order,currency==="USD"?"EUR":"USD"]); await restored.query("SET CONSTRAINTS ALL IMMEDIATE"); });
      await restored.query(`UPDATE "ProductPrice" SET amount=999 WHERE currency=$1`,[currency]);
      assert.equal((await restored.query(`SELECT "totalAmount"::text AS amount FROM "Order" WHERE id=$1`,[order])).rows[0].amount,total);
      checks.push("Two-product snapshot and independent price update: " + currency);
    }
    for (const [currency,amount] of [["VND","1.5"],["USD","1.001"],["EUR","-1"],["EUR","1000000000000000000"]]) await rejected("Invalid amount rejected: "+currency+"/"+amount,"23514",()=>restored.query(`UPDATE "ProductPrice" SET amount=$2 WHERE currency=$1`,[currency,amount]));
    await rejected("Duplicate variant/currency rejected","23505",()=>restored.query(`INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES ($1,'USD',1,NOW())`,[variants[0]]));
    await rejected("Missing variant FK rejected","23503",()=>restored.query(`INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES (2147483647,'USD',1,NOW())`));
    await restored.query("SET CONSTRAINTS ALL IMMEDIATE");
  } finally { await restored.query("ROLLBACK"); }
  const after = await fingerprint(restored);
  // Comparison below uses the post-migration empty baseline; sequences intentionally increase.
  assert.deepEqual(after.data, definitions.data);
  assert.deepEqual(after.constraints, definitions.constraints); assert.deepEqual(after.triggers, definitions.triggers);
  assert.deepEqual(await fingerprint(source), before);
  assert.equal(hash(readFileSync(".env")), envBefore);
  const report = { source: "aurel_ai", restore: name, at: new Date().toISOString(), archiveSHA256: verified.archiveSHA256,
    migrationSHA256: hash(sql.replaceAll("\r\n", "\n")), migrationMilliseconds, legacyCounts, sizes, migrations, checks,
    sourceUnchanged: true, productionApproved: false, fixtureRowsRolledBack: true };
  writeFileSync(`.local/backups/${name}.preflight.json`, JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  try { if (before) assert.deepEqual(await fingerprint(source), before, "Main changed during preflight"); }
  finally { await blocker.end(); await restored.end(); await source.end(); }
}
