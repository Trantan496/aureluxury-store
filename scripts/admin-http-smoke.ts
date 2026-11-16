import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import { testTarget, assertTestDatabase, fingerprint } from "./test-database-safety.ts";
const confirmation = process.argv.find(a => a.startsWith("--confirm-test-database="))?.split("=")[1];
const config = parse(readFileSync(".env.test")), target = testTarget(config.TEST_DATABASE_URL, confirmation);
const mainConfig = parse(readFileSync(".env")), mainURL = new URL(mainConfig.DATABASE_URL); assert.equal(mainURL.pathname, "/aurel_ai");
const main = new pg.Client({ connectionString: mainURL.toString(), options: "-c default_transaction_read_only=on" });
const db = new pg.Client({ connectionString: target.toString() });
const envHash = createHash("sha256").update(readFileSync(".env")).digest("hex");
const prefix = "p292-http-" + randomBytes(6).toString("hex"), email = prefix + "@test.invalid", password = randomBytes(24).toString("base64url") + "!9a";
const origin = "http://127.0.0.1:3352";
let cookie = "", userId = 0, categoryId = 0;
let server: ReturnType<typeof spawn> | undefined;
let before: Awaited<ReturnType<typeof fingerprint>> | undefined;
async function request(path: string, body?: unknown, requestOrigin = origin) {
  return fetch(origin + path, { headers: { origin: requestOrigin, cookie, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}), redirect: "manual", signal: AbortSignal.timeout(15000) });
}
async function operation(body: unknown) {
  const response = await request("/api/admin/products", body); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.ok, true); return result.data;
}
try {
  await main.connect(); before = await fingerprint(main); await db.connect(); await assertTestDatabase(sql => db.query(sql));
  assert.equal((await db.query("SELECT pg_try_advisory_lock(242024) locked")).rows[0].locked, true);
  // Fail if another process already owns the smoke URL; never send fixtures to an unknown server.
  let occupied = false; try { await fetch(origin, { signal: AbortSignal.timeout(800) }); occupied = true; } catch { /* expected */ }
  assert.equal(occupied, false, "Smoke port already occupied");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3352"], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", DATABASE_URL: target.toString(), BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: origin, RESEND_API_KEY: "", EMAIL_FROM: "", MULTI_CURRENCY_ENABLED: "false" } });
  let ready = false;
  for (let n = 0; n < 60; n++) { if (server.exitCode !== null) break; try { ready = (await request("/login")).status === 200; if (ready) break; } catch { /* startup */ } await new Promise(r => setTimeout(r, 300)); }
  assert.equal(ready, true, "Smoke server failed to start");
  assert.equal((await request("/api/admin/products")).status, 401);
  const anonymous = await request("/admin/products"); assert.match(await anonymous.text(), /noindex/); assert.match(anonymous.headers.get("cache-control") ?? "", /no-store/);
  await assertTestDatabase(sql => db.query(sql));
  assert.equal((await request("/api/auth/sign-up/email", { email, password, name: prefix })).status, 200);
  const fixture = (await db.query('SELECT id,role FROM "User" WHERE email=$1', [email])).rows[0]; assert.equal(fixture.role, "CUSTOMER"); userId = fixture.id;
  const login = await request("/api/auth/sign-in/email", { email, password }); assert.equal(login.status, 200); cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; "); assert.ok(cookie);
  assert.equal((await request("/api/admin/products")).status, 403);
  await assertTestDatabase(sql => db.query(sql));
  await db.query('UPDATE "User" SET role=\'ADMIN\' WHERE id=$1 AND email=$2', [userId, email]);
  for (const path of ["/admin/products", "/admin/products/new", "/admin/products/import"]) { const page = await request(path); assert.equal(page.status, 200); assert.match(await page.text(), /PRODUCT STUDIO/); }
  assert.equal((await request("/api/admin/products", { operation: "category", input: { name: prefix, slug: prefix } }, "https://evil.invalid")).status, 400);
  categoryId = (await operation({ operation: "category", input: { name: prefix, slug: prefix } })).id;
  const code = "AUR-" + Date.now().toString().slice(-12);
  let product = await operation({ operation: "save", input: { productCode: code, name: prefix, slug: prefix, categoryId, description: null, brand: null, collection: null, isActive: true, options: {}, variants: [{ sku: prefix.toUpperCase(), color: "black", size: "M", stock: 1, isActive: true, prices: { VND: "120000" } }], images: [] } });
  const detail = await request(`/admin/products/${product.id}`); assert.equal(detail.status, 200); assert.match(await detail.text(), /Product Information/);
  const publicPage = await request(`/products/${prefix}`); assert.equal(publicPage.status, 200); assert.match(await publicPage.text(), new RegExp(prefix));
  product = await operation({ operation: "status", id: product.id, version: product.version, active: false });
  await operation({ operation: "delete", id: product.id, version: product.version, confirmation: code });
  assert.equal((await db.query('SELECT count(*)::int n FROM "Product" WHERE id=$1', [product.id])).rows[0].n, 0);
  const { csvText } = await import("../src/features/products/management.ts");
  const files = { products: csvText("products", [{ product_code: code, name: prefix, slug: prefix, category_slug: prefix, collection: "", description: "", is_active: false }]) };
  const preview = await operation({ operation: "preview", files }); assert.equal(preview.report.valid, true);
  assert.equal((await operation({ operation: "import", files, confirmation: preview.token })).imported, 1);
  const exported = await request("/api/admin/products?operation=export&page=1"); assert.equal(exported.status, 200); const exportedData = await exported.json(); assert.ok(exportedData.data.files.products.includes(code));
  await assertTestDatabase(sql => db.query(sql)); await db.query('UPDATE "User" SET role=\'CUSTOMER\' WHERE id=$1 AND email=$2', [userId, email]);
  assert.equal((await request("/api/admin/products")).status, 403);
  mkdirSync(".local", { recursive: true }); writeFileSync(".local/p292-http-smoke.json", JSON.stringify({ at: new Date().toISOString(), target: "aurel_ai_test", auth: "real Better Auth cookie", routes: ["/admin/products", "/admin/products/new", "/admin/products/import", "/admin/products/[id]"], apiAnonymous401: true, customer403: true, adminCRUD: true, importExport: true, revokedAdmin403: true, crossOriginRejected: true, noRealEmail: true, visualQA: "Pending Manual Review" }, null, 2));
  console.log("PASS HTTP smoke: real test cookie, anonymous/CUSTOMER/revoked denial, ADMIN routes/CRUD/import/export, CSRF, public PDP.");
} finally {
  server?.kill();
  if (server && server.exitCode === null) await new Promise<void>(resolve => { server!.once("exit", () => resolve()); setTimeout(resolve, 5000); });
  await assertTestDatabase(sql => db.query(sql));
  const owned = (await db.query('SELECT id FROM "Product" WHERE "categoryId"=$1 AND slug=$2', [categoryId, prefix])).rows.map(r => r.id);
  await db.query('DELETE FROM "ProductImage" WHERE "productId"=ANY($1::int[])', [owned]);
  await db.query('DELETE FROM "ProductPrice" WHERE "variantId" IN (SELECT id FROM "ProductVariant" WHERE "productId"=ANY($1::int[]))', [owned]);
  await db.query('DELETE FROM "ProductProfile" WHERE "productId"=ANY($1::int[])', [owned]);
  await db.query('DELETE FROM "ProductVariant" WHERE "productId"=ANY($1::int[])', [owned]);
  await db.query('DELETE FROM "Product" WHERE id=ANY($1::int[]) AND slug=$2', [owned, prefix]);
  if (categoryId) await db.query('DELETE FROM "Category" WHERE id=$1 AND slug=$2', [categoryId, prefix]);
  // Better Auth auth records cascade only for this uniquely owned test identity.
  if (userId) await db.query('DELETE FROM "User" WHERE id=$1 AND email=$2', [userId, email]);
  if (before) assert.deepEqual(await fingerprint(main), before);
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash);
  await db.end(); await main.end();
  console.log("HTTP fixture cleanup complete; smoke server stopped; main and .env unchanged.");
}
