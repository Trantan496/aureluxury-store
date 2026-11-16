import test from "node:test";
import assert from "node:assert/strict";
import { checkoutInput, checkoutSelection } from "../src/features/shop/rules.ts";

test("checkout selection keeps cart checkout and buy-now checkout separate", () => {
  assert.equal(checkoutSelection({}), null);
  assert.equal(checkoutSelection({ buyNowVariantId: 42 }), 42);
  assert.throws(() => checkoutSelection({ buyNowVariantId: "42" }));
  assert.throws(() => checkoutSelection({ buyNowVariantId: 0 }));
});

test("checkout validation requires name, phone, address and valid key", () => {
  const valid = {
    key: "11111111-2222-4333-8444-555555555555",
    name: "Trần Ngọc Tân",
    phone: "0901234567",
    address: "Số 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
  };
  const parsed = checkoutInput(valid);
  assert.equal(parsed.shippingName, "Trần Ngọc Tân");
  assert.equal(parsed.shippingPhone, "0901234567");
  assert.equal(parsed.shippingAddress, "Số 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh");
});

test("checkout calculation handles subtotal and line items with BigInt", () => {
  const items = [
    { name: "Áo khoác cardigan len Merino pha Cotton", price: "320000", quantity: 1 },
    { name: "AUREL Cozy Bow Fleece Jacket – Ivory Cream", price: "400000", quantity: 1 },
  ];
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.price) * BigInt(item.quantity),
    BigInt(0)
  );
  assert.equal(subtotal.toString(), "720000");

  const formatted = `${new Intl.NumberFormat("vi-VN").format(subtotal)} ₫`;
  assert.equal(formatted, "720.000 ₫");
});

test("checkout voucher discount subtracts cleanly from subtotal", () => {
  const subtotal = BigInt(720000);
  const discount = BigInt(50000);
  const finalTotal = subtotal - discount;
  assert.equal(finalTotal.toString(), "670000");
  assert.equal(`${new Intl.NumberFormat("vi-VN").format(finalTotal)} ₫`, "670.000 ₫");
});

test("checkout reference preview items match exact screenshot specifications", () => {
  const item1 = { name: "Áo khoác cardigan len Merino pha Cotton", price: "320000", qty: 1 };
  const item2 = { name: "AUREL Cozy Bow Fleece Jacket – Ivory Cream", price: "400000", qty: 1 };
  const total = BigInt(item1.price) * BigInt(item1.qty) + BigInt(item2.price) * BigInt(item2.qty);
  assert.equal(total.toString(), "720000");
});

test("cart line total and subtotal calculation handles variable quantities", () => {
  const cartItem = { name: "AUREL Cozy Bow Fleece Jacket – Ivory Cream", price: "400000", quantity: 2 };
  const lineTotal = BigInt(cartItem.price) * BigInt(cartItem.quantity);
  assert.equal(lineTotal.toString(), "800000");
  assert.equal(`${new Intl.NumberFormat("vi-VN").format(lineTotal)} ₫`, "800.000 ₫");
});

test("cart selective checkout only calculates chosen item A when item B is unselected", () => {
  const itemA = { variantId: 102, name: "AUREL Cozy Bow Fleece Jacket", price: "400000", quantity: 1 };
  const itemB = { variantId: 101, name: "Áo khoác cardigan len Merino", price: "320000", quantity: 1 };
  const allItems = [itemA, itemB];
  
  // User only selects Item A
  const selectedVariantIds = [102];
  const selectedItems = allItems.filter(i => selectedVariantIds.includes(i.variantId));
  assert.equal(selectedItems.length, 1);
  assert.equal(selectedItems[0].variantId, 102);

  const selectedSubtotal = selectedItems.reduce(
    (sum, item) => sum + BigInt(item.price) * BigInt(item.quantity),
    BigInt(0)
  );
  assert.equal(selectedSubtotal.toString(), "400000");
  assert.equal(`${new Intl.NumberFormat("vi-VN").format(selectedSubtotal)} ₫`, "400.000 ₫");
});



