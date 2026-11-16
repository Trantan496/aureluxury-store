import { prisma } from "../client";

// userId MUST come from a verified server-side session, never from client input.
export async function getOrderForUser(userId: number, orderNumber: string) {
  return prisma.order.findFirst({
    where: { userId, orderNumber },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          sku: true,
          color: true,
          size: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });
}
