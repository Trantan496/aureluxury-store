import { ProductDashboardHeader } from "./product-dashboard-header";
import { ProductKPIOverview } from "./product-kpi-overview";
import { ProductChartsArea } from "./product-charts-area";
import { ProductFilterBar } from "./product-filter-bar";
import { ProductTable } from "./product-table";
import type { ProductDashboardStats, ProductRowExtra } from "@/features/products/dashboard";
import type { DashboardQuery } from "./product-dashboard-query";
import type { createProductService } from "@/features/products/product-service";
import styles from "./product-dashboard.module.css";

type ListResult = Awaited<ReturnType<ReturnType<typeof createProductService>["managementList"]>>;

export function ProductExplorer({
  result,
  stats,
  extras,
  query,
  notice,
}: {
  result: ListResult;
  stats: ProductDashboardStats | null;
  extras: ProductRowExtra[];
  query: DashboardQuery;
  notice?: string;
}) {
  if (!result.ok) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.card}>
          <div className={styles.chartError} role="alert">
            Không thể tải danh sách sản phẩm. Kiểm tra quyền ADMIN hoặc thử tải lại trang.
          </div>
        </div>
      </div>
    );
  }

  const { rows, total, page, categories, collections } = result.data;
  const extraMap = new Map<number, ProductRowExtra>(extras.map(e => [e.id, e]));
  const currentRange = stats?.range ?? 30;

  return (
    <div className={styles.dashboard}>
      {/* 1. Header with Breadcrumb, Title & Add Product */}
      <ProductDashboardHeader query={query} currentRange={currentRange} />

      {/* Notice alert after delete/actions */}
      {notice && (
        <div role="status" className={styles.notice}>
          {notice}
        </div>
      )}

      {/* 2. Product KPI Overview Cards */}
      {stats && <ProductKPIOverview totals={stats.totals} />}

      {/* 3. Analytics Charts: Created over time, Categories, Status breakdown */}
      <ProductChartsArea stats={stats} />

      {/* 4. Search and Filters */}
      <ProductFilterBar
        query={query}
        categories={categories}
        collections={collections}
        total={total}
      />

      {/* 5. Product Management Table with Thumbnails, SKU, Status, Stock, Actions & Pagination */}
      <ProductTable
        rows={rows}
        extras={extraMap}
        categories={categories}
        page={page}
        total={total}
        query={query}
      />
    </div>
  );
}
