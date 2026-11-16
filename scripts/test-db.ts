import "dotenv/config";
import { prisma } from "../src/lib/db/client";
import { getOrderForUser } from "../src/lib/db/queries/orders.ts";

async function main() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "demo-a@aurel.example" },
    select: { id: true, fullName: true },
  });
  const order = await getOrderForUser(user.id, "AUREL-DEMO-0001");
  if (!order) throw new Error("Demo order not found");
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  console.log(JSON.stringify({
    customer: user.fullName,
    order: order.orderNumber,
    shirts: order.items.map((item) => ({
      name: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
    })),
    totalQuantity: quantity,
    totalAmountVND: order.totalAmount.toString(),
  }, null, 2));
  if (quantity !== 5) throw new Error("Expected exactly five shirts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
