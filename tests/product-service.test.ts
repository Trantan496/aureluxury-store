import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "@prisma/client/runtime/client";
import { createProductService, type ProductDataTransaction, type SessionResolver, type VerifiedProductSession } from "../src/features/products/product-service.ts";
import { price, type Entity } from "../src/features/products/validation.ts";
import { publicProductImageUrl } from "../src/features/products/images.ts";
import { pagination, pageInfo } from "../src/features/catalog/pagination.ts";
import { parseCatalogQuery } from "../src/features/catalog/catalog.ts";

// Test double stays in memory. This suite never connects to or writes PostgreSQL.
type Row = Record<string, unknown>;
type Args = { where?: Row; data?: Row; skip?: number; take?: number; select?: unknown; orderBy?: unknown };
function harness() {
  let role: string | null = "ADMIN";
  let failure: unknown = null;
  let transactions = 0;
  let roleReads = 0;
  let time = 1700000000000;
  let beforeRoleLookup = () => {};
  let beforeTransaction = () => {};
  const calls: { table: string; method: string; args?: Args }[] = [];
  function table(name: string) {
    const rows = new Map<number, Row>();
    let sequence = 0;
    const match = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => row[key] === value);
    const call = (method: string, args?: Args) => { calls.push({ table: name, method, args }); if (failure) throw failure; };
    const normalize = (data: Row) => ({ ...data, ...(data.price !== undefined ? { price: new Decimal(data.price as string) } : {}) });
    return {
      rows,
      async create(args: Args) {
        call("create", args);
        const row = { id: ++sequence, isActive: true, description: null, brand: null, altText: null, sortOrder: 0, ...normalize(args.data ?? {}) };
        rows.set(sequence, row); return row;
      },
      async findUnique(args: Args) { call("findUnique", args); return [...rows.values()].find(row => match(row, args.where)) ?? null; },
      async findMany(args: Args) { call("findMany", args); return [...rows.values()].filter(row => match(row, args.where)).slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.size)); },
      async count(args?: Args) { call("count", args); return [...rows.values()].filter(row => match(row, args?.where)).length; },
      async update(args: Args) {
        call("update", args);
        const row = [...rows.values()].find(row => match(row, args.where));
        if (!row) throw { code: "P2025" };
        Object.assign(row, normalize(args.data ?? {})); return row;
      },
      async updateMany(args: Args) {
        call("updateMany", args);
        const matches = [...rows.values()].filter(row => match(row, args.where));
        matches.forEach(row => Object.assign(row, args.data)); return { count: matches.length };
      },
      async delete(args: Args) {
        call("delete", args);
        const row = [...rows.values()].find(row => match(row, args.where));
        if (!row) throw { code: "P2025" };
        rows.delete(row.id as number); return row;
      },
    };
  }
  const db = { product: table("product"), category: table("category"), productVariant: table("variant"), productImage: table("image") };
  const tx = { ...db, user: { async findUnique() { roleReads++; beforeRoleLookup(); if (failure) throw failure; return role === null ? null : { role }; } } } as unknown as ProductDataTransaction;
  const session: { resolver: SessionResolver } = { resolver: async () => ({ userId: 10, expiresAt: time + 60000 }) };
  const service = createProductService({ resolveSession: () => session.resolver(), now: () => time, transaction: async work => { transactions++; beforeTransaction(); return work(tx); } });
  return {
    service, db, calls, session,
    setRole: (value: string | null) => { role = value; }, setFailure: (value: unknown) => { failure = value; }, transactionCount: () => transactions,
    roleReadCount: () => roleReads,
    setTime: (value: number) => { time = value; }, time: () => time,
    onRoleLookup: (work: () => void) => { beforeRoleLookup = work; }, onTransaction: (work: () => void) => { beforeTransaction = work; },
  };
}
const inputs: Record<Entity, Row> = {
  category: { name: "Unit category", slug: "unit-category" },
  product: { name: "Unit product", slug: "unit-product", categoryId: 1 },
  variant: { productId: 1, sku: "UNIT-MEMORY", color: "Blue", size: "M", price: "12.10", stock: 5 },
  image: { productId: 1, storageKey: "/images/unit-only.jpg", altText: "Unit image" },
};

test("unauthenticated and resolver failures cannot reach database operations", async () => {
  const h = harness();
  for (const resolver of [async () => null, async () => { throw new Error("private session"); }, async () => ({ userId: NaN, expiresAt: h.time() + 60000 })]) {
    h.session.resolver = resolver;
    const result = await h.service.create("product", inputs.product);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED");
  }
  assert.equal(h.transactionCount(), 0);
  assert.deepEqual(h.calls, []);
});

test("every operation rechecks DB admin role, including revoked/missing users and forged roles", async () => {
  const h = harness();
  h.session.resolver = async () => ({ userId: 10, expiresAt: h.time() + 60000, role: "ADMIN" });
  for (const role of ["CUSTOMER", null]) {
    h.setRole(role);
    const results = await Promise.all([
      h.service.create("category", inputs.category), h.service.get("product", 1), h.service.list("product"),
      h.service.update("product", 1, { name: "Changed" }), h.service.remove("product", 1),
      h.service.adjustStock({ productId: 1, variantId: 1, expectedStock: 5, delta: -1 }),
    ]);
    results.forEach(result => { assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "FORBIDDEN"); });
  }
  assert.deepEqual(h.calls, []);
  h.setRole("ADMIN"); assert.equal((await h.service.list("product")).ok, true);
  h.setRole("CUSTOMER"); assert.equal((await h.service.list("product")).ok, false);
});

test("expired, missing or malformed expiration blocks every mutation before database access", async () => {
  const h = harness();
  // Test-only resolver doubles: no cookies, tokens or identities are issued by this suite.
  for (const expiresAt of [0, h.time(), h.time() - 1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, "9999999999999"]) {
    h.session.resolver = async () => ({ userId: 10, expiresAt } as unknown as VerifiedProductSession);
    for (const kind of ["category", "product", "variant", "image"] as const) {
      const results = await Promise.all([
        h.service.create(kind, inputs[kind]), h.service.update(kind, 1, { name: "Denied" }, 1), h.service.remove(kind, 1, 1),
      ]);
      results.forEach(result => { assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED"); });
    }
    const stock = await h.service.adjustStock({ productId: 1, variantId: 1, expectedStock: 5, delta: 1 });
    assert.equal(stock.ok, false); if (!stock.ok) assert.equal(stock.error.code, "UNAUTHENTICATED");
  }
  assert.equal(h.transactionCount(), 0);
  assert.deepEqual(h.calls, []);
});

test("expiration while waiting for a transaction prevents even the role lookup", async () => {
  const h = harness(), expiresAt = h.time() + 100;
  h.session.resolver = async () => ({ userId: 10, expiresAt });
  h.onTransaction(() => h.setTime(expiresAt));
  const result = await h.service.create("product", inputs.product);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED");
  assert.equal(h.roleReadCount(), 0);
  assert.deepEqual(h.calls, []);
});

test("expiration during the role query prevents mutation even when DB role is ADMIN", async () => {
  const h = harness(), expiresAt = h.time() + 100;
  h.session.resolver = async () => ({ userId: 10, expiresAt });
  h.onRoleLookup(() => h.setTime(expiresAt));
  const result = await h.service.create("variant", inputs.variant);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED");
  assert.equal(h.roleReadCount(), 1);
  assert.deepEqual(h.calls, []);
});

test("session revocation and revoked DB role are rechecked after an authorized operation", async () => {
  const h = harness();
  const session: VerifiedProductSession = { userId: 10, expiresAt: h.time() + 60000 };
  h.session.resolver = async () => session;
  assert.equal((await h.service.list("product")).ok, true);
  h.calls.length = 0;
  h.setRole("CUSTOMER");
  const forbidden = await h.service.create("product", inputs.product);
  assert.equal(forbidden.ok, false); if (!forbidden.ok) assert.equal(forbidden.error.code, "FORBIDDEN");
  h.setRole("ADMIN");
  h.session.resolver = async () => null; // Future provider must do this for revoked sessions.
  const revoked = await h.service.create("product", inputs.product);
  assert.equal(revoked.ok, false); if (!revoked.ok) assert.equal(revoked.error.code, "UNAUTHENTICATED");
  assert.equal(h.roleReadCount(), 2);
  assert.equal(h.transactionCount(), 2);
  assert.deepEqual(h.calls, []);
});

test("authorization database failure denies mutation without leaking connection or session details", async () => {
  const h = harness();
  h.onRoleLookup(() => { throw new Error("postgresql://private-connection; session-secret"); });
  const result = await h.service.create("category", inputs.category);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "DATABASE_ERROR");
  assert.ok(!JSON.stringify(result).includes("private-connection"));
  assert.ok(!JSON.stringify(result).includes("session-secret"));
  assert.deepEqual(h.calls, []);
});

for (const kind of ["category", "product", "variant", "image"] as const) {
  test(`${kind} CRUD and bounded list use safe DTOs and parent scope`, async () => {
    const h = harness(), parent = kind === "variant" || kind === "image" ? 1 : undefined;
    const created = await h.service.create(kind, inputs[kind]);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.data.id, "1");
    assert.equal(JSON.stringify(created.data).includes("storageKey"), false);
    if (kind === "variant") { assert.ok("price" in created.data); assert.equal(created.data.price, "12.10"); }
    const read = await h.service.get(kind, 1, parent);
    assert.deepEqual(read, created);
    const patch = kind === "variant" ? { color: "Red", size: "L", sku: "UNIT-NEW", price: "99.9" } : kind === "image" ? { altText: null, sortOrder: 2 } : { name: "Updated in memory" };
    assert.equal((await h.service.update(kind, 1, patch, parent)).ok, true);
    const list = await h.service.list(kind, { page: 1, pageSize: 1, ...(parent ? { productId: parent } : {}) });
    assert.equal(list.ok, true);
    if (list.ok) { assert.equal(list.data.items.length, 1); assert.deepEqual(list.data.pagination, pageInfo(1, 1, 1)); }
    if (parent) {
      const wrongParent = await h.service.get(kind, 1, 2);
      assert.equal(wrongParent.ok, false);
      if (!wrongParent.ok) assert.equal(wrongParent.error.code, "NOT_FOUND");
      assert.equal((await h.service.update(kind, 1, patch, 2)).ok, false);
      assert.equal((await h.service.remove(kind, 1, 2)).ok, false);
    }
    const removed = await h.service.remove(kind, 1, parent);
    assert.equal(removed.ok, true);
    if (removed.ok) assert.equal(removed.data.mode, ["product", "variant"].includes(kind) ? "deactivated" : "deleted");
    if (kind === "product") assert.equal(h.db.product.rows.get(1)?.isActive, false);
    if (kind === "variant") assert.equal(h.db.productVariant.rows.get(1)?.isActive, false);
  });
}

test("validation blocks mass assignment, invalid variants, numeric price and reparenting", async () => {
  const h = harness();
  const cases: [Entity, Row][] = [
    ["product", { ...inputs.product, role: "ADMIN" }], ["product", { ...inputs.product, variants: { create: [] } }],
    ["category", { name: "", slug: "bad slug" }], ["product", { ...inputs.product, categoryId: -1 }],
    ["variant", { ...inputs.variant, stock: -1 }], ["variant", { ...inputs.variant, stock: 1.1 }],
    ["variant", { ...inputs.variant, price: 1.25 }], ["variant", { ...inputs.variant, currency: "USD" }],
    ["image", { ...inputs.image, storageKey: "private/customer.jpg" }],
    ["image", { ...inputs.image, storageKey: "/images/../private.jpg" }],
  ];
  for (const [kind, data] of cases) {
    const result = await h.service.create(kind, data);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "INVALID_INPUT");
  }
  assert.equal((await h.service.update("variant", 1, { productId: 2 }, 1)).ok, false);
  assert.equal((await h.service.update("variant", 1, { stock: 3 }, 1)).ok, false);
  assert.equal((await h.service.update("product", 1, {})).ok, false);
  assert.deepEqual(h.calls, []);
});

test("price rejects rounding, exponent, overflow, signs and non-decimal values", () => {
  assert.equal(price("0"), "0.00"); assert.equal(price("9999999999.99"), "9999999999.99");
  for (const value of [1, NaN, Infinity, "-1", "1.001", "1e2", "10000000000", "01.2", " 1.0", "+1", "NaN"]) assert.throws(() => price(value));
});

test("stock compare-and-set prevents lost updates, underflow, overflow and inactive writes", async () => {
  const h = harness(); await h.service.create("variant", inputs.variant);
  const input = { productId: 1, variantId: 1, expectedStock: 5, delta: -2 };
  assert.equal((await h.service.adjustStock(input)).ok, true);
  assert.equal(h.db.productVariant.rows.get(1)?.stock, 3);
  const stale = await h.service.adjustStock(input);
  assert.equal(stale.ok, false); if (!stale.ok) assert.equal(stale.error.code, "CONFLICT");
  for (const update of [{ expectedStock: 3, delta: -4 }, { expectedStock: 2147483647, delta: 1 }, { expectedStock: 3, delta: 0 }]) {
    const result = await h.service.adjustStock({ ...input, ...update });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "INVALID_INPUT");
  }
  await h.service.remove("variant", 1, 1);
  assert.equal((await h.service.adjustStock({ ...input, expectedStock: 3, delta: 1 })).ok, false);
  assert.equal(h.db.productVariant.rows.get(1)?.stock, 3);
});

test("two stock changes against the same expected value cannot both succeed", async () => {
  const h = harness(); await h.service.create("variant", inputs.variant);
  const results = await Promise.all([
    h.service.adjustStock({ productId: 1, variantId: 1, expectedStock: 5, delta: -3 }),
    h.service.adjustStock({ productId: 1, variantId: 1, expectedStock: 5, delta: -3 }),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(h.db.productVariant.rows.get(1)?.stock, 2);
});

test("pagination bounds fail before data reads and later pages remain intentional empty lists", async () => {
  const h = harness();
  const bad = await h.service.list("product", { pageSize: 101 });
  assert.equal(bad.ok, false); if (!bad.ok) assert.equal(bad.error.code, "INVALID_INPUT");
  assert.deepEqual(h.calls, []);
  await h.service.create("product", inputs.product);
  const later = await h.service.list("product", { page: 2, pageSize: 1 });
  assert.equal(later.ok, true);
  if (later.ok) { assert.deepEqual(later.data.items, []); assert.equal(later.data.pagination.total, 1); }
});

test("empty lists remain successful; missing rows and DB errors are distinct and sanitized", async () => {
  const h = harness();
  const empty = await h.service.list("product");
  assert.deepEqual(empty, { ok: true, data: { items: [], pagination: pageInfo(1, 20, 0) } });
  const missing = await h.service.get("product", 99);
  assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.error.code, "NOT_FOUND");
  for (const [code, expected] of [["P2002", "CONFLICT"], ["P2003", "CONFLICT"], ["P2025", "NOT_FOUND"], ["P2034", "CONFLICT"], ["P1001", "DATABASE_ERROR"]]) {
    h.setFailure({ code, message: "postgresql://private-credentials" });
    const result = await h.service.create("variant", inputs.variant);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, expected);
    assert.ok(!JSON.stringify(result).includes("private-credentials"));
  }
});

test("image resolver rejects private keys, arbitrary origins and traversal without leaking raw keys", async () => {
  for (const value of ["https://evil.example/a.jpg", "//evil.example/a.jpg", "/images/%2e%2e/a.jpg", "/images/a.svg", "/images/a.jpg?token=x", "/images/a\\b.jpg", "/images/a/./b.jpg", "/images/a\n.jpg", "/images/a.jpg\n"]) assert.equal(publicProductImageUrl(value), null);
  assert.equal(publicProductImageUrl("/images/aurel/image-1.webp"), "/images/aurel/image-1.webp");
  const h = harness();
  const image = await h.service.create("image", { ...inputs.image, storageKey: "public/products/key-only.jpg" });
  assert.equal(image.ok, true);
  assert.ok(!JSON.stringify(image).includes("key-only"));
});

test("pagination validates boundaries and preserves old parser interface without page params", () => {
  assert.deepEqual(pagination({ page: 2, pageSize: 10 }), { page: 2, pageSize: 10, skip: 10, take: 10 });
  assert.deepEqual(pageInfo(2, 10, 21), { page: 2, pageSize: 10, total: 21, totalPages: 3, hasNext: true });
  assert.deepEqual(parseCatalogQuery({}), { q: "", category: "", invalid: false });
  assert.deepEqual(parseCatalogQuery({ page: "2", pageSize: "10" }), { q: "", category: "", invalid: false, page: 2, pageSize: 10 });
  for (const value of [{ page: "0" }, { page: "10001" }, { page: ["1", "2"] }, { page: "1e2" }, { pageSize: "101" }]) assert.equal(parseCatalogQuery(value).invalid, true);
  for (const value of [{ page: NaN }, { page: 0 }, { page: 10001 }, { pageSize: 101 }, { page: "2" }]) assert.throws(() => pagination(value));
});

test("staged price operations fail closed before schema deployment and still authorize", async () => {
  const h = harness();
  const disabled = await h.service.setPrice({productId:1,variantId:1,currency:"USD",amount:"1"});
  assert.equal(disabled.ok,false); if(!disabled.ok) assert.equal(disabled.error.code,"FEATURE_UNAVAILABLE");
  h.setRole("CUSTOMER");
  const denied = await h.service.getPrice(1,1,"USD");
  assert.equal(denied.ok,false); if(!denied.ok) assert.equal(denied.error.code,"FORBIDDEN");
  h.session.resolver=async()=>null;
  const anonymous = await h.service.removePrice(1,1,"USD");
  assert.equal(anonymous.ok,false); if(!anonymous.ok) assert.equal(anonymous.error.code,"UNAUTHENTICATED");
  assert.deepEqual(h.calls,[]);
});
