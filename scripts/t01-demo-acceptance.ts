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
const origin = "http://localhost:3357", prefix = `t01-test-${randomBytes(6).toString("hex")}`;
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
  async function start(connection: string) {
    try { await fetch(origin, { signal: AbortSignal.timeout(800) }); throw new Error("Test port occupied"); }
    catch (error) { if ((error as Error).message === "Test port occupied") throw error; }
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3357"], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", DATABASE_URL: connection, BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: origin, RESEND_API_KEY: "", EMAIL_FROM: "", MULTI_CURRENCY_ENABLED: "false" } });
    for (let n = 0; n < 60; n++) {
      if (server.exitCode !== null) throw new Error("Test server exited");
      try { if ((await request("/login")).status === 200) return; } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error("Test server not ready");
  }
  if (!process.argv.includes("--case=7")) {
    await start(target.toString());
    const credentials: { email: string; password: string }[] = [];
    for (let index = 0; index < 2; index++) {
      const email = `${prefix}-${index}@test.invalid`, password = randomBytes(24).toString("base64url") + "A!9";
      credentials.push({ email, password });
      assert.equal((await request("/api/auth/sign-up/email", "", { email, password, name: prefix })).status, 200);
      users.push((await db.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0].id);
      const login = await request("/api/auth/sign-in/email", "", { email, password }); assert.equal(login.status, 200);
      cookies.push(login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ")); assert.ok(cookies[index]);
    }
    categoryId = (await db.query('INSERT INTO "Category" (name,slug) VALUES ($1,$1) RETURNING id', [prefix])).rows[0].id;
    productId = (await db.query('INSERT INTO "Product" (name,slug,"categoryId","isActive",brand) VALUES ($1,$1,$2,true,\'Test Brand\') RETURNING id', [prefix, categoryId])).rows[0].id;
    variantId = (await db.query('INSERT INTO "ProductVariant" ("productId",sku,color,size,stock,"isActive") VALUES ($1,$2,\'black\',\'M\',5,true) RETURNING id', [productId, prefix.toUpperCase()])).rows[0].id;
    await db.query('INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES ($1,\'VND\',120000,NOW())', [variantId]);
    await op(0, { action: "cart", variantId, quantity: 2, add: true });
    // A new sign-in proves persistence across sessions, rather than reusing an in-memory response.
    const relogin = await request("/api/auth/sign-in/email", "", credentials[0]); assert.equal(relogin.status, 200);
    cookies[0] = relogin.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const cart = await (await request("/api/shop?view=cart", cookies[0])).json();
    assert.equal(cart.data.items[0].variantId, variantId); assert.equal(cart.data.items[0].quantity, 2);
    checks.push("T01-1 PASS: login and cart persist after fresh sign-in/reload");
    const input = checkout(), first = await op(0, input);
    const order = (await db.query('SELECT "totalAmount",currency,"userId" FROM "Order" WHERE id=$1', [first.id])).rows[0];
    assert.equal(Number(order.totalAmount), 240000); assert.equal(order.currency, "VND"); assert.equal(order.userId, users[0]);
    checks.push("T01-2 PASS: forged client total/user ignored; order priced by server");
    const duplicate = await op(0, input);
    assert.equal(first.id, duplicate.id); assert.equal(await stock(), 3);
    assert.equal(Number((await db.query('SELECT count(*) FROM "Order" WHERE "orderNumber"=$1', [first.orderNumber])).rows[0].count), 1);
    checks.push("T01-3 PASS: request key replay returns same order and decrements once");
    const foreign = (await (await request("/api/shop?view=orders", cookies[1])).json()).data;
    assert.ok(!foreign.orders.some((o: { id: number }) => o.id === first.id));
    await op(1, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" }, 404);
    assert.equal(await stock(), 3);
    checks.push("T01-5 PASS: foreign order hidden and mutation denied");
    await op(0, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" }); assert.equal(await stock(), 5);
    await op(0, { action: "status", id: first.id, expected: "PENDING", status: "CANCELLED" }, 409); assert.equal(await stock(), 5);
    checks.push("T01-6 PASS: PENDING cancellation restores stock once, replay rejected");
    await db.query('UPDATE "ProductVariant" SET stock=1 WHERE id=$1', [variantId]);
    await op(0, { action: "cart", variantId, quantity: 1 }); await op(1, { action: "cart", variantId, quantity: 1 });
    const races = await Promise.all([request("/api/shop", cookies[0], checkout()), request("/api/shop", cookies[1], checkout())]);
    assert.deepEqual(races.map(r => r.status).sort(), [200, 409]); assert.equal(await stock(), 0);
    assert.equal(Number((await db.query('SELECT count(*) FROM "Order" WHERE "userId"=ANY($1::int[]) AND status=\'PENDING\'', [users])).rows[0].count), 1);
    checks.push("T01-4 PASS: final-stock race has one winner and stock never negative");
    server!.kill(); await new Promise<void>(resolve => server!.once("exit", resolve)); server = undefined;
  }
  // Refuse connection only in this child process; PostgreSQL and main configuration stay running unchanged.
  const unavailable = new URL(target); unavailable.port = "1";
  await start(unavailable.toString());
  const fallback = await request("/products"), html = await fallback.text();
  assert.equal(fallback.status, 200); assert.ok(html.includes("Ch\u01b0a th\u1ec3 t\u1ea3i s\u1ea3n ph\u1ea9m"));
  assert.ok(html.includes("Th\u1eed t\u1ea3i l\u1ea1i")); assert.ok(html.includes("<header")); assert.ok(html.includes("<footer"));
  assert.ok(!html.includes(`href="/products/${prefix}"`));
  checks.push("T01-7 PASS: unavailable DB renders catalog error, retry, navigation and footer");
  console.log(checks.join("\n"));
} finally {
  mkdirSync(".local", { recursive: true });
  writeFileSync(process.argv.includes("--case=7") ? ".local/t01-demo-acceptance-case7-rerun.json" : ".local/t01-demo-acceptance.json", JSON.stringify({ checks, plannedCases: 7, at: new Date().toISOString(), browserQA: "separate case 8" }, null, 2));
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
