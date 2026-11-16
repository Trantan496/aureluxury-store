import "server-only";
import { prisma } from "@/lib/db/client";
import { resolveProductSession } from "@/lib/auth-session";
import type { Prisma, OrderStatus } from "@/generated/prisma/client";
import { orderSnapshot } from "@/features/orders/pricing";
import { ShopError, checkoutInput, checkoutSelection, integer, selectedVariants, textValue, canTransition } from "./rules";
import { voucherQuote, voucherList, voucherSave } from "@/features/vouchers/service";

type Tx = Prisma.TransactionClient;
export async function shopActor() {
  const session = await resolveProductSession();
  if (!session) throw new ShopError("Vui lòng đăng nhập để tiếp tục.", 401);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!user) throw new ShopError("Phiên đăng nhập không hợp lệ.", 401);
  return user;
}
async function transaction<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  // Only retry fully rolled-back serializable transactions, never external effects.
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: "Serializable", timeout: 15000 }); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue;
      if (code === "P2034" || code === "P2002") throw new ShopError("Dữ liệu vừa thay đổi. Vui lòng thử lại.", 409);
      throw error;
    }
  }
}
async function lockUser(tx: Tx, userId: number) { await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`; }
const variantInclude = { product: { select: { name: true, slug: true, isActive: true, images: { take: 1, orderBy: { sortOrder: "asc" as const }, select: { storageKey: true } } } }, prices: { where: { currency: "VND" as const } } };
async function checkoutSnapshot(tx: Tx, userId: number, buyNowVariantId: number | null = null, selectedVariantIds: number[] | null = null) {
  if (buyNowVariantId !== null) {
    const variant = await tx.productVariant.findUnique({ where: { id: buyNowVariantId }, include: variantInclude });
    if (!variant?.isActive || !variant.product.isActive || !variant.prices[0] || variant.stock < 1) throw new ShopError("Sản phẩm đã hết hàng hoặc giá chưa khả dụng.", 409);
    const line = { variantId: variant.id, quantity: 1, currency: "VND" as const, unitPrice: variant.prices[0].amount.toString(), productName: variant.product.name, sku: variant.sku, color: variant.color, size: variant.size };
    return { cartId: null, snapshot: orderSnapshot("VND", [line]), checkedOutVariantIds: [variant.id] };
  }
  const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { orderBy: { variantId: "asc" }, include: { variant: { include: variantInclude } } } } });
  if (!cart?.items.length) throw new ShopError("Giỏ hàng đang trống.");
  const candidateItems = selectedVariantIds && selectedVariantIds.length > 0
    ? cart.items.filter(item => selectedVariantIds.includes(item.variantId))
    : cart.items;
  if (!candidateItems.length) throw new ShopError("Chưa có sản phẩm nào được chọn để thanh toán.");
  const lines = candidateItems.map(item => {
    const v = item.variant;
    if (!v.isActive || !v.product.isActive || !v.prices[0] || v.stock < item.quantity) throw new ShopError(`${v.product.name}: hết hàng hoặc giá chưa khả dụng.`, 409);
    integer(item.quantity, 1, 99);
    return { variantId: v.id, quantity: item.quantity, currency: "VND" as const, unitPrice: v.prices[0].amount.toString(), productName: v.product.name, sku: v.sku, color: v.color, size: v.size };
  });
  return { cartId: cart.id, snapshot: orderSnapshot("VND", lines), checkedOutVariantIds: candidateItems.map(i => i.variantId) };
}
function hasVoucher(value: unknown) { return value !== undefined && value !== null && value !== ""; }
export async function cartFor(userId: number) {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { orderBy: { id: "asc" }, include: { variant: { include: variantInclude } } } } });
  const items = (cart?.items ?? []).map(item => ({ id: item.id, variantId: item.variantId, quantity: item.quantity, name: item.variant.product.name, slug: item.variant.product.slug, color: item.variant.color, size: item.variant.size, stock: item.variant.stock, price: item.variant.prices[0]?.amount.toString() ?? null, available: item.variant.isActive && item.variant.product.isActive, image: item.variant.product.images[0]?.storageKey ?? null }));
  return { items };
}
async function buyNowFor(variantId: number) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: variantInclude });
  if (!variant?.isActive || !variant.product.isActive) throw new ShopError("Sản phẩm không còn được mở bán.", 404);
  return { items: [{ variantId: variant.id, quantity: 1, name: variant.product.name, slug: variant.product.slug, color: variant.color, size: variant.size, stock: variant.stock, price: variant.prices[0]?.amount.toString() ?? null, available: Boolean(variant.prices[0]) && variant.stock > 0, image: variant.product.images[0]?.storageKey ?? null }] };
}
export async function shopRead(view: string, input: Record<string, unknown> = {}) {
  const actor = await shopActor();
  // This is display-only account context. Every administrative mutation and
  // route continues to resolve the role again on the server.
  if (view === "account") return { isAdmin: actor.role === "ADMIN" };
  if (view === "vouchers") return transaction(tx => voucherList(tx, actor.id));
  if (view === "cart") return cartFor(actor.id);
  if (view === "buy-now") return buyNowFor(checkoutSelection(input) ?? 0);
  if (view === "profile") return prisma.user.findUnique({ where: { id: actor.id }, select: { fullName: true, email: true, city: true, birthYear: true, addresses: { orderBy: { id: "desc" }, take: 1 } } });
  if (view === "favorites") return prisma.favorite.findMany({ where: { userId: actor.id, product: { isActive: true } }, select: { product: { select: { id: true, name: true, slug: true } } }, take: 100 });
  if (view === "orders" || view === "admin") {
    const admin = view === "admin";
    if (admin && actor.role !== "ADMIN") throw new ShopError("Chỉ quản trị viên được truy cập.", 403);
    const orders = await prisma.order.findMany({ where: admin ? {} : { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, orderNumber: true, status: true, totalAmount: true, subtotalAmount: true, discountAmount: true, voucherCode: true, currency: true, createdAt: true, shippingName: true, shippingPhone: true, shippingAddress: true, items: { select: { productName: true, sku: true, color: true, size: true, quantity: true, unitPrice: true, lineTotal: true } } } });
    const { paymentsAvailable } = await import("@/features/payments/service");
    const payments = await paymentsAvailable() ? await prisma.onlinePayment.findMany({ where: { orderId: { in: orders.map(order => order.id) } }, include: { attempts: { orderBy: { orderCode: "desc" }, take: 20, select: { status: true, paymentLinkId: true, paidAmount: true, reference: true, transactionReferences: true, paidAt: true, receipts: { select: { reference: true, amount: true, currency: true, receivedAt: true }, take: 100, orderBy: { receivedAt: "desc" } } } } } }) : [];
    const enrichedOrders = orders.map(order => ({ ...order, payment: payments.find(payment => payment.orderId === order.id) ?? null }));
    if (!admin) return { orders: enrichedOrders };
    const [daily, lowStock, bestSellers] = await Promise.all([
      prisma.order.findMany({ where: { currency: "VND", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { totalAmount: true, status: true, createdAt: true } }),
      prisma.productVariant.findMany({ where: { isActive: true, stock: { lte: 5 }, product: { isActive: true } }, select: { id: true, sku: true, stock: true, color: true, size: true, product: { select: { name: true } } }, take: 100, orderBy: { stock: "asc" } }),
      prisma.orderItem.groupBy({ by: ["productName"], where: { order: { status: "DELIVERED", currency: "VND" } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 }),
    ]);
    return { orders: enrichedOrders, daily, lowStock, bestSellers };
  }
  throw new ShopError("Không tìm thấy chức năng.", 404);
}
export async function shopWrite(input: Record<string, unknown>) {
  const actor = await shopActor();
  const action = input.action;
  if (action === "voucher-save") return transaction(tx => voucherSave(tx, actor.id, input));
  if (action === "voucher-quote") {
    const buyNowVariantId = checkoutSelection(input);
    const selectedVariantIds = selectedVariants(input);
    return transaction(async tx => {
      await lockUser(tx, actor.id);
      const { snapshot } = await checkoutSnapshot(tx, actor.id, buyNowVariantId, selectedVariantIds);
      if (hasVoucher(input.code)) {
        const { voucherId: _voucherId, ...quote } = await voucherQuote(tx, actor.id, input.code, snapshot.totalAmount);
        void _voucherId;
        return quote;
      }
      return { subtotalAmount: snapshot.totalAmount, discountAmount: "0", totalAmount: snapshot.totalAmount, voucherCode: null };
    });
  }
  if (action === "cart") {
    const variantId = integer(input.variantId), quantity = integer(input.quantity, 0, 99);
    return transaction(async tx => {
      await lockUser(tx, actor.id);
      const cart = await tx.cart.upsert({ where: { userId: actor.id }, create: { userId: actor.id }, update: {} });
      const previous = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
      const count = input.add === true ? (previous?.quantity ?? 0) + quantity : quantity;
      integer(count, 0, 99);
      if (!count) { await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId } }); return { saved: true }; }
      const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: variantInclude });
      if (!variant?.isActive || !variant.product.isActive || !variant.prices[0]) throw new ShopError("Sản phẩm chưa có giá VND hoặc đã ngừng bán.");
      if (variant.stock < count) throw new ShopError(`Chỉ còn ${variant.stock} sản phẩm.`, 409);
      if (!previous && await tx.cartItem.count({ where: { cartId: cart.id } }) >= 50) throw new ShopError("Giỏ tối đa 50 biến thể.");
      await tx.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, create: { cartId: cart.id, variantId, quantity: count }, update: { quantity: count } });
      return { saved: true };
    });
  }
  if (action === "checkout") {
    if (input.paymentMethod !== undefined && input.paymentMethod !== "COD" && input.paymentMethod !== "PAYOS") throw new ShopError("Phương thức thanh toán không hợp lệ.");
    const online = input.paymentMethod === "PAYOS";
    if (online) await (await import("@/features/payments/service")).requirePayments();
    const paymentsDeployed = await (await import("@/features/payments/service")).paymentsAvailable();
    const buyNowVariantId = checkoutSelection(input);
    const selectedVariantIds = selectedVariants(input);
    const { key, ...shipping } = checkoutInput(input), orderNumber = `DEMO-${actor.id}-${key}`;
    return transaction(async tx => {
      await lockUser(tx, actor.id);
      const prior = await tx.order.findUnique({ where: { orderNumber }, select: { id: true, orderNumber: true } });
      if (prior) {
        const payment = paymentsDeployed ? await tx.onlinePayment.findUnique({ where: { orderId: prior.id } }) : null;
        return { ...prior, paymentMethod: payment ? "PAYOS" : "COD" };
      }
      const { cartId, snapshot, checkedOutVariantIds } = await checkoutSnapshot(tx, actor.id, buyNowVariantId, selectedVariantIds);
      const quote = hasVoucher(input.voucherCode) ? await voucherQuote(tx, actor.id, input.voucherCode, snapshot.totalAmount, true) : null;
      if (input.expectedTotal !== undefined && input.expectedTotal !== (quote?.totalAmount ?? snapshot.totalAmount)) throw new ShopError("Giá hoặc ưu đãi đã thay đổi. Hãy áp dụng lại mã và xác nhận tổng tiền mới.", 409);
      if (online) (await import("@/features/payments/rules")).payableAmount(quote?.totalAmount ?? snapshot.totalAmount, snapshot.currency);
      for (const item of snapshot.items) {
        const updated = await tx.productVariant.updateMany({ where: { id: item.variantId, stock: { gte: item.quantity }, isActive: true }, data: { stock: { decrement: item.quantity } } });
        if (updated.count !== 1) throw new ShopError("Sản phẩm vừa hết hàng. Vui lòng kiểm tra giỏ.", 409);
      }
      const order = await tx.order.create({ data: { userId: actor.id, orderNumber, ...shipping, currency: snapshot.currency, subtotalAmount: snapshot.totalAmount, discountAmount: quote?.discountAmount ?? "0", voucherCode: quote?.voucherCode ?? null, totalAmount: quote?.totalAmount ?? snapshot.totalAmount, items: { create: snapshot.items } }, select: { id: true, orderNumber: true } });
      if (online) await tx.onlinePayment.create({ data: { orderId: order.id } });
      if (quote) await tx.voucherRedemption.create({ data: { voucherId: quote.voucherId, userId: actor.id, orderId: order.id, codeSnapshot: quote.voucherCode, discountAmount: quote.discountAmount } });
      if (cartId !== null) await tx.cartItem.deleteMany({ where: { cartId, variantId: { in: checkedOutVariantIds } } });
      return { ...order, paymentMethod: online ? "PAYOS" : "COD" };
    });
  }
  if (action === "status") {
    const paymentsDeployed = await (await import("@/features/payments/service")).paymentsAvailable();
    const id = integer(input.id), target = textValue(input.status, "Trạng thái", 20), expected = textValue(input.expected, "Trạng thái cũ", 20);
    return transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true } });
      const admin = currentActor?.role === "ADMIN";
      const order = await tx.order.findFirst({ where: { id, ...(admin ? {} : { userId: actor.id }) }, include: { items: true } });
      if (!order) throw new ShopError("Không tìm thấy đơn.", 404);
      const payment = paymentsDeployed ? await tx.onlinePayment.findUnique({ where: { orderId: id }, include: { attempts: { where: { status: { in: ["PENDING", "PROCESSING"] } }, take: 1 } } }) : null;
      if (payment) {
        if (target === "CANCELLED" && (payment.paidAt || payment.reconciliationRequired || payment.attempts.length)) throw new ShopError("Hãy hủy phiên payOS trước. Đơn có khoản tiền nhận cần quản trị đối soát/hoàn tiền.", 409);
        if (target !== "CANCELLED" && (!payment.paidAt || payment.reconciliationRequired)) throw new ShopError("Đơn chưa thanh toán hoặc cần đối soát, chưa thể giao hàng.", 409);
      }
      if (order.status !== expected) throw new ShopError("Trạng thái đã thay đổi, hãy tải lại.", 409);
      if (!canTransition(order.status, target, admin)) throw new ShopError("Không thể chuyển sang trạng thái này.");
      // Legacy orders did not reserve inventory through this workflow.
      if (!payment && !order.orderNumber.startsWith("DEMO-")) throw new ShopError("Đơn lịch sử chưa xác định quy tắc tồn kho.");
      if (target === "CANCELLED") {
        const redemption = await tx.voucherRedemption.findUnique({ where: { orderId: order.id } });
        if (redemption && !redemption.releasedAt) {
          // Match checkout lock order: voucher before stock rows.
          await tx.$queryRaw`SELECT id FROM "Voucher" WHERE id = ${redemption.voucherId} FOR UPDATE`;
          await tx.voucher.update({ where: { id: redemption.voucherId }, data: { version: { increment: 1 } } });
        }
      }
      await tx.order.update({ where: { id }, data: { status: target as OrderStatus } });
      if (target === "CANCELLED") {
        for (const item of [...order.items].sort((a, b) => a.variantId - b.variantId)) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        await tx.voucherRedemption.updateMany({ where: { orderId: order.id, releasedAt: null }, data: { releasedAt: new Date() } });
      }
      return { saved: true };
    });
  }
  if (action === "profile") {
    const fullName = textValue(input.name, "Họ tên", 100, 2), city = textValue(input.city ?? "", "Thành phố", 100, 0);
    const birthYear = input.birthYear === "" || input.birthYear == null ? null : integer(Number(input.birthYear), 1900, new Date().getFullYear());
    const address = input.address ? checkoutInput({ ...input, key: "00000000-0000-4000-8000-000000000000" }) : null;
    return transaction(async tx => {
      await lockUser(tx, actor.id);
      await tx.user.update({ where: { id: actor.id }, data: { fullName, city, birthYear } });
      if (address) {
        const previous = await tx.userAddress.findFirst({ where: { userId: actor.id }, orderBy: { id: "desc" } });
        const data = { recipientName: address.shippingName, phone: address.shippingPhone, line1: address.shippingAddress, city, isDefault: true };
        if (previous) await tx.userAddress.update({ where: { id: previous.id }, data });
        else await tx.userAddress.create({ data: { userId: actor.id, ...data } });
      }
      return { saved: true };
    });
  }
  if (action === "favorite") {
    const slug = textValue(input.slug, "Sản phẩm", 200);
    const product = await prisma.product.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
    if (input.remove === true) await prisma.favorite.deleteMany({ where: { userId: actor.id, productId: product.id } });
    else await prisma.favorite.upsert({ where: { userId_productId: { userId: actor.id, productId: product.id } }, create: { userId: actor.id, productId: product.id }, update: {} });
    return { saved: true };
  }
  throw new ShopError("Thao tác không hợp lệ.");
}
