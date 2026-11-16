import { extractSearchIntent, normalizeSearchText } from "./search-ranking.ts";

export type OutfitSlot =
  | "TOP"
  | "OUTERWEAR"
  | "BOTTOM"
  | "SKIRT"
  | "DRESS"
  | "ACCESSORY"
  | "OTHER";

export type MappableProduct = {
  id: string;
  name: string;
  slug?: string;
  category?: { slug?: string; name?: string } | null;
  profile?: { gender?: string | null; garmentType?: string | null } | null;
  tags?: readonly string[] | null;
};

export const COMPLEMENTARY_PRIORITY: Record<OutfitSlot, readonly OutfitSlot[]> = {
  TOP: ["BOTTOM", "SKIRT", "OUTERWEAR", "ACCESSORY"],
  OUTERWEAR: ["TOP", "BOTTOM", "DRESS", "ACCESSORY"],
  BOTTOM: ["TOP", "OUTERWEAR", "ACCESSORY"],
  SKIRT: ["TOP", "OUTERWEAR", "ACCESSORY"],
  DRESS: ["OUTERWEAR", "ACCESSORY"],
  ACCESSORY: ["TOP", "OUTERWEAR", "BOTTOM", "DRESS"],
  OTHER: ["TOP", "BOTTOM", "OUTERWEAR", "ACCESSORY"],
};

export function detectOutfitSlotFromText(text: string): OutfitSlot {
  const norm = normalizeSearchText(text);
  if (!norm) return "OTHER";

  // Check OUTERWEAR before generic TOP ("ao khoac" contains "ao")
  if (
    /\b(outerwear|ao khoac|trench|coat|jacket|bomber|fleece|blazer|parka|mang to)\b/.test(norm)
  ) {
    return "OUTERWEAR";
  }
  if (/\b(bottoms|quan|trouser|trousers|pants|jeans|kaki|chino|shorts|jogger|slacks)\b/.test(norm)) {
    return "BOTTOM";
  }
  if (/\b(chan vay|skirt)\b/.test(norm)) {
    return "SKIRT";
  }
  if (/\b(dam|dress)\b/.test(norm)) {
    return "DRESS";
  }
  if (/\b(accessories|phu kien|tui|tote|bag|scarf|khan|belt|that lung|tat|vo|socks)\b/.test(norm)) {
    return "ACCESSORY";
  }
  if (
    /\b(tops|ao|t shirt|tshirt|tee|shirt|polo|so mi|cardigan|knit|knitwear|sweater|hoodie|ao ni|vest|tank)\b/.test(
      norm,
    )
  ) {
    return "TOP";
  }

  return "OTHER";
}

export function detectOutfitSlot(product: MappableProduct): OutfitSlot {
  const catSlug = normalizeSearchText(product.category?.slug);
  const catName = normalizeSearchText(product.category?.name);
  const garmentType = normalizeSearchText(product.profile?.garmentType);

  if (catSlug === "outerwear" || catName === "ao khoac" || ["coat", "jacket"].includes(garmentType)) {
    return "OUTERWEAR";
  }
  if (catSlug === "bottoms" || catName === "quan" || ["trousers", "jeans", "shorts"].includes(garmentType)) {
    return "BOTTOM";
  }
  if (catSlug === "chan-vay" || catName === "chan vay" || garmentType === "skirt") {
    return "SKIRT";
  }
  if (catSlug === "dam" || catName === "dam" || garmentType === "dress") {
    return "DRESS";
  }
  if (catSlug === "accessories" || catName === "phu kien") {
    return "ACCESSORY";
  }
  if (
    catSlug === "tops" ||
    catName === "ao" ||
    ["t-shirt", "shirt", "polo", "knitwear"].includes(garmentType)
  ) {
    return "TOP";
  }

  // Fallback to tags then product name
  const tagsSlot = detectOutfitSlotFromText((product.tags ?? []).join(" "));
  if (tagsSlot !== "OTHER") return tagsSlot;

  return detectOutfitSlotFromText(product.name);
}

export function inferOutfitSlotFromQuery(rawQuery: string): OutfitSlot {
  const { intentPhrase } = extractSearchIntent(rawQuery);
  return detectOutfitSlotFromText(intentPhrase || rawQuery);
}

function detectAudienceGender(product: MappableProduct): "men" | "women" | "unisex" {
  const g = product.profile?.gender?.toLowerCase();
  if (g === "men" || g === "women" || g === "unisex") return g;
  const nameNorm = normalizeSearchText(product.name);
  if (/\b(nam|men|male)\b/.test(nameNorm)) return "men";
  if (/\b(nu|women|female)\b/.test(nameNorm)) return "women";
  return "unisex";
}

/**
 * Ranks candidate products by complementary outfit pairing rules:
 * - Shirt / Top -> suggests Bottoms (trousers/skirts) first, then Outerwear/Accessories
 * - Outerwear / Coat -> suggests Tops (shirts/knitwear/polo) first, then Bottoms/Accessories
 * - Bottom -> suggests Tops first, then Outerwear/Accessories
 */
export function rankComplementaryProducts<T extends MappableProduct>(
  sources: readonly MappableProduct[],
  candidates: readonly T[],
  options: {
    limit?: number;
    excludeIds?: readonly string[];
    fallbackQuery?: string;
  } = {},
): T[] {
  const limit = options.limit ?? 8;
  const exclude = new Set([
    ...(options.excludeIds ?? []),
    ...sources.map(s => s.id),
  ]);

  const activeSlots = sources.length
    ? sources.map(detectOutfitSlot)
    : options.fallbackQuery
      ? [inferOutfitSlotFromQuery(options.fallbackQuery)]
      : ["OTHER" as OutfitSlot];

  const targetGenders = sources.map(detectAudienceGender);
  const sourceTags = new Set(
    sources.flatMap(s => (s.tags ?? []).map(t => normalizeSearchText(t))).filter(Boolean),
  );

  const scored = candidates
    .filter(c => !exclude.has(c.id))
    .map((candidate, index) => {
      const candidateSlot = detectOutfitSlot(candidate);
      const candidateGender = detectAudienceGender(candidate);

      let slotScore = 0;
      for (const sourceSlot of activeSlots) {
        const priorities = COMPLEMENTARY_PRIORITY[sourceSlot];
        const rankIdx = priorities.indexOf(candidateSlot);
        if (rankIdx === 0) slotScore = Math.max(slotScore, 120);
        else if (rankIdx === 1) slotScore = Math.max(slotScore, 85);
        else if (rankIdx === 2) slotScore = Math.max(slotScore, 50);
        else if (rankIdx === 3) slotScore = Math.max(slotScore, 25);
        else if (candidateSlot === sourceSlot) slotScore = Math.max(slotScore, 5);
      }

      let genderScore = 0;
      if (targetGenders.length > 0) {
        if (
          candidateGender === "unisex" ||
          targetGenders.includes("unisex") ||
          targetGenders.includes(candidateGender)
        ) {
          genderScore = 30;
        } else {
          genderScore = -20;
        }
      }

      let tagOverlap = 0;
      for (const tag of candidate.tags ?? []) {
        if (sourceTags.has(normalizeSearchText(tag))) tagOverlap += 10;
      }

      return {
        candidate,
        index,
        score: slotScore + genderScore + tagOverlap,
      };
    });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.slice(0, limit).map(item => item.candidate);
}
