/**
 * Smart E-Commerce Fashion Search & Relevance Ranking Engine
 *
 * Implements a multi-stage intelligent search algorithm:
 * 1. Conversational Intent Extraction & Normalization (Vietnamese NFD + conversational stop words)
 * 2. Fashion Domain Synonym & Cross-Language Expansion (EN <-> VI fashion terms, colors, silhouettes)
 * 3. Semicolon Product Tag Matching (custom admin tags e.g. "áo polo; polo; áo thun có cổ")
 * 4. Multi-field Weighted Relevance Scoring (Title, SKU, Tags, Category, Variant Attributes, Description)
 * 5. Deterministic Ranking & Exact Top-1 Positioning
 */

export type ScorableProduct = {
  name: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  category?: { name: string; slug?: string } | null;
  tags?: readonly string[] | null;
  variants?: readonly {
    sku?: string;
    color?: string;
    size?: string;
  }[] | null;
};

const VIETNAMESE_ACCENT_REGEX = /[\u0300-\u036f]/g;

// Includes conversational Vietnamese & English fillers so sentences like
// "Hôm nay tôi muốn mua áo polo" cleanly distill to ["ao", "polo"].
const STOP_WORDS = new Set([
  "hom", "nay", "ngay", "bay", "gio",
  "toi", "minh", "em", "anh", "chi", "ban", "shop", "ad", "nguoi", "ta",
  "muon", "can", "dang", "tim", "kiem", "mua", "ban", "xem", "hoi", "chon", "dat",
  "tu", "van", "giup", "cho", "voi", "cua", "cac", "nhung", "va", "la", "thi",
  "nha", "nhe", "oi", "a", "nhi", "duoc", "khong", "ko", "the", "nao", "gi", "dau",
  "loai", "mau", "chiec", "cai", "bo", "mot", "vai", "hai", "de", "mac", "thu",
  "san", "pham", "danh", "sach", "trong", "hay", "hoac", "rat", "dep", "nhat",
  "a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "i", "want", "to", "buy", "looking",
]);

/**
 * Normalizes text for search indexing and matching:
 * - Strips Vietnamese accents (Á -> A, đ -> d, etc.)
 * - Converts to lower case
 * - Replaces non-alphanumeric punctuation with spaces
 * - Trims and condenses whitespace
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(VIETNAMESE_ACCENT_REGEX, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Tokenizes search query into meaningful fashion keywords, stripping conversational filler words.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const rawTokens = normalized.split(" ");
  const tokens: string[] = [];

  for (const token of rawTokens) {
    if (!token) continue;
    // Allow single letter only if it's a known clothing size
    if (token.length === 1 && !["s", "m", "l"].includes(token)) {
      continue;
    }
    if (!STOP_WORDS.has(token)) {
      tokens.push(token);
    }
  }

  return tokens.length ? tokens : rawTokens.filter(t => t.length > 0);
}

/**
 * Distills a natural-language query into normalized full query, clean intent tokens & phrase.
 */
export function extractSearchIntent(rawQuery: string) {
  const normalizedFull = normalizeSearchText(rawQuery);
  const intentTokens = tokenizeSearchQuery(rawQuery);
  const intentPhrase = intentTokens.join(" ") || normalizedFull;
  const expandedSynonyms = expandQuerySynonyms(intentTokens, intentPhrase);
  return {
    normalizedFull,
    intentTokens,
    intentPhrase,
    expandedSynonyms,
  };
}

/**
 * Fashion domain synonym clusters bridging Vietnamese and English terms.
 */
export const FASHION_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["ao khoac", "khoac", "coat", "jacket", "trench", "trench coat", "bomber", "fleece", "blazer", "outerwear", "parka", "mang to"],
  ["ao len", "len", "det kim", "knit", "knitwear", "sweater", "pullover", "cardigan"],
  ["ao thun", "ao phong", "phong", "tee", "t shirt", "tshirt", "thun"],
  ["ao polo", "polo", "co be"],
  ["so mi", "ao so mi", "shirt", "blouse"],
  ["hoodie", "ao hoodie", "ao ni", "sweatshirt"],
  ["quan", "quan au", "quan tay", "quan dai", "quan ong rong", "quan jean", "quan kaki", "quan short", "trousers", "pants", "slacks", "wide leg", "chinos", "jeans", "shorts"],
  ["chan vay", "vay", "dam", "skirt", "dress"],
  ["tui", "tui xach", "tui da", "bag", "tote", "handbag"],
  ["khan", "khan choang", "khan lua", "scarf", "silk scarf"],
  ["nau", "mau nau", "brown", "camel", "caramel", "tan", "espresso", "coffee", "chocolate"],
  ["den", "mau den", "black", "noir", "dark"],
  ["trang", "kem", "mau kem", "mau trang", "white", "ivory", "cream", "off white", "oatmeal"],
  ["be", "mau be", "beige", "sand", "taupe"],
  ["navy", "xanh navy", "xanh", "blue", "marine"],
  ["xam", "ghi", "mau xam", "grey", "gray", "charcoal"],
  ["nam", "men", "male", "man"],
  ["nu", "women", "female", "woman"],
];

/**
 * Finds all expanded fashion synonyms for given query tokens or phrases.
 */
export function expandQuerySynonyms(tokens: string[], fullNormalizedQuery = ""): string[] {
  const synonyms = new Set<string>();
  const queryStr = fullNormalizedQuery || tokens.join(" ");

  for (const group of FASHION_SYNONYM_GROUPS) {
    let matchedGroup = false;

    for (const term of group) {
      if (queryStr === term || queryStr.includes(term) || (queryStr.length >= 2 && term.includes(queryStr))) {
        matchedGroup = true;
        break;
      }
      for (const token of tokens) {
        if (token === term || term.split(" ").includes(token)) {
          matchedGroup = true;
          break;
        }
      }
      if (matchedGroup) break;
    }

    if (matchedGroup) {
      for (const term of group) {
        synonyms.add(term);
        for (const part of term.split(" ")) {
          if (part.length > 1) synonyms.add(part);
        }
      }
    }
  }

  for (const token of tokens) {
    synonyms.delete(token);
  }

  return Array.from(synonyms);
}

/**
 * Calculates a multi-field weighted relevance score for a product given a user search.
 */
export function calculateRelevanceScore(
  product: ScorableProduct,
  rawQuery: string,
  tokens?: string[],
  synonyms?: string[],
): number {
  const queryNorm = normalizeSearchText(rawQuery);
  if (!queryNorm) return 0;

  const queryTokens = tokens ?? tokenizeSearchQuery(rawQuery);
  const intentPhrase = queryTokens.join(" ") || queryNorm;
  const synonymTokens = synonyms ?? expandQuerySynonyms(queryTokens, intentPhrase);

  const nameNorm = normalizeSearchText(product.name);
  const nameWithoutBrand = nameNorm.replace(/^aurel\s+/, "");
  const descNorm = normalizeSearchText(product.description ?? "");
  const catNorm = normalizeSearchText(product.category?.name ?? "");
  const brandNorm = normalizeSearchText(product.brand ?? "");
  const normalizedTags = (product.tags ?? []).map(t => normalizeSearchText(t)).filter(Boolean);
  const tagsCombined = normalizedTags.join(" ");

  const variantSkus = (product.variants ?? []).map(v => normalizeSearchText(v.sku ?? ""));
  const variantColors = (product.variants ?? []).map(v => normalizeSearchText(v.color ?? ""));
  const variantSizes = (product.variants ?? []).map(v => normalizeSearchText(v.size ?? ""));

  let score = 0;

  // 1. EXACT / HIGH-PRECISION NAME MATCHES
  if (nameNorm === queryNorm || nameNorm === intentPhrase) {
    score += 250;
  } else if (nameWithoutBrand === queryNorm || nameWithoutBrand === intentPhrase) {
    score += 230;
  } else if (
    nameNorm.startsWith(intentPhrase) ||
    nameWithoutBrand.startsWith(intentPhrase)
  ) {
    score += 140;
  } else if (nameNorm.includes(intentPhrase) || nameNorm.includes(queryNorm)) {
    score += 100;
  }

  // 2. TAGS MATCHING (High precision admin-assigned search tags)
  if (normalizedTags.length > 0) {
    for (const tag of normalizedTags) {
      if (tag === intentPhrase || tag === queryNorm) {
        score += 160;
      } else if (tag.includes(intentPhrase) || (tag.length >= 2 && intentPhrase.includes(tag))) {
        score += 110;
      }
    }
    let tokensInTags = 0;
    for (const token of queryTokens) {
      if (tagsCombined.includes(token)) {
        tokensInTags++;
        score += 35;
      }
    }
    if (queryTokens.length > 0 && tokensInTags === queryTokens.length) {
      score += 95;
    }
    for (const syn of synonymTokens) {
      if (syn.length > 2 && tagsCombined.includes(syn)) {
        score += 25;
      }
    }
  }

  // 3. SKU EXACT / PARTIAL MATCH
  for (const sku of variantSkus) {
    if (!sku) continue;
    if (sku === queryNorm) {
      score += 300;
    } else if (sku.includes(queryNorm)) {
      score += 120;
    }
  }

  // 4. TOKEN-BASED TITLE & CROSS-FIELD COVERAGE (Order-independent)
  if (queryTokens.length > 0) {
    let tokensInTitle = 0;
    let tokensAnywhere = 0;
    const combinedSurface = `${nameNorm} ${catNorm} ${tagsCombined} ${variantColors.join(" ")}`;

    for (const token of queryTokens) {
      if (nameNorm.includes(token)) {
        tokensInTitle++;
        score += 25;
      }
      if (combinedSurface.includes(token)) {
        tokensAnywhere++;
      }
    }
    if (tokensInTitle === queryTokens.length) {
      score += 80;
    } else if (tokensAnywhere === queryTokens.length) {
      // E.g. "áo" in category/tags + "polo" in name -> complete match!
      score += 65;
    }
  }

  // 5. SYNONYM TITLE MATCHING
  for (const syn of synonymTokens) {
    if (syn.length > 2 && nameNorm.includes(syn)) {
      score += 20;
    }
  }

  // 6. CATEGORY MATCHING
  if (catNorm) {
    if (catNorm === intentPhrase || catNorm === queryNorm) {
      score += 50;
    } else if (catNorm.includes(intentPhrase) || intentPhrase.includes(catNorm)) {
      score += 35;
    } else {
      for (const syn of synonymTokens) {
        if (catNorm.includes(syn)) {
          score += 20;
          break;
        }
      }
    }
  }

  // 7. BRAND MATCHING
  if (brandNorm && (brandNorm === intentPhrase || intentPhrase.includes(brandNorm))) {
    score += 20;
  }

  // 8. VARIANT ATTRIBUTES MATCHING (Colors & Sizes)
  for (const color of variantColors) {
    if (!color) continue;
    if (color === intentPhrase || queryTokens.includes(color)) {
      score += 40;
    } else {
      for (const syn of synonymTokens) {
        if (color.includes(syn)) {
          score += 25;
          break;
        }
      }
    }
  }

  for (const size of variantSizes) {
    if (!size) continue;
    if (queryTokens.includes(size)) {
      score += 15;
    }
  }

  // 9. DESCRIPTION MATCHING
  if (descNorm) {
    if (descNorm.includes(intentPhrase)) {
      score += 25;
    }
    for (const token of queryTokens) {
      if (descNorm.includes(token)) {
        score += 5;
      }
    }
  }

  return score;
}

/**
 * Ranks products by calculated relevance score descending.
 * Guaranteed deterministic and stable for equal scores.
 */
export function rankCatalogProducts<T extends ScorableProduct>(
  products: readonly T[],
  rawQuery: string,
): T[] {
  if (!rawQuery.trim() || !products.length) return [...products];

  const { intentTokens, expandedSynonyms } = extractSearchIntent(rawQuery);

  const scored = products.map((product, originalIndex) => ({
    product,
    originalIndex,
    score: calculateRelevanceScore(product, rawQuery, intentTokens, expandedSynonyms),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(item => item.product);
}
