import Link from "next/link";
import { DashIcon } from "./product-dashboard-icons";
import { dashboardHref, type DashboardQuery } from "./product-dashboard-query";
import { dashboardRanges, type DashboardRange } from "@/features/products/dashboard-rules";
import styles from "./product-dashboard.module.css";

export function ProductDashboardHeader({ query, currentRange }: { query: DashboardQuery; currentRange: DashboardRange }) {
  return (
    <header className={styles.header}>
      <div>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link href="/">Trang chủ</Link>
            </li>
            <li>
              <Link href="/admin/products" aria-current="page">Sản phẩm</Link>
            </li>
          </ol>
        </nav>
        <h1>Quản lý sản phẩm</h1>
        <p>Theo dõi hiệu suất, tồn kho và quản lý toàn bộ sản phẩm của AUREL.</p>
      </div>

      <div className={styles.headerActions}>
        <div className={styles.rangeGroup} role="group" aria-label="Khoảng thời gian thống kê">
          {dashboardRanges.map(days => (
            <Link
              key={days}
              href={dashboardHref(query, { range: String(days) })}
              aria-current={currentRange === days ? "true" : undefined}
            >
              {days} ngày qua
            </Link>
          ))}
        </div>

        <Link href="/admin/products/new" className={styles.primaryAction}>
          <DashIcon name="plus" />
          <span>Thêm sản phẩm</span>
        </Link>
      </div>
    </header>
  );
}
