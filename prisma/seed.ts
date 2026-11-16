import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // ALL DATA BELOW IS FICTIONAL AND FOR LOCAL DEVELOPMENT ONLY.
  const user = await prisma.user.upsert({
    where: { email: "demo-a@aurel.example" },
    update: {},
    create: { email: "demo-a@aurel.example", fullName: "Nguyễn Văn A", city: "TP.HCM" },
  });

  const category = await prisma.category.upsert({
    where: { slug: "ao-thun" },
    update: {},
    create: { slug: "ao-thun", name: "Áo thun" },
  });

  const product = await prisma.product.upsert({
    where: { slug: "ao-oversized-basic" },
    update: {},
    create: {
      slug: "ao-oversized-basic",
      name: "Áo thun Oversized Basic",
      brand: "AUREL",
      categoryId: category.id,
    },
  });

  const white = await prisma.productVariant.upsert({
    where: { sku: "AUREL-TS-WHITE-M" },
    update: {},
    create: {
      productId: product.id, sku: "AUREL-TS-WHITE-M", color: "Trắng", size: "M",
      price: "299000", stock: 12,
    },
  });

  const black = await prisma.productVariant.upsert({
    where: { sku: "AUREL-TS-BLACK-L" },
    update: {},
    create: {
      productId: product.id, sku: "AUREL-TS-BLACK-L", color: "Đen", size: "L",
      price: "299000", stock: 9,
    },
  });

  if (white.price === null || black.price === null) throw new Error("Legacy seed requires explicit legacy prices; no currency is inferred.");

  const order = await prisma.order.upsert({
    where: { orderNumber: "AUREL-DEMO-0001" },
    update: {},
    create: {
      orderNumber: "AUREL-DEMO-0001", userId: user.id,
      shippingName: "Nguyễn Văn A", shippingPhone: "0000000000",
      shippingAddress: "Địa chỉ giả lập, TP.HCM",
      totalAmount: "1495000", // (3 + 2) * 299000
      items: {
        create: [
          { variantId: white.id, productName: product.name, sku: white.sku,
            color: white.color, size: white.size, quantity: 3, unitPrice: white.price },
          { variantId: black.id, productName: product.name, sku: black.sku,
            color: black.color, size: black.size, quantity: 2, unitPrice: black.price },
        ],
      },
    },
  });
  console.log(`Seeded demo user ${user.id}; order ${order.orderNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
