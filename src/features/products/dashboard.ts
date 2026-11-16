import "server-only";
import type { ProductDataTransaction, ServiceResult } from "./product-service.ts";
import { InputError, object } from "./validation.ts";
import { adminThumbnail, categoryDistribution, dayWindow, fillDailySeries, parseDashboardRange, type DashboardRange } from "./dashboard-rules.ts";

type Run = <T>(work: (tx: ProductDataTransaction, actorId: number) => Promise<T>) => Promise<ServiceResult<T>>;

export type ProductDashboardStats = {
  range: DashboardRange;
  totals: { all: number; active: number; archived: number; lowStockVariants: number };
  categories: { total: number; slices: { name: string; count: number; percent: number }[] };
  created: { total: number; series: { day: string; count: number }[] };
};
export type ProductRowExtra = { id: number; slug: string; thumbnail: string | null; thumbnailAlt: string | null; stock: number; activeVariants: number };

/**
 * Read-only aggregates for /admin/products. Runs inside the existing ADMIN-checked
 * transaction (`run`). Queries are sequential: never fan out on one transaction client.
 * Scope: the whole catalog, independent from the table's search/filter/pagination.
 */
export function createDashboardOperations(run: Run) {
  return {
    managementDashboard(input: unknown = {}) {
      return run<ProductDashboardStats>(async tx => {
        const v = object(input, ["range"]);
        const range = parseDashboardRange(v.range);
        const all = await tx.product.count();
        const active = await tx.product.count({ where: { isActive: true } });
        const lowStockVariants = await tx.productVariant.count({ where: { isActive: true, stock: { lte: 5 }, product: { isActive: true } } });
        const grouped = await tx.product.groupBy({ by: ["categoryId"], _count: { _all: true } });
        const names = await tx.category.findMany({ where: { id: { in: grouped.map(row => row.categoryId) } }, select: { id: true, name: true } });
        const nameOf = new Map(names.map(row => [row.id, row.name]));
        const categories = categoryDistribution(grouped.map(row => ({ name: nameOf.get(row.categoryId) ?? "Chưa xác định", count: row._count._all })));
        const now = new Date(), window = dayWindow(now, range);
        const start = new Date(now.getTime() - (range + 1) * 86400000);
        const daily = await tx.$queryRaw<{ day: string; count: number }[]>`
          SELECT to_char(timezone('Asia/Ho_Chi_Minh', timezone('UTC', "createdAt")), 'YYYY-MM-DD') AS day, count(*)::int AS count
          FROM "Product" WHERE "createdAt" >= ${start} GROUP BY 1`;
        const series = fillDailySeries(window, daily.map(row => ({ day: row.day, count: Number(row.count) })));
        return { range, totals: { all, active, archived: all - active, lowStockVariants }, categories, created: { total: series.reduce((sum, row) => sum + row.count, 0), series } };
      });
    },
    /** Thumbnail/stock for at most one table page of ids already returned by managementList. */
    managementRowExtras(ids: unknown) {
      return run<ProductRowExtra[]>(async tx => {
        if (!Array.isArray(ids) || ids.length > 25 || !ids.every(id => Number.isInteger(id) && id > 0 && id <= 2147483647)) throw new InputError("ids");
        if (!ids.length) return [];
        const rows = await tx.product.findMany({
          where: { id: { in: ids as number[] } },
          select: {
            id: true, slug: true,
            images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }], take: 1, select: { storageKey: true, altText: true } },
            variants: { where: { isActive: true }, select: { stock: true } },
          },
        });
        return rows.map(row => ({
          id: row.id, slug: row.slug,
          thumbnail: adminThumbnail(row.images[0]?.storageKey), thumbnailAlt: row.images[0]?.altText ?? null,
          stock: row.variants.reduce((sum, variant) => sum + variant.stock, 0), activeVariants: row.variants.length,
        }));
      });
    },
  };
}
