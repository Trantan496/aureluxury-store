export type Entity = "product" | "category" | "variant" | "image";
export type ProductInput = { name: string; slug: string; categoryId: number; description?: string | null; brand?: string | null; isActive?: boolean };
export type CategoryInput = { name: string; slug: string };
export type VariantInput = { productId: number; sku: string; color: string; size: string; price?: string; stock: number; isActive?: boolean };
export type ImageInput = { productId: number; storageKey: string; altText?: string | null; sortOrder?: number };
import { validProductImageKey } from "./images.ts";

export class InputError extends Error {
  field: string;
  constructor(field: string) { super("Invalid input"); this.field = field; }
}

export function object(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new InputError("input");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !fields.includes(key) || value[key] === undefined)) throw new InputError("input");
  return value;
}

export function integer(value: unknown, field: string, min = 1, max = 2147483647): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new InputError(field);
  return value;
}

function text(value: unknown, field: string, max: number, multiline = false): string {
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || controls.test(value)) throw new InputError(field);
  return value.trim();
}

export function price(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) throw new InputError("price");
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function entity(value: unknown): Entity {
  if (!["product", "category", "variant", "image"].includes(value as string)) throw new InputError("entity");
  return value as Entity;
}

// Explicit field allowlists also reject role, id, nested writes and currency that cannot be persisted.
export function validateData(kind: Entity, input: unknown, patch = false) {
  const allowed = {
    product: ["name", "slug", "categoryId", "description", "brand", "isActive"],
    category: ["name", "slug"],
    variant: ["productId", "sku", "color", "size", "price", "stock", "isActive"],
    image: ["productId", "storageKey", "altText", "sortOrder"],
  }[kind];
  const value = object(input, patch ? allowed.filter(key => key !== "productId") : allowed);
  const required = { product: ["name", "slug", "categoryId"], category: ["name", "slug"], variant: ["productId", "sku", "color", "size", "stock"], image: ["productId", "storageKey"] }[kind];
  if (!Object.keys(value).length) throw new InputError("input");
  if (!patch) for (const key of required) if (!(key in value)) throw new InputError(key);
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (["categoryId", "productId", "stock", "sortOrder"].includes(key)) result[key] = integer(raw, key, ["stock", "sortOrder"].includes(key) ? 0 : 1);
    else if (key === "price") result[key] = price(raw);
    else if (key === "isActive") {
      if (typeof raw !== "boolean") throw new InputError(key);
      result[key] = raw;
    } else if (["description", "brand", "altText"].includes(key) && raw === null) result[key] = null;
    else {
      const parsed = text(raw, key, key === "description" ? 10000 : key === "storageKey" ? 512 : key === "altText" ? 500 : 200, key === "description");
      if (key === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed)) throw new InputError(key);
      if (key === "storageKey" && !validProductImageKey(parsed)) throw new InputError(key);
      result[key] = parsed;
    }
  }
  return result;
}
