import { money } from "@/features/money/money";
import { ShopError, integer, textValue } from "@/features/shop/rules";

export function voucherCode(value: unknown): string {
  const code = textValue(value, "Mã giảm giá", 32).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) throw new ShopError("Mã gồm 3–32 chữ, số, dấu gạch ngang hoặc gạch dưới.");
  return code;
}
function amount(value: unknown, label: string, positive = false) {
  try {
    const result = money(value, "VND");
    if (positive && BigInt(result) === BigInt(0)) throw new Error();
    return result;
  } catch { throw new ShopError(`${label} phải là số nguyên VND hợp lệ.`); }
}
export function voucherInput(input: Record<string, unknown>) {
  const kind = input.kind;
  if (kind !== "FIXED" && kind !== "PERCENT") throw new ShopError("Loại giảm giá không hợp lệ.");
  const value = amount(input.value, "Mức giảm", true);
  if (kind === "PERCENT" && BigInt(value) > BigInt(100)) throw new ShopError("Phần trăm phải từ 1 đến 100.");
  function instant(value: unknown) {
    const raw = textValue(value, "Thời gian", 40);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(raw)) throw new ShopError("Thời gian cần có múi giờ.");
    const result = new Date(raw);
    if (!Number.isFinite(result.getTime())) throw new ShopError("Thời gian không hợp lệ.");
    return result;
  }
  const startsAt = instant(input.startsAt), endsAt = instant(input.endsAt);
  if (startsAt >= endsAt) throw new ShopError("Ngày kết thúc phải sau ngày bắt đầu.");
  if (typeof input.isActive !== "boolean") throw new ShopError("Trạng thái mã không hợp lệ.");
  return { code: voucherCode(input.code), kind, value, minSubtotal: amount(input.minSubtotal, "Đơn tối thiểu"), maxDiscount: input.maxDiscount === "" || input.maxDiscount == null ? null : amount(input.maxDiscount, "Trần giảm", true), startsAt, endsAt, usageLimit: input.usageLimit === "" || input.usageLimit == null ? null : integer(input.usageLimit), perUserLimit: integer(input.perUserLimit, 1, 1000000), isActive: input.isActive };
}
export function discountFor(subtotal: string, voucher: { kind: string; value: string; maxDiscount: string | null }) {
  const gross = BigInt(money(subtotal, "VND", 22));
  let discount = voucher.kind === "PERCENT" ? gross * BigInt(voucher.value) / BigInt(100) : BigInt(voucher.value);
  if (voucher.maxDiscount !== null && discount > BigInt(voucher.maxDiscount)) discount = BigInt(voucher.maxDiscount);
  if (discount > gross) discount = gross;
  return { subtotalAmount: gross.toString(), discountAmount: discount.toString(), totalAmount: (gross - discount).toString() };
}
