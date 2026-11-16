import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "@prisma/client/runtime/client";
import { catalogWhere, catalogProductSelect, mapCatalogProduct, type CatalogRecord } from "../src/features/catalog/prisma-catalog.ts";
import { getCollectionPreview } from "../src/features/collection/preview.ts";
test("Women and Men navigation filters use profile gender plus unisex with category intersection", () => {
  const women = catalogWhere({ q: "", category: "accessories", gender: "women", invalid: false });
  assert.deepEqual(women.profile, { is: { gender: { in: ["women", "unisex"] } } });
  assert.deepEqual(women.category, { slug: "accessories" });
  assert.equal(women.isActive, true);
  assert.deepEqual(catalogWhere({ q: "", category: "", gender: "men", invalid: false }).profile, { is: { gender: { in: ["men", "unisex"] } } });
  assert.equal(catalogWhere({ q: "", category: "", invalid: false }).profile, undefined);
});

function record(): CatalogRecord {
  return {
    id: 42, name: "Unit fixture only", slug: "unit-only", brand: null, description: null,
    category: { id: 3, name: "Tops", slug: "tops" },
    variants: [
      { id: 1, sku: "UNIT-1", color: "Blue", size: "M", price: new Decimal("9999999999.99"), stock: 0 },
      { id: 2, sku: "UNIT-2", color: "Blue", size: "L", price: new Decimal("10.10"), stock: 3 },
    ],
    images: [{ id: 1, storageKey: "/images/unit-only.jpg", altText: "Unit image", sortOrder: 0 }],
  };
}

test("Prisma mapping preserves decimal precision and serializes only public catalog data", () => {
  const product = mapCatalogProduct(record());
  assert.equal(product.id, "42");
  assert.deepEqual(product.category, { id: "3", name: "Tops", slug: "tops" });
  assert.equal(product.price, "10.10");
  assert.equal(product.variants?.[0].price, "9999999999.99");
  assert.equal(product.variants?.[0].stock, 0);
  assert.equal(product.stock, 3);
  assert.deepEqual(product.colors, ["Blue"]);
  assert.deepEqual(product.sizes, ["M", "L"]);
  assert.deepEqual(JSON.parse(JSON.stringify(product)), product);
  const preview = getCollectionPreview({ status: "success", products: [product] });
  assert.equal(preview.pieces[0].image, "/images/unit-only.jpg");
  assert.equal(preview.pieces[0].imageAlt, "Unit image");
  assert.equal(preview.pieces[0].price, "10.10");
  assert.equal(preview.pieces[0].category, "clothing");
  assert.equal(preview.demo, false);
});

test("no active variants or public image does not invent price, stock or image", () => {
  const input = record();
  input.variants = [];
  for (const storageKey of ["private/bucket/key", "https://example.com/a.jpg", "/images/../private.jpg", "/images/%2e%2e/private.jpg"]) {
    input.images[0].storageKey = storageKey;
    const product = mapCatalogProduct(input);
    assert.equal(product.price, null);
    assert.equal(product.stock, 0);
    assert.deepEqual(product.colors, []);
    assert.equal(product.images?.[0].url, null);
  }
});

test("query scopes active products and variants, category and search without hiding sold-out products", () => {
  const where = catalogWhere({ q: "Blue", category: "tops", invalid: false });
  assert.equal(where.isActive, true);
  assert.deepEqual(where.category, { slug: "tops" });
  assert.ok(where.OR?.length);
  assert.deepEqual(catalogProductSelect.variants.where, { isActive: true });
  assert.deepEqual(catalogProductSelect.images.orderBy, [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }]);
  assert.deepEqual(catalogWhere({ q: "", category: "", invalid: false }), { isActive: true });
  assert.ok(JSON.stringify(catalogWhere({ q: "%_", category: "", invalid: false })).includes('\\\\%\\\\_'));
});

test("currency mapping never falls back to legacy or another currency", () => {
  const source = record();
  const priced = { ...source, variants: source.variants.map((v,i) => ({ ...v, prices: i===0 ? [{ currency:"USD" as const, amount:new Decimal("2.30") },{currency:"EUR" as const,amount:new Decimal("1.20")}] : [] })) };
  assert.equal(mapCatalogProduct(priced,"USD").price,"2.30");
  assert.equal(mapCatalogProduct(priced,"EUR").price,"1.20");
  const missing = mapCatalogProduct(priced,"VND");
  assert.equal(missing.price,null); assert.equal(missing.priceStatus,"missing");
  assert.ok(missing.variants?.every(v=>v.price===null));
  assert.equal(mapCatalogProduct(source).currency,null);
  assert.equal(mapCatalogProduct(source).priceStatus,"legacy_unassigned");
  source.variants[0].price=null; source.variants[1].price=null;
  assert.equal(mapCatalogProduct(source).price,null);
});
