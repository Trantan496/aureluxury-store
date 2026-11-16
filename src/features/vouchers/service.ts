import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ShopError, integer } from "@/features/shop/rules";
import { discountFor, voucherCode, voucherInput } from "./rules";
type Tx = Prisma.TransactionClient;

export async function requireVoucherAdmin(tx: Tx, userId: number) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new ShopError("Chỉ quản trị viên được quản lý voucher.", 403);
}
export async function voucherQuote(tx: Tx, userId: number, rawCode: unknown, subtotal: string, lock = false) {
  const code = voucherCode(rawCode);
  if (lock) await tx.$queryRaw`SELECT id FROM "Voucher" WHERE code = ${code} FOR UPDATE`;
  const voucher = await tx.voucher.findUnique({ where: { code } });
  const now = new Date();
  if (!voucher || !voucher.isActive) throw new ShopError("Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.");
  if (now < voucher.startsAt || now >= voucher.endsAt) throw new ShopError("Mã chưa đến hạn hoặc đã hết hạn.");
  if (BigInt(subtotal) < BigInt(voucher.minSubtotal.toString())) throw new ShopError(`Đơn tối thiểu ${voucher.minSubtotal.toString()} VND để dùng mã này.`);
  // Sequential queries on a transaction connection (avoid concurrent pg queries).
  const totalUses = await tx.voucherRedemption.count({ where: { voucherId: voucher.id, releasedAt: null } });
  const userUses = await tx.voucherRedemption.count({ where: { voucherId: voucher.id, userId, releasedAt: null } });
  if (voucher.usageLimit !== null && totalUses >= voucher.usageLimit) throw new ShopError("Mã đã hết lượt sử dụng.", 409);
  if (userUses >= voucher.perUserLimit) throw new ShopError("Bạn đã dùng hết lượt cho mã này.", 409);
  const totals = discountFor(subtotal, { kind: voucher.kind, value: voucher.value.toString(), maxDiscount: voucher.maxDiscount?.toString() ?? null });
  if (totals.discountAmount === "0") throw new ShopError("Mã này chưa tạo khoản giảm cho giỏ hàng hiện tại.");
  // A real row write invalidates stale serializable snapshots waiting on this code.
  // Admin forms must reload after a redemption rather than overwrite newer usage state.
  if (lock) await tx.voucher.update({ where: { id: voucher.id }, data: { version: { increment: 1 } } });
  return { ...totals, voucherCode: code, voucherId: voucher.id };
}
export async function voucherList(tx: Tx, userId: number) {
  await requireVoucherAdmin(tx, userId);
  const rows = await tx.voucher.findMany({ orderBy: { id: "desc" }, take: 200, include: { _count: { select: { redemptions: { where: { releasedAt: null } } } } } });
  return rows;
}
export async function voucherSave(tx: Tx, userId: number, input: Record<string, unknown>) {
  await requireVoucherAdmin(tx, userId);
  const data = voucherInput(input);
  if (input.id == null) return tx.voucher.create({ data });
  const id = integer(input.id), version = integer(input.version);
  await tx.$queryRaw`SELECT id FROM "Voucher" WHERE id = ${id} FOR UPDATE`;
  const previous = await tx.voucher.findUnique({ where: { id } });
  if (!previous) throw new ShopError("Không tìm thấy voucher.", 404);
  if (previous.code !== data.code) throw new ShopError("Không đổi mã đã tạo; hãy tắt mã cũ và tạo mã mới.");
  const updated = await tx.voucher.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  if (updated.count !== 1) throw new ShopError("Voucher đã được sửa ở nơi khác. Tải lại trước khi lưu.", 409);
  return { saved: true };
}
