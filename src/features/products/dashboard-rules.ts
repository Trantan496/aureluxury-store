// Pure helpers for the Admin product dashboard. No database or React imports.

export const dashboardRanges = [7, 30, 90] as const;
export type DashboardRange = (typeof dashboardRanges)[number];
export const dashboardTimeZone = "Asia/Ho_Chi_Minh";

/** Unknown/missing range falls back to 30 days; never throws for a presentation filter. */
export function parseDashboardRange(value: unknown): DashboardRange {
  const n = Number(value);
  return (dashboardRanges as readonly number[]).includes(n) ? (n as DashboardRange) : 30;
}

/** YYYY-MM-DD for an instant in the shop's time zone. */
export function localDay(instant: Date, timeZone = dashboardTimeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Inclusive list of `days` local calendar days ending at `now`. */
export function dayWindow(now: Date, days: number, timeZone = dashboardTimeZone) {
  const result: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) result.push(localDay(new Date(now.getTime() - offset * 86400000), timeZone));
  return [...new Set(result)];
}

/** Fill every day of the window, so missing days are a real zero rather than a gap. */
export function fillDailySeries(window: string[], counts: { day: string; count: number }[]) {
  const map = new Map(counts.map(row => [row.day, row.count]));
  return window.map(day => ({ day, count: map.get(day) ?? 0 }));
}

/**
 * Each product has exactly one categoryId, so counts are never duplicated.
 * Keeps the largest `limit` categories and groups the remainder as "Khác".
 */
export function categoryDistribution(rows: { name: string; count: number }[], limit = 4) {
  const sorted = rows.filter(row => row.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  const total = sorted.reduce((sum, row) => sum + row.count, 0);
  const head = sorted.slice(0, limit), rest = sorted.slice(limit);
  const slices = rest.length ? [...head, { name: "Khác", count: rest.reduce((sum, row) => sum + row.count, 0) }] : head;
  return { total, slices: slices.map(slice => ({ ...slice, percent: total ? Math.round((slice.count / total) * 1000) / 10 : 0 })) };
}

/** Only same-origin absolute paths are rendered; anything else falls back to a placeholder. */
export function adminThumbnail(storageKey: string | null | undefined) {
  if (typeof storageKey !== "string" || storageKey.length > 500) return null;
  if (!/^\/(?!\/)[A-Za-z0-9._~\-/%]+$/.test(storageKey) || storageKey.includes("..")) return null;
  return storageKey;
}

export function percentOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
