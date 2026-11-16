import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  load(url, context, next) {
    if (url.endsWith(".module.css")) {
      return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { SellerPortalNav } = await import("../src/components/admin/seller-portal-nav.tsx");
const { SellerOrders } = await import("../src/components/admin/seller-orders.tsx");
const { SellerReports } = await import("../src/components/admin/seller-reports.tsx");
const { VoucherManager } = await import("../src/components/admin/voucher-manager.tsx");

test("SellerPortalNav marks active section and links all seller modules", () => {
  const html = renderToStaticMarkup(createElement(SellerPortalNav, { active: "reports" }));
  assert.match(html, /href="\/admin\/products"/);
  assert.match(html, /href="\/admin\/orders"/);
  assert.match(html, /aria-current="page"[^>]*href="\/admin\/orders\/reports"/);
  assert.match(html, /href="\/admin\/vouchers"/);
  assert.match(html, /href="\/products"/);
});

test("SellerOrders renders luxury header, four filter cards and refresh control", () => {
  const html = renderToStaticMarkup(createElement(SellerOrders));
  assert.match(html, /AUREL · NGƯỜI BÁN/);
  assert.match(html, /Quản lý đơn hàng/);
  assert.match(html, /Cần xử lý/);
  assert.match(html, /Chờ thanh toán/);
  assert.match(html, /Cần đối soát/);
  assert.match(html, /Tất cả đơn/);
  assert.match(html, /Làm mới đơn hàng/);
});

test("SellerOrders renders tabular order management rows, columns and quick actions", () => {
  const html = renderToStaticMarkup(
    createElement(SellerOrders, {
      initialData: {
        filter: "READY",
        page: 1,
        pages: 1,
        total: 1,
        paymentsAvailable: true,
        counts: { READY: 1, WAITING: 0, REVIEW: 0, ALL: 1 },
        orders: [
          {
            id: 101,
            orderNumber: "DEMO-20-TABLE-101",
            status: "PENDING",
            createdAt: "2026-11-15T02:00:00.000Z",
            totalAmount: "890000",
            subtotalAmount: "890000",
            discountAmount: "0",
            currency: "VND",
            voucherCode: null,
            shippingName: "Nguyễn Văn A",
            shippingPhone: "0901234567",
            shippingAddress: "123 Lê Lợi, Quận 1, TP.HCM",
            payment: null,
            items: [
              {
                productName: "AUREL - ESSENTIAL SHIRT",
                sku: "AUR-SHIRT-M",
                color: "Trắng",
                size: "M",
                quantity: 1,
                unitPrice: "890000",
              },
            ],
          },
        ],
      },
    })
  );
  assert.match(html, /<table/);
  assert.match(html, /Mã đơn &amp; Thời gian/);
  assert.match(html, /Khách hàng &amp; Nhận hàng/);
  assert.match(html, /Sản phẩm đặt mua/);
  assert.match(html, /Thanh toán &amp; Tổng tiền/);
  assert.match(html, /Trạng thái/);
  assert.match(html, /Thao tác/);
  assert.match(html, /DEMO-20-TABLE-101/);
  assert.match(html, /Nguyễn Văn A/);
  assert.match(html, /AUREL - ESSENTIAL SHIRT/);
  assert.match(html, /Xác nhận · Chuẩn bị hàng/);
  assert.match(html, /In phiếu đóng gói ↗/);
});

test("SellerReports renders 24h/7d/30d revenue cards, low-stock section and recent orders", () => {
  const html = renderToStaticMarkup(createElement(SellerReports));
  assert.match(html, /Báo cáo đơn hàng và tồn kho/);
  assert.match(html, /24 giờ gần nhất/);
  assert.match(html, /7 ngày gần nhất/);
  assert.match(html, /30 ngày gần nhất/);
  assert.match(html, /Cảnh báo tồn ≤ 5/);
  assert.match(html, /Bán chạy từ đơn hoàn tất/);
  assert.match(html, /100 đơn gần nhất/);
});

test("SellerOrders keeps an intentional empty state with zero real orders", () => {
  const html = renderToStaticMarkup(createElement(SellerOrders, { initialData: {
    filter: "READY", page: 1, pages: 1, total: 0, paymentsAvailable: true,
    counts: { READY: 0, WAITING: 0, REVIEW: 0, ALL: 0 }, orders: [],
  } }));
  assert.match(html, /Chưa có đơn trong nhóm này/);
  assert.match(html, /Xem tất cả đơn/);
  assert.doesNotMatch(html, /<table/);
});

test("SellerOrders preserves reconciliation warning and blocks fulfillment actions", () => {
  const html = renderToStaticMarkup(createElement(SellerOrders, { initialData: {
    filter: "REVIEW", page: 1, pages: 1, total: 1, paymentsAvailable: true,
    counts: { READY: 0, WAITING: 0, REVIEW: 1, ALL: 1 }, orders: [{
      id: 102, orderNumber: "ORDER-REVIEW-102", status: "PENDING", createdAt: "2026-11-15T02:00:00.000Z",
      totalAmount: "100000", subtotalAmount: "100000", discountAmount: "0", currency: "VND", voucherCode: null,
      shippingName: "Khách kiểm thử", shippingPhone: "0900000000", shippingAddress: "Địa chỉ kiểm thử",
      items: [{ productName: "Sản phẩm kiểm thử", sku: "TEST", color: "Đen", size: "M", quantity: 1, unitPrice: "100000", imageUrl: null }],
      payment: { paidAt: null, reconciliationRequired: true, status: "PROCESSING", reference: null, paymentLinkId: null, paidAmount: "90000" },
    }],
  } }));
  assert.match(html, /Cần đối soát khoản tiền nhận/);
  assert.match(html, /Ảnh không khả dụng/);
  assert.doesNotMatch(html, /Xác nhận · Chuẩn bị hàng/);
  assert.doesNotMatch(html, />Hủy đơn</);
});

test("VoucherManager renders summary KPI strip, two-column form and voucher list panel", () => {
  const html = renderToStaticMarkup(createElement(VoucherManager));
  assert.match(html, /Quản lý voucher/);
  assert.match(html, /Tạo voucher/);
  assert.match(html, /name="code"/);
  assert.match(html, /name="kind"/);
  assert.match(html, /name="value"/);
  assert.match(html, /name="minSubtotal"/);
  assert.match(html, /name="maxDiscount"/);
  assert.match(html, /name="startsAt"/);
  assert.match(html, /name="endsAt"/);
  assert.match(html, /name="usageLimit"/);
  assert.match(html, /name="perUserLimit"/);
  assert.match(html, /name="isActive"/);
  assert.match(html, /Voucher \(tối đa 200 mã gần nhất\)/);
});
