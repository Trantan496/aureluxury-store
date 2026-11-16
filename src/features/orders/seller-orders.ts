import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { publicProductImageUrl } from "@/features/products/images";
import { prisma } from "@/lib/db/client";
import { shopActor, shopWrite } from "@/features/shop/service";
import { ShopError } from "@/features/shop/rules";
import { paymentsAvailable } from "@/features/payments/service";
import { sellerQuery, type SellerFilter, type SellerOrdersPage } from "./seller-order-rules";

export async function sellerActor() {
  const actor = await shopActor();
  if (actor.role !== "ADMIN") throw new ShopError("Chỉ người bán có quyền quản trị được quản lý đơn hàng.", 403);
  return actor;
}
export function sellerWhere(filter: SellerFilter, deployed: boolean): Prisma.OrderWhereInput {
  if (filter === "ALL") return {};
  if (!deployed) return filter === "READY" ? { status: { in: ["PENDING", "CONFIRMED", "SHIPPED"] }, orderNumber: { startsWith: "DEMO-" } } : { id: -1 };
  if (filter === "REVIEW") return { onlinePayment: { is: { reconciliationRequired: true } } };
  if (filter === "WAITING") return { status: "PENDING", onlinePayment: { is: { paidAt: null, reconciliationRequired: false } } };
  return { status: { in: ["PENDING", "CONFIRMED", "SHIPPED"] }, OR: [
    { orderNumber: { startsWith: "DEMO-" }, onlinePayment: { is: null } },
    { onlinePayment: { is: { paidAt: { not: null }, reconciliationRequired: false } } },
  ] };
}
export async function sellerOrders(params: URLSearchParams): Promise<SellerOrdersPage> {
  await sellerActor();
  const { filter, page: requestedPage } = sellerQuery(params);
  const deployed = await paymentsAvailable();
  return prisma.$transaction(async tx => {
    // An interactive transaction owns one PostgreSQL client. Keep its statements
    // ordered; only independent calls outside a transaction should fan out over the pool.
    const counts = { READY: 0, WAITING: 0, REVIEW: 0, ALL: 0 };
    for (const key of ["READY", "WAITING", "REVIEW", "ALL"] as const) {
      counts[key] = await tx.order.count({ where: sellerWhere(key, deployed) });
    }
    const total = counts[filter], pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(requestedPage, pages);
    const orders = await tx.order.findMany({
      where: sellerWhere(filter, deployed), orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
      select: { id: true, orderNumber: true, status: true, createdAt: true, totalAmount: true, currency: true, subtotalAmount: true, discountAmount: true, voucherCode: true, shippingName: true, shippingPhone: true, shippingAddress: true,
        items: { select: { productName: true, sku: true, color: true, size: true, quantity: true, unitPrice: true, variant: { select: { product: { select: { images: { where: { isPrimary: true }, take: 1, select: { storageKey: true } } } } } } } } },
    });
    const payments = deployed && orders.length ? await tx.onlinePayment.findMany({ where: { orderId: { in: orders.map(order => order.id) } }, select: { orderId: true, paidAt: true, reconciliationRequired: true,
      attempts: { orderBy: { orderCode: "desc" }, take: 20, select: { status: true, reference: true, paymentLinkId: true, paidAmount: true } } } }) : [];
    return {
      filter, page, pages, total, counts, paymentsAvailable: deployed,
      orders: orders.map(order => {
        const payment = payments.find(row => row.orderId === order.id), attempt = payment?.attempts.find(row => row.status === "PAID") ?? payment?.attempts[0];
        return { ...order, createdAt: order.createdAt.toISOString(), totalAmount: order.totalAmount.toString(), subtotalAmount: order.subtotalAmount?.toString() ?? null, discountAmount: order.discountAmount.toString(),
          items: order.items.map(({ variant, ...item }) => ({ ...item, unitPrice: item.unitPrice.toString(), imageUrl: variant.product.images[0] ? publicProductImageUrl(variant.product.images[0].storageKey) : null })),
          payment: payment ? { paidAt: payment.paidAt?.toISOString() ?? null, reconciliationRequired: payment.reconciliationRequired, status: payment.paidAt ? "PAID" : attempt?.status ?? "PROCESSING", reference: attempt?.reference ?? null, paymentLinkId: attempt?.paymentLinkId ?? null, paidAmount: attempt?.paidAmount?.toString() ?? null } : null,
        };
      }),
    };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
export async function sellerUpdateStatus(input: Record<string, unknown>) {
  await sellerActor();
  // Reuse the existing transaction, fresh DB role, payment and inventory guards.
  return shopWrite({ action: "status", id: input.id, expected: input.expected, status: input.status });
}
