import test from "node:test";
import assert from "node:assert/strict";
import { checkoutInput, canTransition, integer } from "../src/features/shop/rules.ts";
import { parseCatalogQuery } from "../src/features/catalog/catalog.ts";
import { catalogWhere } from "../src/features/catalog/prisma-catalog.ts";
test("checkout rejects missing/malformed request key, recipient and phone", () => {
  const valid = { key: "00000000-0000-4000-8000-000000000000", name: "Demo User", phone: "0900000000", address: "Demo address only" };
  assert.equal(checkoutInput(valid).shippingName, "Demo User");
  for (const change of [{ key: "x" }, { name: "" }, { phone: "<script>" }, { address: "short" }]) assert.throws(() => checkoutInput({ ...valid, ...change }));
  for (const qty of [-1, 100, 1.5, "1", NaN]) assert.throws(() => integer(qty, 0, 99));
});
test("order lifecycle prevents reactivation, repeated cancellation and customer shipping", () => {
  assert.equal(canTransition("PENDING", "CANCELLED", false), true);
  assert.equal(canTransition("CONFIRMED", "CANCELLED", false), false);
  assert.equal(canTransition("PENDING", "DELIVERED", true), false);
  assert.equal(canTransition("CANCELLED", "PENDING", true), false);
  assert.equal(canTransition("CANCELLED", "CANCELLED", true), false);
  assert.equal(canTransition("SHIPPED", "CANCELLED", true), false);
  assert.equal(canTransition("CONFIRMED", "SHIPPED", true), true);
});
test("custom categories and optional empty filter fields work; ranges are validated", () => {
  assert.equal(parseCatalogQuery({ category: "ao-thun", gender: "", minPrice: "", brand: "" }).invalid, false);
  for (const params of [{ minPrice: "-1" }, { minPrice: "2", maxPrice: "1" }, { size: ["M", "L"] }, { maxPrice: "1e5" }]) assert.equal(parseCatalogQuery(params).invalid, true);
  const where = catalogWhere(parseCatalogQuery({ color: "black", size: "M", minPrice: "100000", maxPrice: "300000", brand: "AUREL" }));
  assert.deepEqual(where.variants, { some: { isActive: true, size: { equals: "M", mode: "insensitive" }, color: { equals: "black", mode: "insensitive" }, prices: { some: { currency: "VND", amount: { gte: 100000, lte: 300000 } } } } });
});
