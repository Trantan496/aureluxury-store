"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminIcon } from "./admin-icon";
import styles from "./products.module.css";

export interface ProductSidebarProps {
  categories?: { id: number; name: string }[];
  collections?: string[];
  rows?: { id: number; name: string; categoryId: number; collection?: string | null }[];
  limited?: boolean;
}

export function ProductSidebar(props: ProductSidebarProps) {
  void props;
  const pathname = usePathname() || "/admin/products";

  const isProductsActive = pathname.startsWith("/admin/products");
  const isOrdersActive = pathname.startsWith("/admin/orders") && !pathname.includes("/reports");
  const isReportsActive = pathname.startsWith("/admin/orders/reports");
  const isVouchersActive = pathname.startsWith("/admin/vouchers");

  return (
    <details className={styles.sidebar} open>
      <summary className={styles.sidebarSummary}>Menu quản trị AUREL</summary>
      <nav className={styles.sidebarNav} aria-label="Điều hướng quản lý AUREL">
        <div className={styles.sidebarTopSection}>
          <div className={styles.sidebarHeader}>
            <Link href="/admin/products" className={styles.sidebarLogoLink} aria-label="AUREL Quản trị">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.sidebarLogoMark}>
                <path d="M12 2.5 3.5 21.5h4.2l2.3-5.2h8l2.3 5.2h4.2L12 2.5Zm0 6.2 2.6 5.8h-5.2L12 8.7Z" />
              </svg>
              <span className={styles.sidebarLogoText}>AUREL</span>
            </Link>
          </div>

          <div className={styles.sidebarMenu}>
            <Link
              href="/admin/products"
              className={styles.sidebarMenuItem}
              aria-current={pathname === "/admin" ? "page" : undefined}
            >
              <AdminIcon name="home" />
              <span>Tổng quan</span>
            </Link>

            <Link
              href="/admin/orders"
              className={styles.sidebarMenuItem}
              aria-current={isOrdersActive ? "page" : undefined}
            >
              <AdminIcon name="bag" />
              <span>Đơn hàng</span>
              <span className={styles.navBadge}>12</span>
            </Link>

            <Link
              href="/admin/products"
              className={styles.sidebarMenuItem}
              aria-current={isProductsActive ? "page" : undefined}
            >
              <AdminIcon name="layers" />
              <span>Sản phẩm</span>
            </Link>

            <Link
              href="/admin/products"
              className={styles.sidebarMenuItem}
            >
              <AdminIcon name="grid" />
              <span>Danh mục</span>
            </Link>

            <Link
              href="/admin/orders/reports"
              className={styles.sidebarMenuItem}
            >
              <AdminIcon name="box" />
              <span>Kho hàng</span>
            </Link>

            <Link
              href="/admin/vouchers"
              className={styles.sidebarMenuItem}
              aria-current={isVouchersActive ? "page" : undefined}
            >
              <AdminIcon name="tag" />
              <span>Khuyến mãi</span>
            </Link>

            <Link
              href="/admin/orders"
              className={styles.sidebarMenuItem}
            >
              <AdminIcon name="users" />
              <span>Khách hàng</span>
            </Link>

            <Link
              href="/admin/messages"
              className={styles.sidebarMenuItem}
              aria-current={pathname.startsWith("/admin/messages") ? "page" : undefined}
            >
              <AdminIcon name="chat" />
              <span>Tin nhắn</span>
            </Link>

            <Link
              href="/admin/reviews"
              className={styles.sidebarMenuItem}
              aria-current={pathname.startsWith("/admin/reviews") ? "page" : undefined}
            >
              <AdminIcon name="star" />
              <span>Đánh giá</span>
            </Link>

            <Link
              href="/admin/orders/reports"
              className={styles.sidebarMenuItem}
              aria-current={isReportsActive ? "page" : undefined}
            >
              <AdminIcon name="chart" />
              <span>Báo cáo</span>
            </Link>

            <Link
              href="/admin/products"
              className={styles.sidebarMenuItem}
            >
              <AdminIcon name="settings" />
              <span>Cài đặt</span>
            </Link>
          </div>
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarPromoCard}>
            <div className={styles.promoBrand}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.promoLogoMark}>
                <path d="M12 2.5 3.5 21.5h4.2l2.3-5.2h8l2.3 5.2h4.2L12 2.5Zm0 6.2 2.6 5.8h-5.2L12 8.7Z" />
              </svg>
              <span className={styles.promoBrandText}>AUREL</span>
            </div>
            <p className={styles.promoTitle}>Quản trị bán hàng<br />hiệu quả hơn</p>
            <Link href="/admin/orders/reports" className={styles.promoButton}>
              <span>Xem báo cáo</span>
              <span aria-hidden="true" className={styles.promoArrow}>→</span>
            </Link>
          </div>
        </div>
      </nav>
    </details>
  );
}
