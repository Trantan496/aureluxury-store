// Read-only integration tests. Requires the migrated database configured in .env.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getCatalog, getCatalogPage, getSearchPage } from "../src/lib/catalog.ts";
import { normalizeSearchInput } from "../src/features/catalog/catalog.ts";
import { prisma } from "../src/lib/db/client.ts";
import { createProductDataService } from "../src/lib/products.ts";

test("catalog reads PostgreSQL and applies server-side filters without writing fixtures", async () => {
  try {
    const result = await getCatalog({ q: "", category: "", invalid: false });
    assert.equal(result.status, "success");
    if (result.status !== "success") return;
    const expected = await prisma.product.findMany({ where: { isActive: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { id: true } });
    assert.deepEqual(result.products.map(product => product.id), expected.map(product => String(product.id)));
    const scoped = await getCatalog({ q: "", category: "tops", invalid: false });
    assert.equal(scoped.status, "success");
    if (scoped.status === "success") assert.ok(scoped.products.every(product => product.category?.slug === "tops"));
    assert.doesNotThrow(() => JSON.stringify(result));
    const page = await getCatalogPage({ q: "", category: "", invalid: false, page: 1, pageSize: 20 });
    assert.equal(page.status, "success");
    if (page.status === "success") {
      assert.deepEqual(page.products, result.products);
      assert.equal(page.pagination.total, await prisma.product.count({ where: { isActive: true } }));
    }
    // No admin or fixture users are created. A missing DB user must be denied.
    const lastUser = await prisma.user.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const absentUserId = (lastUser?.id ?? 0) + 1;
    if (absentUserId <= 2147483647) {
      const service = createProductDataService(async () => ({ userId: absentUserId, expiresAt: Date.now() + 60000 }));
      const denied = await service.list("product");
      assert.equal(denied.ok, false);
      if (!denied.ok) assert.equal(denied.error.code, "FORBIDDEN");
    }
    const anonymous = createProductDataService(async () => null);
    const denied = await anonymous.list("product");
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.error.code, "UNAUTHENTICATED");
  } finally {
    await prisma.$disconnect();
  }
});

for (const mode of ["unreachable", "missing-config"]) {
  test(`catalog returns sanitized error for ${mode}`, () => {
    const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      ${mode === "unreachable" ? "process.env.DATABASE_URL = 'postgresql://unit:private-secret@127.0.0.1:1/unavailable';" : "delete process.env.DATABASE_URL;"}
      const { getCatalog, getCatalogPage } = await import('./src/lib/catalog.ts');
      assert.deepEqual(await getCatalog({q:'', category:'', invalid:false}), {status:'error'});
      assert.deepEqual(await getCatalogPage({q:'', category:'', invalid:false}), {status:'error'});
      process.env.MULTI_CURRENCY_ENABLED = 'true';
      assert.deepEqual(await getCatalog({q:'',category:'',invalid:false,currency:'USD'}),{status:'error'});
      const { createProductDataService } = await import('./src/lib/products.ts');
      const service = createProductDataService(async () => ({userId: 1, expiresAt: Date.now() + 60000}));
      const result = await service.list('product');
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'DATABASE_ERROR');
      const priced = await service.getPrice(1,1,'USD');
      assert.equal(priced.ok,false); assert.equal(priced.error.code,'DATABASE_ERROR');
      console.log('sanitized error OK');
    `], { encoding: "utf8", timeout: 20000, windowsHide: true });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /sanitized error OK/);
    assert.ok(!child.stdout.includes("private-secret"));
  });
}

test("search ranks and returns a real active product for exact, partial, and diacritic-free input", async () => {
  try {
    const product = await prisma.product.findFirst({ where: { isActive: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true } });
    if (!product) return;
    const partial = product.name.trim().split(/\s+/)[0] ?? product.name;
    for (const q of [product.name, partial, normalizeSearchInput(product.name)]) {
      const result = await getSearchPage({ q, category: "", invalid: false, page: 1, pageSize: 12 });
      assert.equal(result.status, "success");
      if (result.status === "success") assert.ok(result.products.some(row => row.id === String(product.id)));
    }
    const exact = await getSearchPage({ q: product.name, category: "", invalid: false, page: 1, pageSize: 12 });
    if (exact.status === "success") assert.equal(exact.products[0]?.id, String(product.id));
  } finally { await prisma.$disconnect(); }
});
