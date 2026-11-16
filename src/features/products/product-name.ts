/**
 * AUREL Product Naming Standards
 *
 * Enforces the brand requirement:
 * - Strict format: "AUREL - TÊN SẢN PHẨM" (uppercase product title after "AUREL - ")
 * - Strips all numbers (leading list numbering like "11. ", embedded numbers, numeric prices)
 * - Idempotent: handles inputs already prefixed with "AUREL ", "AUREL - ", "AUREL — ", etc.
 */

export function formatAurelProductName(rawName: unknown): string {
  if (typeof rawName !== "string") return "";
  let body = rawName.trim().replace(/\s+/g, " ");
  if (!body) return "";

  // Strip any existing AUREL prefix + separator ("AUREL ", "AUREL - ", "AUREL — ", "Aurel:")
  while (/^aurel(?:\s*[-–—:]\s*|\s+)/i.test(body)) {
    body = body.replace(/^aurel(?:\s*[-–—:]\s*|\s+)/i, "").trim();
  }

  if (!body || /^aurel$/i.test(body)) {
    return "AUREL";
  }

  // Remove leading list numbering prefixes such as "11. ", "01 - ", "2) "
  body = body.replace(/^\s*\d+\s*[.):\-–—]+\s*/g, "");

  // Remove numbers (including thousands/decimal separators and attached currency unit like "1.000đ")
  body = body.replace(/\d+(?:[.,]\d+)*(?:\s*(?:vnđ|đ|vnd)(?=$|[\s\-–—.,/)]))?/gi, " ");

  // Clean redundant spaces and orphan leading/trailing separators
  body = body
    .replace(/\s*[-–—]\s*[-–—]+\s*/g, " — ")
    .replace(/^[\s\-–—.:,/]+/, "")
    .replace(/[\s\-–—.:,/]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!body) {
    return "AUREL";
  }

  return `AUREL - ${body.toLocaleUpperCase("vi")}`;
}
