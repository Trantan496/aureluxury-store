import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import { testTarget, testRole, fingerprint } from "./test-database-safety.ts";

const name = process.argv[2];
assert.match(name ?? "", /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
assert.equal(process.argv[3], "--confirm-restore-test=" + name);
const url = testTarget(parse(readFileSync(".env.test")).TEST_DATABASE_URL, "aurel_ai_test"); url.pathname = "/" + name;
const clients = [0,1,2].map(() => new pg.Client({ connectionString: url.toString(), options: "-c statement_timeout=10s -c lock_timeout=3s" }));
const [control, first, second] = clients;
async function guard(client: pg.Client) { assert.deepEqual((await client.query("SELECT current_database() AS name,current_user AS role")).rows[0], { name, role: testRole }); }
let user = 0, product = 0, category = 0, order = 0;
let baseline: Awaited<ReturnType<typeof fingerprint>> | undefined;
try {
  for (const client of clients) { await client.connect(); await guard(client); }
  baseline = await fingerprint(control);
  await control.query("BEGIN");
  user = (await control.query(`INSERT INTO "User" (email,"fullName","updatedAt") VALUES ('race-review@test.invalid','Test',NOW()) RETURNING id`)).rows[0].id;
  category = (await control.query(`INSERT INTO "Category" (name,slug) VALUES ('Race review','race-review') RETURNING id`)).rows[0].id;
  product = (await control.query(`INSERT INTO "Product" (name,slug,"categoryId") VALUES ('Race review','race-review',$1) RETURNING id`, [category])).rows[0].id;
  const items: number[] = [];
  order = (await control.query(`INSERT INTO "Order" ("orderNumber","userId",currency,"totalAmount","shippingName","shippingPhone","shippingAddress") VALUES ('race-review',$1,'USD',0,'Test','0','Test') RETURNING id`, [user])).rows[0].id;
  for (const suffix of ["a","b"]) {
    const variant = (await control.query(`INSERT INTO "ProductVariant" ("productId",sku,color,size,stock) VALUES ($1,$2,$2,'M',1) RETURNING id`,[product,"race-review-"+suffix])).rows[0].id;
    items.push((await control.query(`INSERT INTO "OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,currency,"unitPrice","lineTotal") VALUES ($1,$2,'Test','Test','Test','M',1,'USD',0,0) RETURNING id`,[order,variant])).rows[0].id);
  }
  await control.query("COMMIT");
  for (const client of [first,second]) { await guard(client); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); await client.query(`SELECT id FROM "OrderItem" WHERE "orderId"=$1`,[order]); }
  await first.query(`DELETE FROM "OrderItem" WHERE id=$1`,[items[0]]);
  await second.query(`DELETE FROM "OrderItem" WHERE id=$1`,[items[1]]);
  await first.query("COMMIT");
  let secondCode: string | null = null;
  try { await second.query("COMMIT"); } catch (error) { secondCode = (error as {code:string}).code; await second.query("ROLLBACK"); }
  const remaining = (await control.query(`SELECT count(*)::int AS n FROM "OrderItem" WHERE "orderId"=$1`,[order])).rows[0].n;
  const report = { restore: name, isolation: "REPEATABLE READ", secondCommitError: secondCode, remainingItems: remaining,
    invariantBypassReproduced: secondCode === null && remaining === 0, productionApproved: false };
  writeFileSync(`.local/backups/${name}.concurrency-review.json`, JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await first.query("ROLLBACK").catch(() => {}); await second.query("ROLLBACK").catch(() => {});
  await control.query("ROLLBACK").catch(() => {});
  try {
    if (user) {
      await guard(control); await control.query("BEGIN");
      await control.query(`DELETE FROM "OrderItem" WHERE "orderId"=$1`,[order]);
      await control.query(`DELETE FROM "Order" WHERE id=$1`,[order]);
      await control.query(`DELETE FROM "ProductVariant" WHERE "productId"=$1`,[product]);
      await control.query(`DELETE FROM "Product" WHERE id=$1`,[product]);
      await control.query(`DELETE FROM "Category" WHERE id=$1`,[category]);
      await control.query(`DELETE FROM "User" WHERE id=$1`,[user]);
      await control.query("COMMIT");
    }
    if (baseline) assert.deepEqual((await fingerprint(control)).data, baseline.data);
  } finally { for (const client of clients) await client.end(); }
}
