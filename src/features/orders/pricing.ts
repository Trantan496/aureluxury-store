import { currency, money, minorUnits, fromMinorUnits, MoneyError, type Currency } from "../money/money.ts";

export type PricedOrderLine = { variantId: number; quantity: number; currency: Currency; unitPrice: string; productName: string; sku: string; color: string; size: string };
// Caller must load these prices from PostgreSQL; never accept client prices/totals for persistence.
export function orderSnapshot(unit: unknown, lines: readonly PricedOrderLine[]) {
  const selected = currency(unit);
  if (!lines.length || lines.length > 100 || new Set(lines.map(line => line.variantId)).size !== lines.length) throw new MoneyError("items");
  let total = BigInt(0);
  const items = lines.map(line => {
    if (line.currency !== selected || !Number.isInteger(line.variantId) || line.variantId < 1 ||
        !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 2147483647) throw new MoneyError("items");
    const unitPrice = money(line.unitPrice, selected);
    const subtotal = minorUnits(unitPrice, selected) * BigInt(line.quantity);
    total += subtotal;
    return { ...line, currency: selected, unitPrice, lineTotal: fromMinorUnits(subtotal, selected) };
  });
  return { currency: selected, totalAmount: fromMinorUnits(total, selected), items };
}
