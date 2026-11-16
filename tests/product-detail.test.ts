import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "@prisma/client/runtime/client";
import { loadProductDetail, productDetailHref, toProductDetail, selectDetailVariant, formatDetailPrice } from "../src/features/catalog/product-detail.ts";
import { mapProductDetailRecord, productDetailSelect, type CatalogRecord } from "../src/features/catalog/prisma-catalog.ts";
import { getCollectionPreview } from "../src/features/collection/preview.ts";

function record(): CatalogRecord {
  return { id: 1, slug: "unit-detail", name: "Unit-only product", brand: null, description: null,
    category: { id: 1, slug: "tops", name: "Tops" },
    variants: [
      { id: 1, sku: "UNIT-1", color: "Blue", size: "M", stock: 0, price: new Decimal("12.34") },
      { id: 2, sku: "UNIT-2", color: "Blue", size: "L", stock: 4, price: new Decimal("9999999999.99") },
      { id: 3, sku: "UNIT-3", color: "Red", size: "M", stock: 2, price: new Decimal("0") },
    ], images: [{ id: 1, storageKey: "/images/unit-only.jpg", altText: null, sortOrder: 0 }],
  };
}

test("detail validates slug before reads and links only valid product slugs", async () => {
  let reads = 0;
  for (const slug of ["", "../private", "UPPER", "a/b", "x".repeat(201), "%2f"]) {
    assert.equal((await loadProductDetail(async () => { reads++; return null; }, slug)).status, "not_found");
    assert.equal(productDetailHref(slug), null);
  }
  assert.equal(reads, 0);
  const result = await loadProductDetail(async where => {
    assert.deepEqual(where, { slug: "unit-detail", isActive: true });
    return mapProductDetailRecord(record());
  }, "unit-detail");
  assert.equal(result.status, "success");
  assert.equal(productDetailHref("unit-detail"), "/products/unit-detail");
  assert.equal(getCollectionPreview({ status: "success", products: [mapProductDetailRecord(record())] }).pieces[0].href, "/products/unit-detail");
});

test("inactive/not-found is distinct from database failure and empty product relations", async () => {
  const inactive = { ...record(), isActive: false };
  const hidden = await loadProductDetail(async where => inactive.isActive === where.isActive ? mapProductDetailRecord(inactive) : null, "unit-detail");
  assert.equal(hidden.status, "not_found");
  assert.equal((await loadProductDetail(async () => null, "unit-detail")).status, "not_found");
  assert.deepEqual(await loadProductDetail(async () => { throw new Error("private database detail"); }, "unit-detail"), { status: "error" });
  const empty = toProductDetail(mapProductDetailRecord({ ...record(), variants: [], images: [] }));
  assert.deepEqual(empty.variants, []); assert.deepEqual(empty.images, []);
  assert.deepEqual(productDetailSelect(undefined, false).variants.where, { isActive: true });
});

test("variant selection permits existing color/size pairs only and preserves sold-out stock", () => {
  const variants = toProductDetail(mapProductDetailRecord(record())).variants;
  const initial = selectDetailVariant(variants)!;
  assert.equal(initial.sku, "UNIT-2");
  const soldOut = selectDetailVariant(variants, initial.id, { size: "M" })!;
  assert.equal(soldOut.sku, "UNIT-1"); assert.equal(soldOut.stock, 0);
  const red = selectDetailVariant(variants, initial.id, { color: "Red" })!;
  assert.equal(red.size, "M");
  assert.equal(selectDetailVariant(variants, red.id, { size: "L" })?.id, red.id);
  assert.equal(selectDetailVariant([], undefined), null);
});

test("gallery DTO uses the public resolver, name fallback and never exposes storage keys", () => {
  for (const storageKey of ["private/customer/key", "https://other.test/a.jpg", "/images/%2e%2e/key.jpg", "/images/../key.jpg"]) {
    const product = record(); product.images[0].storageKey = storageKey;
    const detail = toProductDetail(mapProductDetailRecord(product));
    assert.deepEqual(detail.images, []); assert.ok(!JSON.stringify(detail).includes(storageKey));
  }
  const detail = toProductDetail(mapProductDetailRecord(record()));
  assert.equal(detail.images[0].url, "/images/unit-only.jpg"); assert.equal(detail.images[0].alt, detail.name);
  assert.ok(!JSON.stringify(detail).includes("storageKey"));
});

test("currency staging never queries ProductPrice when off or displays legacy amounts; exact prices have no fallback/rounding", () => {
  const disabled = productDetailSelect("USD", false);
  assert.ok(!JSON.stringify(disabled).includes('"prices"'));
  assert.ok(!JSON.stringify(productDetailSelect(undefined, true)).includes('"prices"'));
  const legacy = toProductDetail(mapProductDetailRecord(record()));
  assert.equal(legacy.currency, null); assert.ok(legacy.variants.every(variant => variant.price === null));
  assert.ok(!JSON.stringify(legacy).includes("9999999999.99"));
  const priced = { ...record(), variants: record().variants.map(variant => ({ ...variant, prices: [
    { currency: "VND" as const, amount: new Decimal("123456789012345678") },
    { currency: "USD" as const, amount: new Decimal("0.10") },
  ] })) };
  for (const unit of ["VND", "USD", "EUR"] as const) {
    const detail = toProductDetail(mapProductDetailRecord(priced, unit));
    const selected = productDetailSelect(unit, true);
    assert.ok("prices" in selected.variants.select);
    if ("prices" in selected.variants.select) assert.deepEqual(selected.variants.select.prices.where, { currency: unit });
    assert.equal(detail.variants[0].price?.currency ?? null, unit === "EUR" ? null : unit);
  }
  assert.equal(formatDetailPrice({ amount: "123456789012345678", currency: "VND" }), "123.456.789.012.345.678 VND");
  assert.equal(formatDetailPrice({ amount: "0", currency: "USD" }), "0,00 USD");
  const invalid = { ...priced, variants: [{ ...priced.variants[0], prices: [{ currency: "USD" as const, amount: new Decimal("1.001") }] }] };
  assert.throws(() => mapProductDetailRecord(invalid, "USD"));
});
