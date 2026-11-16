import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { integrationTarget, assertIntegrationDatabase as assertTestDatabase } from "../scripts/integration-target.ts";
import type { ServiceResult } from "../src/features/products/product-service.ts";

const target = integrationTarget();
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== target.toString()) throw new Error("Integration worker must be launched by the guarded runner.");

test("PostgreSQL Better Auth and Product Data Service integration", { timeout: 120000 }, async t => {
  const gate = new pg.Client({ connectionString: target.toString() });
  await gate.connect();
  await assertTestDatabase(sql => gate.query(sql));
  // Import application singletons only after verifying the physical target.
  const { prisma } = await import("../src/lib/db/client.ts");
  const { getAuth } = await import("../src/lib/auth.ts");
  const { createProductDataService } = await import("../src/lib/products.ts");
  const { resolveAuthSession } = await import("../src/features/auth/session.ts");
  const { getCatalogPage } = await import("../src/lib/catalog.ts");
  const prefix = "p24-" + randomBytes(8).toString("hex");
  const origin = process.env.BETTER_AUTH_URL!;
  const auth = await getAuth();
  let guardQueue = Promise.resolve();
  const guard = () => {
    const next = guardQueue.then(() => assertTestDatabase(sql => gate.query(sql)));
    guardQueue = next.catch(() => {}); return next;
  };
  async function write<T>(work: () => Promise<T>) { await guard(); return work(); }
  // Better Auth may delete expired sessions even during a session lookup.
  const readSession = (headers: Headers) => write(() => resolveAuthSession(auth, headers));
  async function request(path: string, body: object, cookie = "", requestOrigin = origin) {
    return write(() => auth.handler(new Request(origin + "/api/auth/" + path, {
      method: "POST", headers: { origin: requestOrigin, cookie, "content-type": "application/json" }, body: JSON.stringify(body),
    })));
  }
  function cookieOf(response: Response) { return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); }
  function success<T>(result: ServiceResult<T>): T { if (!result.ok) throw new Error("Unexpected service result: " + result.error.code); return result.data; }
  function failure(result: ServiceResult<unknown>, code: string) {
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, code);
    assert.ok(!JSON.stringify(result).includes("postgresql://"));
  }
  async function step(name: string, work: () => Promise<void>) {
    let failed = false;
    await t.test(name, async () => { try { await work(); } catch (error) { failed = true; throw error; } });
    if (failed) throw new Error("Stopped after failing integration step: " + name);
  }
  const credentials = { email: prefix + "@test.invalid", password: randomBytes(24).toString("base64url") + "!9a" };
  let userId = 0, categoryId = 0, productId = 0, otherProductId = 0, variantId = 0, imageId = 0;
  let cookie = "";
  const service = createProductDataService(() => readSession(new Headers({ cookie })));
  try {
    await step("empty catalog and anonymous mutation denial", async () => {
      assert.equal(await prisma.user.count(), 0, "Dedicated test DB must be clean; do not erase unknown data.");
      assert.equal(await prisma.product.count(), 0);
      const page = await getCatalogPage({ q: "", category: "", invalid: false });
      assert.equal(page.status, "success"); if (page.status === "success") { assert.deepEqual(page.products, []); assert.equal(page.pagination.total, 0); }
      failure(await write(() => service.create("category", { name: "Denied", slug: prefix })), "UNAUTHENTICATED");
    });
    await step("signup creates Int User and credential Account without role escalation", async () => {
      const response = await request("sign-up/email", { ...credentials, name: "PostgreSQL integration " + prefix, role: "ADMIN", emailVerified: true });
      assert.equal(response.status, 200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } }); userId = user.id;
      assert.ok(Number.isInteger(userId)); assert.equal(user.role, "CUSTOMER"); assert.equal(user.emailVerified, false);
      assert.equal(user.fullName, "PostgreSQL integration " + prefix); assert.equal(user.passwordHash, null);
      const account = await prisma.account.findFirstOrThrow({ where: { userId } });
      assert.equal(account.providerId, "credential"); assert.notEqual(account.password, credentials.password);
      assert.ok((account.password?.length ?? 0) > 50); assert.equal(await prisma.session.count({ where: { userId } }), 0);
    });
    await step("signin rejects wrong password and verifies a real PostgreSQL session", async () => {
      assert.equal((await request("sign-in/email", { ...credentials, password: "Wrong-password-123!" })).status, 401);
      const response = await request("sign-in/email", credentials); assert.equal(response.status, 200); cookie = cookieOf(response);
      const session = await readSession(new Headers({ cookie })); assert.ok(session); assert.equal(session.userId, userId);
      assert.equal(await prisma.session.count({ where: { userId } }), 1);
      failure(await write(() => service.create("category", { name: "Denied", slug: prefix })), "FORBIDDEN");
      assert.equal((await request("update-user", { role: "ADMIN" }, cookie)).status, 400);
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).role, "CUSTOMER");
    });
    await step("invalid cookie and untrusted cookie origin cannot authenticate", async () => {
      assert.equal(await readSession(new Headers({ cookie: cookie + "tampered", "x-user-id": String(userId), "x-role": "ADMIN" })), null);
      assert.equal((await request("sign-out", {}, cookie, "https://untrusted.example")).status, 403);
      assert.ok(await readSession(new Headers({ cookie })));
    });
    await step("ADMIN role only in test DB enables real category/product CRUD", async () => {
      await write(() => prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } }));
      categoryId = Number(success(await write(() => service.create("category", { name: prefix, slug: prefix }))).id);
      productId = Number(success(await write(() => service.create("product", { name: prefix + " product", slug: prefix, categoryId }))).id);
      otherProductId = Number(success(await write(() => service.create("product", { name: prefix + " second", slug: prefix + "-2", categoryId }))).id);
      assert.equal(success(await service.get("category", categoryId)).id, String(categoryId));
      success(await write(() => service.update("category", categoryId, { name: prefix + " renamed" })));
      const updated = success(await write(() => service.update("product", productId, { description: "Integration-only description", brand: null })));
      assert.ok("description" in updated); assert.equal(updated.description, "Integration-only description");
      assert.equal(success(await service.list("product", { pageSize: 1 })).pagination.total, 2);
    });
    await step("variant and image CRUD preserve Decimal, scope, SKU, color, size and stock", async () => {
      variantId = Number(success(await write(() => service.create("variant", { productId, sku: prefix, color: "Blue", size: "M", price: "9999999999.99", stock: 10 }))).id);
      const variant = success(await service.get("variant", variantId, productId));
      assert.ok("price" in variant); assert.equal(variant.price, "9999999999.99");
      const updated = success(await write(() => service.update("variant", variantId, { color: "Red", size: "L", price: "12.10" }, productId)));
      assert.ok("price" in updated); assert.equal(updated.price, "12.10"); assert.equal(updated.stock, 10);
      imageId = Number(success(await write(() => service.create("image", { productId, storageKey: "/images/test-only.png", altText: "Test", sortOrder: 1 }))).id);
      const image = success(await write(() => service.update("image", imageId, { altText: "Updated", sortOrder: 2 }, productId)));
      assert.ok("url" in image); assert.equal(image.url, "/images/test-only.png"); assert.ok(!("storageKey" in image));
      assert.equal(success(await service.list("variant", { productId })).items.length, 1);
      assert.equal(success(await service.list("image", { productId })).items.length, 1);
      failure(await service.get("image", imageId, otherProductId), "NOT_FOUND");
      failure(await write(() => service.update("variant", variantId, { sku: "Denied" }, otherProductId)), "NOT_FOUND");
    });
    await step("real unique constraints and foreign keys return safe conflicts", async () => {
      failure(await write(() => service.create("category", { name: "Duplicate", slug: prefix })), "CONFLICT");
      failure(await write(() => service.create("product", { name: "Missing category", slug: prefix + "-fk", categoryId: 2147483647 })), "CONFLICT");
      failure(await write(() => service.create("variant", { productId, sku: prefix, color: "Other", size: "S", price: "1", stock: 0 })), "CONFLICT");
      failure(await write(() => service.create("variant", { productId, sku: prefix + "-duplicate", color: "Red", size: "L", price: "1", stock: 0 })), "CONFLICT");
      failure(await write(() => service.remove("category", categoryId)), "CONFLICT");
      failure(await write(() => service.create("variant", { productId, sku: prefix + "-bad", color: "Red", size: "S", price: "1.001", stock: -1 })), "INVALID_INPUT");
      assert.equal(await prisma.productVariant.count({ where: { productId } }), 1);
    });
    await step("concurrent stock updates have exactly one winner without lost update", async () => {
      const payload = { productId, variantId, expectedStock: 10, delta: -3 };
      const results = await Promise.all([write(() => service.adjustStock(payload)), write(() => service.adjustStock(payload))]);
      assert.equal(results.filter(result => result.ok).length, 1);
      results.filter(result => !result.ok).forEach(result => failure(result, "CONFLICT"));
      assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock, 7);
      failure(await write(() => service.adjustStock({ ...payload, expectedStock: 7, delta: -8 })), "INVALID_INPUT");
    });
    await step("FK failure and explicit exception roll back complete PostgreSQL transactions", async () => {
      await assert.rejects(write(() => prisma.$transaction(async tx => {
        await tx.category.create({ data: { name: prefix, slug: prefix + "-rollback" } });
        await tx.product.create({ data: { name: "Will roll back", slug: prefix + "-rollback", categoryId: 2147483647 } });
      })), error => !!error && typeof error === "object" && "code" in error && error.code === "P2003");
      assert.equal(await prisma.category.count({ where: { slug: prefix + "-rollback" } }), 0);
      await assert.rejects(write(() => prisma.$transaction(async tx => {
        await tx.productVariant.update({ where: { id: variantId }, data: { stock: 99 } });
        throw new Error("Forced test rollback");
      })), /Forced test rollback/);
      assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock, 7);
    });
    await step("catalog reads test records with consistent page/count and safe images", async () => {
      const page = await getCatalogPage({ q: prefix, category: "", invalid: false, page: 1, pageSize: 1 });
      assert.equal(page.status, "success"); if (page.status === "success") { assert.equal(page.pagination.total, 2); assert.equal(page.products.length, 1); }
      const later = await getCatalogPage({ q: prefix, category: "", invalid: false, page: 3, pageSize: 1 });
      assert.equal(later.status, "success"); if (later.status === "success") assert.deepEqual(later.products, []);
    });
    await step("independent currency prices, missing prices and server authorization", async () => {
      const missing = success(await service.getPrice(productId, variantId, "USD"));
      assert.equal(missing.status, "missing"); assert.equal(missing.amount, null);
      for (const [currency, amount] of [["VND", "299000"], ["USD", "12.10"], ["EUR", "11.25"]] as const) {
        const priced = success(await write(() => service.setPrice({ productId, variantId, currency, amount })));
        assert.equal(priced.amount, amount);
        assert.equal(success(await service.getPrice(productId, variantId, currency)).amount, amount);
        const catalog = await getCatalogPage({ q: prefix, category: "", invalid: false, currency });
        assert.equal(catalog.status,"success");
        if (catalog.status === "success") {
          assert.equal(catalog.products.find(p => p.id === String(productId))?.price, amount);
          assert.equal(catalog.products.find(p => p.id === String(otherProductId))?.price, null);
        }
      }
      failure(await write(() => service.setPrice({ productId, variantId, currency: "VND", amount: "1.00" })), "INVALID_INPUT");
      failure(await write(() => service.setPrice({ productId, variantId, currency: "USD", amount: "1.001" })), "INVALID_INPUT");
      failure(await write(() => service.setPrice({ productId, variantId, currency: "GBP", amount: "1" })), "INVALID_INPUT");
      failure(await write(() => service.setPrice({ productId: otherProductId, variantId, currency: "USD", amount: "1" })), "NOT_FOUND");
      await write(() => prisma.user.update({where:{id:userId},data:{role:"CUSTOMER"}}));
      failure(await write(() => service.setPrice({ productId, variantId, currency:"USD", amount:"1" })),"FORBIDDEN");
      await write(() => prisma.user.update({where:{id:userId},data:{role:"ADMIN"}}));
      assert.equal(success(await service.listPrices(productId,variantId)).length,3);
      success(await write(() => service.removePrice(productId,variantId,"EUR")));
      assert.equal(success(await service.getPrice(productId,variantId,"EUR")).status,"missing");
      const catalog = await getCatalogPage({q:prefix,category:"",invalid:false,currency:"EUR"});
      if(catalog.status!=="success") assert.fail("Catalog read failed");
      assert.equal(catalog.products.find(p=>p.id===String(productId))?.priceStatus,"missing");
    });
    await step("PostgreSQL rejects invalid scale, duplicate currency and foreign keys", async () => {
      for (const [currency, amount] of [["VND","1.5"],["USD","1.001"],["EUR","-1"],["EUR","1000000000000000000"]]) {
        await assert.rejects(write(() => prisma.productPrice.upsert({where:{variantId_currency:{variantId,currency:currency as "VND"}},create:{variantId,currency:currency as "VND",amount},update:{amount}})));
      }
      await assert.rejects(write(() => prisma.productPrice.create({data:{variantId,currency:"USD",amount:"1"}})));
      await assert.rejects(write(() => prisma.productPrice.create({data:{variantId:2147483647,currency:"USD",amount:"1"}})));
      assert.equal(success(await service.getPrice(productId,variantId,"USD")).amount,"12.10");
    });
    await step("multi-product snapshots persist exact totals without live-price dependency", async () => {
      const {getOrderPricingSnapshot} = await import("../src/lib/db/queries/order-pricing.ts");
      const secondId = Number(success(await write(() => service.create("variant", {productId:otherProductId,sku:prefix+"-unpriced",color:"Green",size:"S",stock:10}))).id);
      assert.equal((await prisma.productVariant.findUniqueOrThrow({where:{id:secondId}})).price,null);
      await assert.rejects(getOrderPricingSnapshot("USD",[{variantId:secondId,quantity:1}]));
      for(const currency of ["VND","USD","EUR"] as const) {
        success(await write(() => service.setPrice({productId,variantId,currency,amount:currency==="VND"?"10":"0.10"})));
        success(await write(() => service.setPrice({productId:otherProductId,variantId:secondId,currency,amount:currency==="VND"?"20":"0.20"})));
        const snapshot = await getOrderPricingSnapshot(currency,[{variantId,quantity:3},{variantId:secondId,quantity:2}]);
        assert.equal(snapshot.totalAmount,currency==="VND"?"70":"0.70");
        const base = {orderNumber:prefix+"-"+currency,userId,shippingName:"Integration",shippingPhone:"0",shippingAddress:"Test only"};
        const order = await write(() => prisma.order.create({data:{...base,currency,totalAmount:snapshot.totalAmount,items:{create:snapshot.items}},include:{items:true}}));
        assert.equal(order.items.length,2);
        success(await write(() => service.setPrice({productId,variantId,currency,amount:"999"})));
        const stored = await prisma.order.findUniqueOrThrow({where:{id:order.id},include:{items:true}});
        assert.equal(stored.totalAmount.toString(),currency==="VND"?"70":"0.7");
        assert.equal(stored.items.find(item=>item.variantId===variantId)?.unitPrice.toString(),currency==="VND"?"10":"0.1");
        await assert.rejects(write(() => prisma.order.create({data:{...base,orderNumber:base.orderNumber+"-bad",currency,totalAmount:"1",items:{create:snapshot.items}}})));
        await assert.rejects(write(() => prisma.order.create({data:{...base,orderNumber:base.orderNumber+"-mixed",currency,totalAmount:snapshot.totalAmount,items:{create:snapshot.items.map((item,i)=>({...item,currency:i===0?"USD":"EUR"}))}}})));
        assert.equal(await prisma.order.count({where:{orderNumber:{startsWith:base.orderNumber+"-"}}}),0);
      }
      await assert.rejects(getOrderPricingSnapshot("USD",[{variantId,quantity:99}]));
    });
    await step("revoked ADMIN is rejected immediately on the existing signed session", async () => {
      await write(() => prisma.user.update({ where: { id: userId }, data: { role: "CUSTOMER" } }));
      failure(await write(() => service.update("product", productId, { name: "Denied" })), "FORBIDDEN");
      await write(() => prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } }));
    });
    await step("image delete and product/variant deactivation preserve references", async () => {
      success(await write(() => service.remove("image", imageId, productId)));
      assert.equal(await prisma.productImage.count({ where: { id: imageId } }), 0);
      success(await write(() => service.remove("variant", variantId, productId)));
      assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).isActive, false);
      success(await write(() => service.remove("product", productId)));
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).isActive, false);
      const disposable = Number(success(await write(() => service.create("category", { name: prefix, slug: prefix + "-delete" }))).id);
      success(await write(() => service.remove("category", disposable)));
      assert.equal(await prisma.category.count({ where: { id: disposable } }), 0);
    });
    await step("signout deletes the DB session and blocks cookie replay", async () => {
      assert.equal((await request("sign-out", {}, cookie)).status, 200);
      assert.equal(await readSession(new Headers({ cookie })), null);
      failure(await write(() => service.remove("product", otherProductId)), "UNAUTHENTICATED");
    });
    await step("explicit revocation and stored session expiration invalidate real cookies", async () => {
      const second = await request("sign-in/email", credentials); assert.equal(second.status, 200); cookie = cookieOf(second);
      const third = await request("sign-in/email", credentials); assert.equal(third.status, 200);
      const thirdHeaders = new Headers({ cookie: cookieOf(third) });
      const thirdSession = await write(() => auth.api.getSession({ headers: thirdHeaders })); assert.ok(thirdSession);
      await write(() => auth.api.revokeSession({ headers: new Headers({ cookie }), body: { token: thirdSession.session.token } }));
      assert.equal(await readSession(thirdHeaders), null);
      await write(() => prisma.session.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } }));
      assert.equal(await readSession(new Headers({ cookie })), null);
      failure(await write(() => service.create("category", { name: "Denied", slug: prefix + "-expired" })), "UNAUTHENTICATED");
    });
  } finally {
    try {
    // Scoped cleanup only, including after a failing test. Never truncate/reset unknown data.
    await guard();
    await prisma.$transaction(async tx => {
      await assertTestDatabase(async sql => ({ rows: await tx.$queryRawUnsafe<Record<string, unknown>[]>(sql) }));
      const products = await tx.product.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } });
      const ids = products.map(product => product.id);
      const orders = await tx.order.findMany({where:{orderNumber:{startsWith:prefix},userId},select:{id:true}});
      await tx.orderItem.deleteMany({where:{orderId:{in:orders.map(order=>order.id)}}});
      await tx.order.deleteMany({where:{id:{in:orders.map(order=>order.id)}}});
      await tx.productPrice.deleteMany({where:{variant:{productId:{in:ids}}}});
      await tx.productImage.deleteMany({ where: { productId: { in: ids } } });
      await tx.productVariant.deleteMany({ where: { productId: { in: ids } } });
      await tx.product.deleteMany({ where: { id: { in: ids }, slug: { startsWith: prefix } } });
      await tx.category.deleteMany({ where: { slug: { startsWith: prefix } } });
      await tx.user.deleteMany({ where: { email: credentials.email } });
    });
    assert.equal(await prisma.user.count({ where: { email: credentials.email } }), 0);
    assert.equal(await prisma.category.count({ where: { slug: { startsWith: prefix } } }), 0);
    assert.equal(await prisma.product.count({ where: { slug: { startsWith: prefix } } }), 0);
    assert.equal(await prisma.session.count(), 0);
    assert.equal(await prisma.account.count(), 0);
    console.log("PASS scoped cleanup: fixture users, sessions, accounts, products, variants, images and categories removed.");
    } finally {
      await prisma.$disconnect(); await gate.end();
    }
  }
});
