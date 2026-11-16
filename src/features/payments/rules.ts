import { ShopError } from "../shop/rules.ts";

export const paymentLabels: Record<string, string> = { PENDING: "Chờ thanh toán", PROCESSING: "Đang xử lý thanh toán", PAID: "Đã thanh toán", CANCELLED: "Đã hủy thanh toán", FAILED: "Thanh toán thất bại", EXPIRED: "Thanh toán đã hết hạn" };
export const pendingPayment = (status: string) => status === "PENDING" || status === "PROCESSING";
// NAPAS BIN labels; unknown BIN stays visible instead of guessing a bank.
export function paymentBankName(bin: string | null): string {
  const names: Record<string, string> = { "970422": "MB Bank", "970416": "ACB", "970418": "BIDV", "970448": "OCB", "970415": "VietinBank", "970441": "VIB", "970403": "Sacombank", "970432": "VPBank", "970436": "Vietcombank", "970426": "MSB", "970423": "TPBank" };
  return bin ? `${names[bin] ?? "Ngân hàng"} · BIN ${bin}` : "Xem trên trang payOS";
}
export function payableAmount(value: string, currency: string | null): number {
  if (currency !== "VND" || !/^[1-9]\d*$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) throw new ShopError("Tổng thanh toán VND không hợp lệ.", 409);
  return Number(value);
}
export function paymentOrigin(env: Record<string, string | undefined>): string {
  const raw = env.BETTER_AUTH_URL;
  if (!raw) throw new ShopError("Thanh toán trực tuyến chưa được cấu hình.", 503);
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new ShopError("Thanh toán trực tuyến cần địa chỉ HTTPS chính thức.", 503);
  return url.origin;
}
export function paymentConfig(env: Record<string, string | undefined>, requireEnabled = true) {
  const clientId = env.PAYOS_CLIENT_ID?.trim(), apiKey = env.PAYOS_API_KEY?.trim(), checksumKey = env.PAYOS_CHECKSUM_KEY?.trim();
  if ((requireEnabled && env.PAYOS_ENABLED !== "true") || !clientId || !apiKey || !checksumKey) throw new ShopError("Thanh toán payOS chưa sẵn sàng. Vui lòng chọn COD hoặc thử lại sau.", 503);
  return { clientId, apiKey, checksumKey, origin: paymentOrigin(env) };
}
export function assertOwnedOrder(order: { userId: number; status: string } | null, userId: number) {
  if (!order || order.userId !== userId) throw new ShopError("Không tìm thấy đơn hàng.", 404);
}
export function hostedCheckout(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "pay.payos.vn" || url.username || url.password || url.port) throw new ShopError("Địa chỉ thanh toán không hợp lệ.", 502);
  return url.href;
}
export function payosRedirectUrl(payment: Pick<PaymentView, "status" | "checkoutUrl" | "reconciliationRequired">): string | null {
  if (!pendingPayment(payment.status) || payment.reconciliationRequired || !payment.checkoutUrl) return null;
  return hostedCheckout(payment.checkoutUrl);
}
export function assertPaymentMatch(expected: { orderCode: bigint; expectedAmount: { toString(): string }; paymentLinkId: string | null }, actual: { orderCode: number; amount: number; currency: string; paymentLinkId: string }) {
  if (!Number.isSafeInteger(actual.orderCode) || BigInt(actual.orderCode) !== expected.orderCode || !Number.isSafeInteger(actual.amount) || actual.amount !== payableAmount(expected.expectedAmount.toString(), "VND") || actual.currency !== "VND" || !actual.paymentLinkId || (expected.paymentLinkId && expected.paymentLinkId !== actual.paymentLinkId)) throw new ShopError("Thông tin thanh toán không khớp; cần đối soát.", 409);
}
export type PaymentView = {
  orderId: number; orderNumber: string; status: string; orderStatus: string; amount: string; paidAt: string | null; reconciliationRequired: boolean;
  checkoutUrl: string | null; qrImage: string | null; bankBin: string | null; accountName: string | null; accountNumber: string | null; description: string | null; expiresAt: string | null;
  items: { productName: string; quantity: number; color: string; size: string }[];
  shippingName: string; shippingAddress: string;
};
