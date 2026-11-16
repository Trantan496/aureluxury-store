export class ShopError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function textValue(value: unknown, label: string, max = 200, min = 1): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new ShopError(`${label} không hợp lệ.`);
  return value.trim();
}
export function integer(value: unknown, min = 1, max = 2147483647): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new ShopError("Số lượng hoặc mã không hợp lệ.");
  return value;
}
export function checkoutInput(input: Record<string, unknown>) {
  const key = textValue(input.key, "Mã yêu cầu", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new ShopError("Mã yêu cầu không hợp lệ.");
  const shippingName = textValue(input.name, "Tên người nhận", 100, 2);
  const shippingPhone = textValue(input.phone, "Số điện thoại", 20, 9);
  if (!/^\+?[0-9 ()-]{9,20}$/.test(shippingPhone)) throw new ShopError("Số điện thoại không hợp lệ.");
  return { key, shippingName, shippingPhone, shippingAddress: textValue(input.address, "Địa chỉ", 500, 10) };
}
export function checkoutSelection(input: Record<string, unknown>): number | null {
  if (input.buyNowVariantId === undefined || input.buyNowVariantId === null) return null;
  return integer(input.buyNowVariantId);
}
export function selectedVariants(input: Record<string, unknown>): number[] | null {
  if (!Array.isArray(input.selectedVariantIds) || input.selectedVariantIds.length === 0) return null;
  return input.selectedVariantIds.map(id => integer(id));
}
export const statusLabels: Record<string, string> = { PENDING: "Chờ xác nhận", CONFIRMED: "Đang chuẩn bị hàng", SHIPPED: "Đã giao vận chuyển", DELIVERED: "Hoàn tất", CANCELLED: "Đã hủy" };
export function canTransition(from: string, to: string, admin: boolean) {
  const allowed: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
  return admin ? (allowed[from] ?? []).includes(to) : from === "PENDING" && to === "CANCELLED";
}
