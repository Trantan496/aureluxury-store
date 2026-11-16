// Builds /admin/products URLs from the current, already-whitelisted dashboard query.
export type DashboardQuery = { q?: string; status?: string; category?: string; collection?: string; range?: string; page?: string };

export function dashboardHref(current: DashboardQuery, changes: Partial<Record<keyof DashboardQuery, string | null>>) {
  const next = new URLSearchParams();
  const merged: Record<string, string | null | undefined> = { ...current, ...changes };
  for (const key of ["q", "status", "category", "collection", "range", "page"] as const) {
    const value = merged[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "status" && value === "all") continue;
    if (key === "page" && value === "1") continue;
    next.set(key, value);
  }
  const text = next.toString();
  return text ? `/admin/products?${text}` : "/admin/products";
}

/** Compact page list: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b), result: (number | "gap")[] = [];
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) result.push("gap"); result.push(n); });
  return result;
}
