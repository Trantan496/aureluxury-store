import { InputError, object } from "./validation.ts";

export const taxonomyVersion = "aurel-fashion-v1";
export const taxonomy = {
  collar: ["round-neck", "v-neck", "polo", "high-neck", "shirt-collar"],
  fabric: ["cotton", "linen", "denim", "polyester", "wool", "silk", "viscose", "nylon", "leather"],
  gender: ["men", "women", "unisex"],
  fit: ["slim-fit", "regular-fit", "relaxed-fit", "oversized"],
  color: ["black", "white", "beige", "brown", "navy", "blue", "red", "green", "grey", "pink", "yellow", "purple", "orange"],
  size: ["XS", "S", "M", "L", "XL", "XXL"],
  garmentType: ["t-shirt", "shirt", "polo", "trousers", "jeans", "shorts", "skirt", "dress", "jacket", "coat", "knitwear"],
  styleTags: ["minimal", "classic", "casual", "formal", "streetwear", "sporty"],
  seasonTags: ["spring", "summer", "autumn", "winter", "all-season"],
  occasionTags: ["everyday", "work", "evening", "travel", "sport", "ceremony"],
  layerRole: ["base", "mid", "outer", "standalone"],
  pattern: ["solid", "striped", "checked", "floral", "graphic", "textured"],
  silhouette: ["straight", "a-line", "tapered", "wide", "fitted", "boxy"],
} as const;
export type OptionKey = keyof typeof taxonomy;
export type TaxonomyRegistry = Partial<Record<OptionKey, readonly string[]>>;
export function taxonomyVersionFor(registry: TaxonomyRegistry) {
  return Object.entries(registry).some(([key, values]) => values.some(v => !(taxonomy[key as OptionKey] as readonly string[]).includes(v))) ? "aurel-fashion-v2" : taxonomyVersion;
}
export function registrySnapshot(input: unknown): TaxonomyRegistry {
  const value = object(input, Object.keys(taxonomy)); let total = 0;
  for (const [key, tokens] of Object.entries(value)) {
    if (!Array.isArray(tokens) || new Set(tokens).size !== tokens.length || tokens.some(t => typeof t !== "string" || t.length > 60 || !(key === "size" ? /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/ : /^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(t) || (t === "not-applicable" && ["color", "size"].includes(key)))) throw new InputError("registry");
    total += tokens.length;
  }
  if (total > 2300) throw new InputError("registry");
  return value as TaxonomyRegistry;
}
export function option(key: OptionKey, input: unknown, registry: TaxonomyRegistry = {}): string {
  if (typeof input !== "string") throw new InputError(key);
  const token = key === "size" ? input.trim().toUpperCase() : input.trim().toLowerCase().replace(/\s+/g, "-");
  if (!(taxonomy[key] as readonly string[]).includes(token) && !registry[key]?.includes(token)) throw new InputError(key);
  return token;
}
export function productCode(input: unknown): string {
  if (typeof input !== "string" || input.length > 60 || !/^AUR-(?:[0-9]{4,12}|[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]{3,6})$/.test(input.trim())) throw new InputError("productCode");
  return input.trim();
}
export function collectionCode(input: unknown): string | null {
  if (input === null) return null;
  if (typeof input !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input) || input.length > 100) throw new InputError("collection");
  return input;
}
export const profileFields = ["collar", "fabric", "gender", "fit", "garmentType", "styleTags", "seasonTags", "occasionTags", "layerRole", "pattern", "silhouette"] as const;
export type Profile = { [K in typeof profileFields[number]]: K extends `${string}Tags` ? string[] : string | null };
// Replacement semantics: NULL/[] is unknown; registry token not-applicable is explicit.
export function profile(input: unknown, registry: TaxonomyRegistry = {}): Profile {
  const data = object(input, profileFields);
  return Object.fromEntries(profileFields.map(key => {
    const raw = data[key];
    if (key.endsWith("Tags")) {
      if (raw === undefined) return [key, []];
      if (!Array.isArray(raw) || raw.length > 20) throw new InputError(key);
      const values = raw.map(value => option(key, value, registry));
      if (new Set(values).size !== values.length) throw new InputError(key);
      if (values.includes("not-applicable") && values.length !== 1) throw new InputError(key);
      return [key, values.sort()];
    }
    return [key, raw === undefined || raw === null ? null : option(key, raw, registry)];
  })) as Profile;
}
export const permissions = ["unknown", "granted", "denied"] as const;
export function imageMetadata(input: unknown) {
  const fields = ["imageType", "isPrimary", "sourceReference", "rightsReference", "websitePermission", "embeddingPermission", "trainingPermission"];
  const data = object(input, fields);
  const output: Record<string, string | boolean | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith("Permission")) {
      if (!permissions.includes(value as typeof permissions[number])) throw new InputError(key);
      output[key] = value as string;
    } else if (key === "isPrimary") {
      if (typeof value !== "boolean") throw new InputError(key);
      output[key] = value;
    } else if (key === "imageType") {
      if (value !== null && !["front", "back", "detail", "lifestyle", "other"].includes(value as string)) throw new InputError(key);
      output[key] = value as string | null;
    } else {
      if (value !== null && (typeof value !== "string" || !value.trim() || value.length > 1000 || /[\u0000-\u001f\u007f]/.test(value))) throw new InputError(key);
      output[key] = value === null ? null : (value as string).trim();
    }
  }
  return output;
}
