import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import { testTarget, assertTestDatabase, fingerprint } from "./test-database-safety.ts";

const confirmation = process.argv.find(a => a.startsWith("--confirm-test-database="))?.split("=")[1];
const config = parse(readFileSync(".env.test")), target = testTarget(config.TEST_DATABASE_URL, confirmation);
const mainConfig = parse(readFileSync(".env"));
const main = new pg.Client({ connectionString: mainConfig.DATABASE_URL, options: "-c default_transaction_read_only=on" });
const db = new pg.Client({ connectionString: target.toString() });
const origin = "http://localhost:3356", prefix = `shop-test-${randomBytes(6).toString("hex")}`;
const users: number[] = [], cookies: string[] = [];
const envHash = createHash("sha256").update(readFileSync(".env")).digest("hex");
let productId = 0, categoryId = 0, variantId = 0;
let server: ReturnType<typeof spawn> | undefined;
let baseline: Awaited<ReturnType<typeof fingerprint>> | undefined;
const checks: string[] = [];
async function request(path: string, cookie = "", body?: unknown, requestOrigin = origin) {
  return fetch(origin + path, { headers: { origin: requestOrigin, cookie, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}), redirect: "manual", signal: AbortSignal.timeout(20000) });
}
async function op(index: number, body: unknown, status = 200) {
  const response = await request("/api/shop", cookies[index], body); const json = await response.json();
  assert.equal(response.status, status, JSON.stringify(json)); return json.data;
}
const checkout = () => ({ action: "checkout", key: randomUUID(), name: "Test recipient", phone: "0900000000", address: "Isolated demo test address", totalAmount: "1", userId: -1 });
async function stock() { return Number((await db.query('SELECT stock FROM "ProductVariant" WHERE id=$1', [variantId])).rows[0].stock); }
try {
  await main.connect(); baseline = await fingerprint(main);
  await db.connect(); await assertTestDatabase(sql => db.query(sql));
  assert.equal((await db.query("SELECT pg_try_advisory_lock(242024) locked")).rows[0].locked, true);
  let occupied = false; try { await fetch(origin, { signal: AbortSignal.timeout(800) }); occupied = true; } catch { /* expected */ }
  assert.equal(occupied, false, "Port belongs to another process");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3356"], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", DATABASE_URL: target.toString(), BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: origin, RESEND_API_KEY: "", EMAIL_FROM: "", MULTI_CURRENCY_ENABLED: "false" } });
  let ready = false;
  for (let n = 0; n < 60; n++) { if (server.exitCode !== null) break; try { ready = (await request("/login")).status === 200; if (ready) break; } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 300)); }
  assert.equal(ready, true);
  assert.equal((await request("/api/shop")).status, 401);
  for (let index = 0; index < 3; index++) {
    const email = `${prefix}-${index}@test.invalid`, password = randomBytes(24).toString("base64url") + "A!9";
    assert.equal((await request("/api/auth/sign-up/email", "", { email, password, name: prefix })).status, 200);
    users.push((await db.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0].id);
    const login = await request("/api/auth/sign-in/email", "", { email, password }); assert.equal(login.status, 200);
    cookies.push(login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ")); assert.ok(cookies[index]);
  }
  await db.query('UPDATE "User" SET role=\'ADMIN\' WHERE id=$1', [users[2]]);
  assert.equal((await request("/api/shop?view=admin", cookies[0])).status, 403);
  assert.equal((await request("/api/shop", cookies[0], { action: "cart" }, "https://evil.invalid")).status, 403);
  checks.push("Anonymous/customer admin/CSRF denied; real Better Auth sessions");
  categoryId = (await db.query('INSERT INTO "Category" (name,slug) VALUES ($1,$1) RETURNING id', [prefix])).rows[0].id;
  productId = (await db.query('INSERT INTO "Product" (name,slug,"categoryId","isActive",brand) VALUES ($1,$1,$2,true,\'Test Brand\') RETURNING id', [prefix, categoryId])).rows[0].id;
  variantId = (await db.query('INSERT INTO "ProductVariant" ("productId",sku,color,size,stock,"isActive") VALUES ($1,$2,\'black\',\'M\',5,true) RETURNING id', [productId, prefix.toUpperCase()])).rows[0].id;
  await db.query('INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES ($1,\'VND\',120000,NOW())', [variantId]);
  await op(0, { action: "cart", variantId, quantity: -1 }, 400);
  await op(0, { action: "cart", variantId, quantity: 99 }, 409);
  await op(0, { action: "cart", variantId, quantity: 2, add: true });
  const cart = await (await request("/api/shop?view=cart", cookies[0])).json(); assert.equal(cart.data.items[0].quantity, 2);
  assert.equal((await (await request("/api/shop?view=cart", cookies[1])).json()).data.items.length, 0);
  const input = checkout();
  const [first, duplicate] = await Promise.all([op(0, input), op(0, input)]);
  assert.equal(first.id, duplicate.id); assert.equal(await stock(), 3);
  const order = (await db.query('SELECT "totalAmount",currency,"userId" FROM "Order" WHERE id=$1', [first.id])).rows[0];
  assert.equal(Number(order.totalAmount), 240000); assert.equal(order.currency, "VND"); assert.equal(order.userId, users[0]);
  assert.equal((await (await request("/api/shop?view=cart", cookies[0])).json()).data.items.length, 0);
  checks.push("Cart persists and isolates users; server price/identity; duplicate checkout creates one order and deducts once");
  await op(1, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" }, 404);
  await op(0, { action: "status", id: first.id, expected: "PENDING", status: "SHIPPED" }, 400);
  await op(0, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" });
  assert.equal(await stock(), 5);
  await op(0, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" }, 409);
  assert.equal(await stock(), 5);
  checks.push("Foreign orders hidden; invalid transitions rejected; cancellation restores stock exactly once");
  await db.query('UPDATE "ProductVariant" SET stock=1 WHERE id=$1', [variantId]);
  await op(0, { action: "cart", variantId, quantity: 1 }); await op(1, { action: "cart", variantId, quantity: 1 });
  const races = await Promise.all([request("/api/shop", cookies[0], checkout()), request("/api/shop", cookies[1], checkout())]);
  assert.deepEqual(races.map(r => r.status).sort(), [200, 409]); assert.equal(await stock(), 0);
  const winner = (await races.find(r => r.status === 200)!.json()).data;
  for (const [expected, status] of [["PENDING", "CONFIRMED"], ["CONFIRMED", "SHIPPED"], ["SHIPPED", "DELIVERED"]]) await op(2, { action: "status", id: winner.id, expected, status });
  await op(2, { action: "status", id: winner.id, expected: "DELIVERED", status: "CANCELLED" }, 400);
  checks.push("Concurrent final-stock checkout: one winner, no oversell; full admin lifecycle, terminal state locked");
  await op(0, { action: "profile", name: "Updated test", city: "Demo city", birthYear: "2000", phone: "0900000000", address: "Isolated default address" });
  const profile = (await (await request("/api/shop?view=profile", cookies[0])).json()).data;
  assert.equal(profile.fullName, "Updated test"); assert.equal(profile.addresses[0].line1, "Isolated default address");
  await op(0, { action: "favorite", slug: prefix });
  assert.equal((await (await request("/api/shop?view=favorites", cookies[0])).json()).data.length, 1);
  await op(0, { action: "favorite", slug: prefix, remove: true });
  assert.equal((await (await request("/api/shop?view=favorites", cookies[0])).json()).data.length, 0);
  const report = (await (await request("/api/shop?view=admin", cookies[2])).json()).data;
  assert.ok(report.orders.some((o: { id: number }) => o.id === winner.id));
  assert.ok(report.lowStock.some((v: { id: number }) => v.id === variantId));
  const deniedPrint = await request(`/admin/orders/${winner.id}/print`, cookies[0]);
  // Next may already have streamed its shell before notFound(), so inspect for data leaks.
  assert.ok(!(await deniedPrint.text()).includes(winner.orderNumber));
  const allowedPrint = await request(`/admin/orders/${winner.id}/print`, cookies[2]);
  assert.equal(allowedPrint.status, 200); assert.ok((await allowedPrint.text()).includes(winner.orderNumber));
  checks.push("Profile/address and favorites persist; admin dashboard and protected packing slip work");
  for (const path of ["/cart", "/checkout", "/account", "/account/orders", "/favorites"]) assert.equal((await request(path, cookies[0])).status, 200);
  const matching = await (await request(`/products?category=${prefix}&color=black&size=M&minPrice=100000&maxPrice=200000`)).text();
  assert.ok(matching.includes(`/products/${prefix}`));
  const mismatch = await (await request(`/products?category=${prefix}&size=L`)).text();
  assert.ok(!mismatch.includes(`href="/products/${prefix}"`));
  checks.push("Public custom-category/combined filters, mismatch empty state and account routes render");
  mkdirSync(".local", { recursive: true });
  writeFileSync(".local/shop-http-smoke.json", JSON.stringify({ checks, database: "aurel_ai_test", at: new Date().toISOString(), browserQA: false }, null, 2));
  console.log(`PASS ${checks.length} HTTP integration groups: ${checks.join("; ")}`);
} finally {
  server?.kill();
  if (server && server.exitCode === null) await new Promise<void>(resolve => { server!.once("exit", resolve); setTimeout(resolve, 5000); });
  await assertTestDatabase(sql => db.query(sql));
  await db.query("BEGIN");
  try {
    await db.query('DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "userId"=ANY($1::int[]))', [users]);
    await db.query('DELETE FROM "Order" WHERE "userId"=ANY($1::int[])', [users]);
    await db.query('DELETE FROM "CartItem" WHERE "cartId" IN (SELECT id FROM "Cart" WHERE "userId"=ANY($1::int[]))', [users]);
    await db.query('DELETE FROM "Cart" WHERE "userId"=ANY($1::int[])', [users]);
    await db.query('DELETE FROM "Favorite" WHERE "userId"=ANY($1::int[])', [users]);
    await db.query('DELETE FROM "UserAddress" WHERE "userId"=ANY($1::int[])', [users]);
    await db.query('DELETE FROM "ProductPrice" WHERE "variantId"=$1', [variantId]);
    await db.query('DELETE FROM "ProductVariant" WHERE id=$1 AND "productId"=$2', [variantId, productId]);
    await db.query('DELETE FROM "Product" WHERE id=$1 AND slug=$2', [productId, prefix]);
    await db.query('DELETE FROM "Category" WHERE id=$1 AND slug=$2', [categoryId, prefix]);
    await db.query('DELETE FROM "User" WHERE id=ANY($1::int[]) AND email LIKE $2', [users, `${prefix}%@test.invalid`]);
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  if (baseline) assert.deepEqual(await fingerprint(main), baseline);
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash);
  await db.end(); await main.end();
  console.log("Test fixtures removed. Main database/.env unchanged; test server stopped.");
}
