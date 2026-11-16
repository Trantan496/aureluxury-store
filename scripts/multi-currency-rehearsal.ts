import type pg from "pg";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./test-database-safety.ts";
async function guard(client: pg.Client, restoreName?: string) {
  if (!restoreName) return assertTestDatabase(sql => client.query(sql));
  assert.match(restoreName, /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
  const actual = (await client.query("SELECT current_database() AS name,current_user AS role")).rows[0];
  assert.deepEqual(actual,{name:restoreName,role:"aurel_ai_test_runner"});
}
const marker = "p25-legacy-migration-rehearsal";
export async function prepareLegacyRehearsal(client: pg.Client, restoreName?: string) {
  await guard(client, restoreName);
  const applied = await client.query(`SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261020160500_multi_currency' AND finished_at IS NOT NULL`);
  if (applied.rowCount) return false;
  // Fail closed on any existing business data; never erase it.
  for (const table of ["User", "Product", "Category", "Order", "ProductVariant"]) assert.equal((await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
  await client.query("BEGIN");
  try {
    const user = (await client.query(`INSERT INTO "User" (email,"fullName","updatedAt") VALUES ($1,$1,NOW()) RETURNING id`, [marker+"@test.invalid"])).rows[0].id;
    const category = (await client.query(`INSERT INTO "Category" (name,slug) VALUES ($1,$1) RETURNING id`, [marker])).rows[0].id;
    const product = (await client.query(`INSERT INTO "Product" (name,slug,"categoryId") VALUES ($1,$1,$2) RETURNING id`, [marker,category])).rows[0].id;
    const variant = (await client.query(`INSERT INTO "ProductVariant" ("productId",sku,color,size,price,stock) VALUES ($1,$2,'Blue','M',12.34,1) RETURNING id`, [product,marker])).rows[0].id;
    const order = (await client.query(`INSERT INTO "Order" ("orderNumber","userId","totalAmount","shippingName","shippingPhone","shippingAddress") VALUES ($1,$2,24.68,'Test','0','Test') RETURNING id`, [marker,user])).rows[0].id;
    await client.query(`INSERT INTO "OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,"unitPrice") VALUES ($1,$2,$3,$3,'Blue','M',2,12.34)`, [order,variant,marker]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
export async function verifyLegacyRehearsal(client: pg.Client, restoreName?: string) {
  await guard(client, restoreName);
  const order = (await client.query(`SELECT currency,"totalAmount"::text AS amount FROM "Order" WHERE "orderNumber"=$1`,[marker])).rows[0];
  assert.deepEqual(order,{currency:null,amount:"24.68"});
  const item = (await client.query(`SELECT currency,"lineTotal","unitPrice"::text AS amount FROM "OrderItem" WHERE sku=$1`,[marker])).rows[0];
  assert.deepEqual(item,{currency:null,lineTotal:null,amount:"12.34"});
  assert.equal((await client.query(`SELECT price::text AS amount FROM "ProductVariant" WHERE sku=$1`,[marker])).rows[0].amount,"12.34");
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM "ProductPrice"`)).rows[0].n,0);
  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM "OrderItem" WHERE sku=$1`,[marker]);
    await client.query(`DELETE FROM "Order" WHERE "orderNumber"=$1`,[marker]);
    await client.query(`DELETE FROM "ProductVariant" WHERE sku=$1`,[marker]);
    await client.query(`DELETE FROM "Product" WHERE slug=$1`,[marker]);
    await client.query(`DELETE FROM "Category" WHERE slug=$1`,[marker]);
    await client.query(`DELETE FROM "User" WHERE email=$1`,[marker+"@test.invalid"]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  console.log("PASS migration rehearsal: legacy amounts preserved, currencies remain NULL, no inferred ProductPrice; scoped fixtures removed.");
}

