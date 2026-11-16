import "server-only";
import { prisma } from "../client";
import { currency, currencyEnabled, minorDigits, money, MoneyError } from "../../../features/money/money";
import { orderSnapshot } from "../../../features/orders/pricing";

// Read-only order pricing preparation, not checkout, inventory reservation or an order-write endpoint.
export async function getOrderPricingSnapshot(unit: unknown, requested: readonly { variantId: number; quantity: number }[]) {
  if (!currencyEnabled()) throw new Error("Multi-currency migration is not enabled");
  const selected = currency(unit);
  if (!Array.isArray(requested) || !requested.length || requested.length > 100 || new Set(requested.map(item => item.variantId)).size !== requested.length ||
      requested.some(item => !Number.isInteger(item.variantId) || item.variantId < 1 || item.variantId > 2147483647 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647)) throw new MoneyError("items");
  return prisma.$transaction(async tx => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: requested.map(item => item.variantId) }, isActive: true, product: { isActive: true } },
      select: { id: true, sku: true, color: true, size: true, stock: true, product: { select: { name: true } }, prices: { where: { currency: selected }, select: { amount: true } } },
    });
    const lines = requested.map(item => {
      const variant = variants.find(value => value.id === item.variantId);
      if (!variant || !variant.prices[0]) throw new MoneyError("missingPrice");
      if (variant.stock < item.quantity) throw new MoneyError("stock");
      return { variantId: item.variantId, quantity: item.quantity, currency: selected,
        unitPrice: money(variant.prices[0].amount.toFixed(minorDigits[selected]), selected),
        productName: variant.product.name, sku: variant.sku, color: variant.color, size: variant.size };
    });
    return orderSnapshot(selected, lines);
  }, { isolationLevel: "RepeatableRead" });
}
