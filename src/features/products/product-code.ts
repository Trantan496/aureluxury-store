import { InputError } from "./validation.ts";

export function normalizedWords(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function productSlug(name: string) { return normalizedWords(name).replace(/ +/g, "-").slice(0, 190).replace(/-$/, "") || "san-pham"; }
export function codeStem(name: string, extended = true) {
  const normalized = normalizedWords(name);
  if (!extended) {
    // Compatibility with the existing main numeric CHECK until the staged SQL is approved.
    let hash = 2166136261;
    for (const c of normalized) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    return "AUR-" + String(hash).padStart(10, "0").slice(0, 8);
  }
  const dictionary: Record<string, string> = { "somi": "SM", linen: "L", cotton: "CT", oversized: "OVS", regular: "REG", slim: "SLM", thun: "TH", quan: "Q", vay: "V", dam: "D", jacket: "JKT", dress: "DRS" };
  const words = normalized.replace(/\bso mi\b/g, "somi").split(" ").filter(w => w && !["ao", "the", "va", "cho", "cua"].includes(w));
  const parts = words.slice(0, 4).map(w => dictionary[w] ?? w.slice(0, 3).toUpperCase());
  if (parts[0] === "SM" && ["L", "CT"].includes(parts[1])) parts.splice(0, 2, parts[0] + parts[1]);
  const stem = parts.join("-").replace(/^[^A-Z]+/, "").slice(0, 32).replace(/-$/, "") || "SP";
  return "AUR-" + stem;
}
export function codeCandidate(stem: string, sequence = 1, extended = true) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > (extended ? 999999 : 9999)) throw new InputError("productCode");
  return stem + (extended ? "-" : "") + String(sequence).padStart(extended ? 3 : 4, "0");
}
export function variantSku(code: string, color: string, size: string) {
  return `${code}-${productSlug(color).toUpperCase()}-${productSlug(size).toUpperCase()}`.slice(0, 190);
}
