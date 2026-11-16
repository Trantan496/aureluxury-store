import test from "node:test";
import assert from "node:assert/strict";
import {
  formatOrderDate,
  formatStatusSubtext,
  formatDisplayOrderNumber,
} from "../src/features/orders/user-orders-formatting.ts";

test("formatOrderDate formats into Vietnamese order date string", () => {
  const date = new Date("2026-11-02T10:00:00.000Z");
  assert.equal(formatOrderDate(date), "Đặt ngày 02 Th11, 2026");
});

test("formatStatusSubtext returns delivery ETA and status notes", () => {
  const date = new Date("2026-11-02T10:00:00.000Z");
  assert.equal(formatStatusSubtext("DELIVERED", date), "Giao thành công vào 04 Th11, 2026");
  assert.equal(formatStatusSubtext("SHIPPED", date), "Dự kiến giao: 05 Th11, 2026");
  assert.equal(formatStatusSubtext("PENDING", date), "Đơn hàng đang được kiểm tra.");
  assert.equal(formatStatusSubtext("CONFIRMED", date), "Đơn hàng đang được chuẩn bị đóng gói.");
  assert.equal(formatStatusSubtext("CANCELLED", date), "Đơn hàng đã được hủy.");
});

test("formatDisplayOrderNumber standardizes order numbers for display", () => {
  assert.equal(formatDisplayOrderNumber("DEMO-1-abc", 2839), "#AUR102839");
  assert.equal(formatDisplayOrderNumber("AUR102771", 1), "#AUR102771");
  assert.equal(formatDisplayOrderNumber("#AUR102690", 2), "#AUR102690");
});
