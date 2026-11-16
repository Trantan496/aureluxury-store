import { canTransition, ShopError } from "../shop/rules.ts";

export const sellerFilters = { READY: "Cần xử lý", WAITING: "Chờ thanh toán", REVIEW: "Cần đối soát", ALL: "Tất cả đơn" } as const;
export type SellerFilter = keyof typeof sellerFilters;
export type SellerPayment = { paidAt: string | null; reconciliationRequired: boolean; status: string; reference: string | null; paymentLinkId: string | null; paidAmount: string | null };
export type SellerOrder = {
  id: number; orderNumber: string; status: string; createdAt: string; totalAmount: string; currency: string | null;
  subtotalAmount: string | null; discountAmount: string; voucherCode: string | null;
  shippingName: string; shippingPhone: string; shippingAddress: string; payment: SellerPayment | null;
  items: { imageUrl?: string | null; productName: string; sku: string; color: string; size: string; quantity: number; unitPrice: string }[];
};
export type SellerOrdersPage = { orders: SellerOrder[]; counts: Record<SellerFilter, number>; filter: SellerFilter; page: number; pages: number; total: number; paymentsAvailable: boolean };
export function sellerQuery(params: URLSearchParams) {
  const filters = params.getAll("filter"), pages = params.getAll("page");
  const filter = filters[0] ?? "READY", page = pages[0] ?? "1";
  if (filters.length > 1 || pages.length > 1 || !(filter in sellerFilters) || !Object.hasOwn(sellerFilters, filter) || !/^[1-9]\d{0,3}$/.test(page)) throw new ShopError("Bộ lọc hoặc trang không hợp lệ.");
  return { filter: filter as SellerFilter, page: Number(page) };
}
export function sellerActions(order: Pick<SellerOrder, "status" | "orderNumber" | "payment">) {
  const payment = order.payment;
  if (!payment && !order.orderNumber.startsWith("DEMO-")) return [];
  if (payment?.reconciliationRequired) return [];
  const targets = ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
  return targets.filter(target => {
    if (!canTransition(order.status, target, true)) return false;
    if (!payment) return true;
    return target === "CANCELLED" ? !payment.paidAt && !["PENDING", "PROCESSING"].includes(payment.status) : !!payment.paidAt;
  });
}
