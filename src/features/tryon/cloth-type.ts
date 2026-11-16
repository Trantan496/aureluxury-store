export type TryOnClothType = "upper" | "lower" | "overall" | "bag";

const VALID_CLOTH_TYPES = new Set<TryOnClothType>(["upper", "lower", "overall", "bag"]);

const LOWER_TOKENS = new Set([
  "bottom",
  "bottoms",
  "lower",
  "quan",
  "pant",
  "pants",
  "trouser",
  "trousers",
  "jean",
  "jeans",
  "denim",
  "short",
  "shorts",
  "skirt",
  "skirts",
  "legging",
  "leggings",
  "jogger",
  "joggers",
  "chino",
  "chinos",
  "culotte",
  "culottes",
  "slacks",
  "cargo",
]);

const OVERALL_TOKENS = new Set([
  "overall",
  "overalls",
  "dress",
  "dresses",
  "gown",
  "jumpsuit",
  "jumpsuits",
  "romper",
  "playsuit",
  "ao-dai",
  "aodai",
]);

const BAG_TOKENS = new Set([
  "accessory",
  "accessories",
  "bag",
  "bags",
  "tui",
  "clutch",
  "tote",
  "hobo",
  "bumbag",
  "holdall",
  "sling",
  "handbag",
  "crossbody",
  "backpack",
  "balo",
  "satchel",
  "pouch",
  "wallet",
  "duffel",
  "luggage",
]);

const BAG_PHRASES = [
  "phu kien",
  "active gear",
  "urban utility",
  "classic grace",
  "campus bloom",
];

function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

export function normalizeTryOnClothType(value: unknown): TryOnClothType {
  if (typeof value === "string") {
    const cleaned = value.trim().toLowerCase() as TryOnClothType;
    if (VALID_CLOTH_TYPES.has(cleaned)) {
      return cleaned;
    }
  }
  return "upper";
}

function inferFromText(raw: string | null | undefined): TryOnClothType | null {
  if (!raw) return null;
  const normalized = stripDiacritics(raw);
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => LOWER_TOKENS.has(token))) {
    return "lower";
  }
  if (
    tokens.some((token) => OVERALL_TOKENS.has(token)) ||
    normalized.includes("chan vay")
  ) {
    return normalized.includes("chan vay") ? "lower" : "overall";
  }
  if (normalized.includes("vay") || normalized.includes("dam")) {
    return "overall";
  }
  if (
    tokens.some((token) => BAG_TOKENS.has(token)) ||
    BAG_PHRASES.some((phrase) => normalized.includes(phrase))
  ) {
    return "bag";
  }
  return null;
}

export function inferTryOnClothType(input: {
  explicitClothType?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  productSlug?: string | null;
  productName?: string | null;
}): TryOnClothType {
  if (
    input.explicitClothType &&
    VALID_CLOTH_TYPES.has(input.explicitClothType.trim().toLowerCase() as TryOnClothType)
  ) {
    return input.explicitClothType.trim().toLowerCase() as TryOnClothType;
  }

  return (
    inferFromText(input.categorySlug) ??
    inferFromText(input.categoryName) ??
    inferFromText(input.productSlug) ??
    inferFromText(input.productName) ??
    "upper"
  );
}
