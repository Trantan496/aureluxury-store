import type { CollectionPiece } from "./preview";

const ignoredWords = new Set(["a", "an", "the", "and", "for", "with", "what", "goes", "i", "want", "looking", "outfit", "outfits", "piece", "pieces"]);
function words(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Deterministic demo keyword search, not a recommendation or AI service.
// The UI can later submit to a server API without changing these fixtures.
export function matchesCollectionQuery(piece: CollectionPiece, query: string): boolean {
  if (!query.trim()) return true;
  const terms = words(query).filter(word => !ignoredWords.has(word));
  if (!terms.length) return false;
  const searchable = words([piece.name, piece.category, ...(piece.colors ?? []), piece.description].filter(Boolean).join(" "));
  return terms.every(term => searchable.some(word => word === term || word === `${term}s` || `${word}s` === term));
}
