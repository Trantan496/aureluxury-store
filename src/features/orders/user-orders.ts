import "server-only";
import { prisma } from "@/lib/db/client";
import { publicProductImageUrl } from "@/features/products/images";
import { formatCatalogPrice } from "@/features/wishlist/products";
import {
  type OrderStatusKey,
  formatDisplayOrderNumber,
  formatOrderDate,
  formatStatusSubtext,
} from "./user-orders-formatting";

export {
  type OrderStatusKey,
  formatDisplayOrderNumber,
  formatOrderDate,
  formatStatusSubtext,
};

export type OrderItemSummary = {
  productName: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
  imageUrl: string | null;
  slug?: string;
};

export type UserOrder = {
  id: number;
  orderNumber: string;
  displayNumber: string;
  status: OrderStatusKey;
  totalAmount: string;
  formattedTotal: string;
  subtotalAmount: string | null;
  discountAmount: string;
  currency: string;
  createdAt: string;
  formattedDate: string;
  statusSubtext: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  items: OrderItemSummary[];
};

export async function loadUserOrders(userId: number): Promise<UserOrder[]> {
  const records = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        include: {
          variant: {
            select: {
              product: {
                select: {
                  slug: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { storageKey: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return records.map(order => {
    const curr = order.currency ?? "VND";
    const total = formatCatalogPrice(order.totalAmount.toString(), curr) ?? `${order.totalAmount} ${curr}`;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      displayNumber: formatDisplayOrderNumber(order.orderNumber, order.id),
      status: order.status as OrderStatusKey,
      totalAmount: order.totalAmount.toString(),
      formattedTotal: total,
      subtotalAmount: order.subtotalAmount?.toString() ?? null,
      discountAmount: order.discountAmount.toString(),
      currency: curr,
      createdAt: order.createdAt.toISOString(),
      formattedDate: formatOrderDate(order.createdAt),
      statusSubtext: formatStatusSubtext(order.status as OrderStatusKey, order.createdAt),
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingAddress: order.shippingAddress,
      items: order.items.map(item => {
        const storageKey = item.variant?.product?.images[0]?.storageKey;
        return {
          productName: item.productName,
          sku: item.sku,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          imageUrl: storageKey ? publicProductImageUrl(storageKey) : null,
          slug: item.variant?.product?.slug,
        };
      }),
    };
  });
}
