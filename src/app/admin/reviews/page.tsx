import Link from "next/link";
import { SellerReviews } from "@/components/admin/seller-reviews";
import { sellerActor } from "@/features/orders/seller-orders";
import { ShopError } from "@/features/shop/rules";
import styles from "@/components/admin/seller-orders.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Kiểm duyệt đánh giá | AUREL",
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
            <h1>Kiểm duyệt đánh giá</h1>
            <p role="status">
              {error instanceof ShopError
                ? error.message
                : "Chưa thể xác thực tài khoản người bán. Vui lòng thử lại."}
            </p>
            <div className={styles.emptyActions}>
              <Link href="/login?next=%2Fadmin%2Freviews" className={styles.btnPrimary}>
                Đăng nhập tài khoản người bán
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <SellerReviews />;
}
