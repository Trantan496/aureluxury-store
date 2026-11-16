export const currencies = ["VND", "USD", "EUR"] as const;
export type Currency = typeof currencies[number];
export const minorDigits: Record<Currency, number> = { VND: 0, USD: 2, EUR: 2 };
export class MoneyError extends Error {
  field: string;
  constructor(field: string) { super("Invalid monetary input"); this.field = field; }
}
export function currency(value: unknown): Currency {
  if (!currencies.includes(value as Currency)) throw new MoneyError("currency");
  return value as Currency;
}
export function money(value: unknown, unit: Currency, integerDigits = 18): string {
  const scale = minorDigits[currency(unit)];
  if (typeof value !== "string") throw new MoneyError("amount");
  const pattern = new RegExp(`^(?:0|[1-9]\\d{0,${integerDigits - 1}})${scale ? `(?:\\.\\d{1,${scale}})?` : ""}$`);
  if (!pattern.test(value)) throw new MoneyError("amount");
  const [whole, fraction = ""] = value.split(".");
  return scale ? `${whole}.${fraction.padEnd(scale, "0")}` : whole;
}
export function minorUnits(amount: string, unit: Currency): bigint {
  return BigInt(money(amount, unit, 22).replace(".", ""));
}
export function fromMinorUnits(value: bigint, unit: Currency): string {
  const scale = minorDigits[currency(unit)];
  const digits = value.toString().padStart(scale + 1, "0");
  return money(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits, unit, 22);
}
export function currencyEnabled() { return process.env.MULTI_CURRENCY_ENABLED === "true"; }
// VND is the storefront base currency. Only explicit ProductPrice rows qualify;
// the multi-currency flag controls optional currency selection, not base pricing.
export function storefrontCurrency(selected?: Currency, enabled = currencyEnabled()): Currency {
  return enabled && selected ? currency(selected) : "VND";
}
