import test from "node:test";
import assert from "node:assert/strict";
import { currency, money, storefrontCurrency } from "../src/features/money/money.ts";
import { orderSnapshot } from "../src/features/orders/pricing.ts";
import { parseCatalogQuery } from "../src/features/catalog/catalog.ts";
const line = { variantId: 1, quantity: 3, productName: "Test", sku: "Test", color: "Blue", size: "M" };
test("storefront defaults to tagged VND independently of optional currency selection",()=>{
  assert.equal(storefrontCurrency(undefined,false),"VND");assert.equal(storefrontCurrency(undefined,true),"VND");
  assert.equal(storefrontCurrency("USD",false),"VND");assert.equal(storefrontCurrency("USD",true),"USD");
});
test("independent currency precision rejects rounding and ambiguous amounts", () => {
  assert.equal(money("299000", "VND"), "299000");
  assert.equal(money("12.1", "USD"), "12.10"); assert.equal(money("10.99", "EUR"), "10.99");
  for (const value of ["-1", "1e3", "01", "NaN", "Infinity", "1.001", 1, "1000000000000000000"]) assert.throws(() => money(value, "USD"));
  assert.throws(() => money("1.0", "VND")); assert.throws(() => currency("GBP"));
  assert.equal(parseCatalogQuery({ currency: "GBP" }).invalid, true);
  assert.equal(parseCatalogQuery({ currency: "EUR" }).currency, "EUR");
});
test("multi-product order snapshots use exact minor units and one currency", () => {
  for (const currency of ["VND", "USD", "EUR"] as const) {
    const unitPrice = currency === "VND" ? "10" : "0.10";
    const snapshot = orderSnapshot(currency, [{ ...line, currency, unitPrice }, { ...line, variantId: 2, quantity: 2, currency, unitPrice }]);
    assert.equal(snapshot.totalAmount, currency === "VND" ? "50" : "0.50");
  }
  assert.throws(() => orderSnapshot("USD", []));
  assert.throws(() => orderSnapshot("USD", [{ ...line, currency: "EUR", unitPrice: "1" }]));
  assert.throws(() => orderSnapshot("USD", [{ ...line, quantity: 0, currency: "USD", unitPrice: "1" }]));
  assert.throws(() => orderSnapshot("USD", [{ ...line, currency: "USD", unitPrice: "999999999999999999.99", quantity: 2147483647 }]));
});
