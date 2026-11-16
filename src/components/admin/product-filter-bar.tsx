import Link from "next/link";
import { DashIcon } from "./product-dashboard-icons";
import { dashboardHref, type DashboardQuery } from "./product-dashboard-query";
import styles from "./product-dashboard.module.css";

type CategoryOption = { id: number; name: string };
type CollectionOption = string;

export function ProductFilterBar({
  query,
  categories,
  collections,
  total,
}: {
  query: DashboardQuery;
  categories: CategoryOption[];
  collections: CollectionOption[];
  total: number;
}) {
  const hasActiveFilters = Boolean(query.q || (query.status && query.status !== "all") || query.category || query.collection);

  return (
    <div className={styles.card}>
      <form method="get" action="/admin/products" className={styles.filterBar}>
        {/* Hidden inputs to preserve range */}
        {query.range && <input type="hidden" name="range" value={query.range} />}

        <div className={styles.searchField}>
          <DashIcon name="search" />
          <input
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            placeholder="Tìm theo tên hoặc mã SKU..."
            className={styles.filterInput}
            maxLength={200}
          />
        </div>

        <select
          name="category"
          defaultValue={query.category ?? ""}
          className={styles.filterSelect}
          aria-label="Lọc theo danh mục"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={query.status ?? "all"}
          className={styles.filterSelect}
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="archived">Đã lưu trữ</option>
        </select>

        {collections.length > 0 && (
          <select
            name="collection"
            defaultValue={query.collection ?? ""}
            className={styles.filterSelect}
            aria-label="Lọc theo bộ sưu tập"
          >
            <option value="">Tất cả bộ sưu tập</option>
            {collections.map(col => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        )}

        <button type="submit" className={styles.filterSubmit}>
          Lọc
        </button>

        {hasActiveFilters && (
          <Link
            href={dashboardHref(query, { q: null, status: null, category: null, collection: null, page: null })}
            className={styles.clearFilters}
          >
            <DashIcon name="x" />
            <span>Xóa lọc</span>
          </Link>
        )}
      </form>

      {hasActiveFilters && (
        <div className={styles.activeFilters} style={{ marginTop: 12 }}>
          <span>Tìm thấy {total} kết quả phù hợp</span>
          {query.q && <span>Từ khóa: &quot;{query.q}&quot;</span>}
          {query.status && query.status !== "all" && (
            <span>Trạng thái: {query.status === "active" ? "Đang hoạt động" : "Đã lưu trữ"}</span>
          )}
          {query.category && (
            <span>
              Danh mục: {categories.find(c => String(c.id) === query.category)?.name ?? query.category}
            </span>
          )}
          {query.collection && <span>Bộ sưu tập: {query.collection}</span>}
        </div>
      )}
    </div>
  );
}
