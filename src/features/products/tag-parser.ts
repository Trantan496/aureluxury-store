const MAX_TAGS_PER_PRODUCT = 30;
const MAX_TAG_LENGTH = 50;

export function parseSemicolonTags(raw: unknown): string[] {
  let candidates: string[] = [];
  if (typeof raw === "string") {
    candidates = raw.split(";");
  } else if (Array.isArray(raw)) {
    candidates = raw.filter((item): item is string => typeof item === "string");
  } else {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of candidates) {
    const clean = part
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TAG_LENGTH);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_TAGS_PER_PRODUCT) break;
  }

  return result;
}

export function formatSemicolonTags(tags: readonly string[] | null | undefined): string {
  if (!tags?.length) return "";
  return tags.join("; ");
}
