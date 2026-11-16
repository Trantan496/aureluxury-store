import "server-only";
import type { ProductDataTransaction } from "./product-service.ts";
import { taxonomy, profileFields, type OptionKey, type TaxonomyRegistry } from "./foundation.ts";
import { normalizedWords } from "./product-code.ts";
import { InputError } from "./validation.ts";

export function customOption(key: unknown, label: unknown) {
  if (typeof key !== "string" || !Object.hasOwn(taxonomy, key)) throw new InputError("taxonomyKey");
  if (typeof label !== "string" || label.trim().length < 2 || label.trim().length > 80 || /[\u0000-\u001f\u007f<>]/.test(label) || ((label.match(/\p{L}/gu)?.length ?? 0) < 2 && !(key === "size" && /^\d{2,3}(?:[ /-]\d{1,3})?$/.test(label.trim()))) || /^(.)\1{2,}$/u.test(label.trim())) throw new InputError("label");
  const slug = normalizedWords(label).replace(/ +/g, "-");
  if (!slug || slug.length > 60 || slug === "not-applicable") throw new InputError("label");
  return { key: key as OptionKey, label: label.trim().replace(/\s+/g, " "), token: key === "size" ? slug.toUpperCase() : slug };
}
export async function readTaxonomy(tx: ProductDataTransaction) {
  // Require both staged migrations; a partial deployment must remain compatibility-only.
  const ready = await tx.$queryRaw<{ ready: boolean }[]>`SELECT to_regclass('public."TaxonomyOption"') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."ProductProfile"') AND conname='ProductProfile_taxonomy_version' AND pg_get_constraintdef(oid) LIKE '%aurel-fashion-v2%') AS ready`;
  const extended = ready[0].ready;
  const custom = extended ? await tx.taxonomyOption.findMany({ orderBy: [{ key: "asc" }, { token: "asc" }], take: 2001, select: { key: true, token: true, label: true } }) : [];
  if (custom.length > 2000) throw new InputError("taxonomyLimit");
  const values = Object.fromEntries(Object.entries(taxonomy).map(([key, tokens]) => [key, [...new Map([
    ...tokens.map(token => ({ token, label: token })),
    ...(extended && (profileFields as readonly string[]).includes(key) ? [{ token: "not-applicable", label: "Không áp dụng" }] : []),
    ...custom.filter(row => row.key === key).map(row => ({ token: row.token, label: row.label })),
  ].map(row=>[row.token,row])).values()]])) as Record<OptionKey, { token: string; label: string }[]>;
  const registry = Object.fromEntries(Object.entries(values).map(([key, rows]) => [key, rows.map(r => r.token)])) as TaxonomyRegistry;
  return { extended, values, registry };
}
