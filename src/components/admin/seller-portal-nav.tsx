import Link from "next/link";
import styles from "./seller-orders.module.css";

import { AdminIcon } from "./admin-icon";
export type SellerSection = "orders" | "reports" | "vouchers" | "messages" | "reviews";

export function SellerPortalIcon({ name }: { name: "box" | "orders" | "chart" | "voucher" | "external" | "refresh" | "clock" | "alert" | "check" | "layers" | "plus" | "printer" | "chat" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "chat" && <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.38-4.3-1.08L3 20l1.15-4.35A8.5 8.5 0 1 1 21 11.5Z"/>}
      {name === "box" && <><path d="m3 8 9-5 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></>}
      {name === "orders" && <><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 7h16M9 11a3 3 0 0 0 6 0"/></>}
      {name === "chart" && <><path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/></>}
      {name === "voucher" && <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M10 9h.01M14 15h.01M9.5 14.5l5-5"/></>}
      {name === "external" && <><path d="M7 17 17 7"/><path d="M9 7h8v8"/></>}
      {name === "refresh" && <><path d="M21 12a9 9 0 0 0-15.5-6.36L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.36L21 16"/><path d="M16 16h5v5"/></>}
      {name === "clock" && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
      {name === "alert" && <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/></>}
      {name === "check" && <><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/></>}
      {name === "layers" && <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>}
      {name === "plus" && <path d="M12 5v14M5 12h14"/>}
      {name === "printer" && <><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6v-7Z"/></>}
    </svg>
  );
}

export function SellerPortalNav({ active }: { active: SellerSection }) {
  return (
    <nav className={styles.navigationBar} aria-label="Quản lý cửa hàng">
      <div className={styles.navLinks}>
        <Link href="/admin/products" className={styles.navLink}>
          <SellerPortalIcon name="box" />
          <span>Sản phẩm</span>
        </Link>
        <Link href="/admin/orders" className={styles.navLink} aria-current={active === "orders" ? "page" : undefined}>
          <SellerPortalIcon name="orders" />
          <span>Đơn hàng</span>
        </Link>
        <Link href="/admin/orders/reports" className={styles.navLink} aria-current={active === "reports" ? "page" : undefined}>
          <SellerPortalIcon name="chart" />
          <span>Báo cáo &amp; tồn kho</span>
        </Link>
        <Link href="/admin/vouchers" className={styles.navLink} aria-current={active === "vouchers" ? "page" : undefined}>
          <SellerPortalIcon name="voucher" />
          <span>Voucher</span>
        </Link>
        <Link href="/admin/messages" className={styles.navLink} aria-current={active === "messages" ? "page" : undefined}>
          <SellerPortalIcon name="chat" />
          <span>Tin nhắn</span>
        </Link>
        <Link href="/admin/reviews" className={styles.navLink} aria-current={active === "reviews" ? "page" : undefined}>
          <AdminIcon name="star" />
          <span>Đánh giá</span>
        </Link>
      </div>
      <Link href="/products" className={styles.storeLink}>
        <span>Xem cửa hàng</span>
        <SellerPortalIcon name="external" />
      </Link>
    </nav>
  );
}

