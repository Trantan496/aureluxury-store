import Link from "next/link";
import { SellerOrders } from "@/components/admin/seller-orders";
import { sellerActor } from "@/features/orders/seller-orders";
import { ShopError } from "@/features/shop/rules";
import styles from "@/components/admin/seller-orders.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Quản lý đơn hàng | AUREL",
  robots: { index: false, follow: false },
};

export default async function Page() {
  try {
    await sellerActor();
  } catch (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h1>Quản lý đơn hàng</h1>
            <p role="status">
              {error instanceof ShopError
                ? error.message
                : "Chưa thể kết nối dữ liệu đơn hàng. Vui lòng thử lại."}
            </p>
            <div className={styles.emptyActions}>
              <Link href="/login?next=%2Fadmin%2Forders" className={styles.btnPrimary}>
                Đăng nhập tài khoản người bán
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <SellerOrders />;
}
