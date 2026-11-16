import Link from "next/link";
import { shopActor } from "@/features/shop/service";
import { VoucherManager } from "@/components/admin/voucher-manager";
import styles from "@/components/admin/seller-orders.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Quản lý voucher | AUREL",
  robots: { index: false, follow: false },
};

export default async function Page() {
  let allowed = false;
  try {
    allowed = (await shopActor()).role === "ADMIN";
  } catch {
    /* Render usable access/error state. */
  }

  if (!allowed) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h1>Quản lý voucher</h1>
            <p role="status">Cần đăng nhập ADMIN và kết nối dữ liệu sẵn sàng.</p>
            <div className={styles.emptyActions}>
              <Link href="/login?next=%2Fadmin%2Fvouchers" className={styles.btnPrimary}>
                Đăng nhập ADMIN
              </Link>
              <Link href="/products" className={styles.btnOutline}>
                Xem cửa hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <VoucherManager />;
}
