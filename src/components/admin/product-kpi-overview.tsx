import { DashIcon } from "./product-dashboard-icons";
import type { ProductDashboardStats } from "@/features/products/dashboard";
import styles from "./product-dashboard.module.css";

export function ProductKPIOverview({ totals }: { totals: ProductDashboardStats["totals"] }) {
  const kpis = [
    {
      label: "Tổng sản phẩm",
      value: totals.all,
      hint: "Toàn bộ danh mục sản phẩm",
      tone: "all",
      icon: "box" as const,
    },
    {
      label: "Đang hoạt động",
      value: totals.active,
      hint: "Hiển thị và mở bán",
      tone: "active",
      icon: "check" as const,
    },
    {
      label: "Đã lưu trữ",
      value: totals.archived,
      hint: "Tạm ẩn hoặc đã lưu kho",
      tone: "archived",
      icon: "archive" as const,
    },
    {
      label: "Cảnh báo tồn ≤ 5",
      value: totals.lowStockVariants,
      hint: "Biến thể sắp hết hàng",
      tone: "stock",
      icon: "alert" as const,
    },
  ];

  return (
    <section className={styles.kpis} aria-label="Chỉ số hiệu suất sản phẩm">
      {kpis.map(item => (
        <article key={item.label} className={styles.card} data-tone={item.tone}>
          <div className={styles.kpi} data-tone={item.tone}>
            <div className={styles.kpiIcon}>
              <DashIcon name={item.icon} />
            </div>
            <div>
              <div className={styles.kpiLabel}>{item.label}</div>
              <div className={styles.kpiValue}>{item.value.toLocaleString("vi-VN")}</div>
              <div className={styles.kpiHint}>{item.hint}</div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
