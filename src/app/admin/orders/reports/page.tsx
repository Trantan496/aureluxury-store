import Link from "next/link";
import { SellerReports } from "@/components/admin/seller-reports";
import { shopActor } from "@/features/shop/service";
import styles from "@/components/admin/seller-orders.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Báo cáo đơn hàng và tồn kho | AUREL",
  robots: { index: false, follow: false },
};

export default async function Page() {
  let error = "";
  try {
    const user = await shopActor();
    if (user.role !== "ADMIN") error = "Chỉ quản trị viên được truy cập báo cáo và tồn kho.";
  } catch {
    error = "Vui lòng đăng nhập tài khoản quản trị. Nếu đã đăng nhập, hãy thử lại khi kết nối dữ liệu sẵn sàng.";
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <h1>Báo cáo đơn hàng và tồn kho</h1>
            <p role="status">{error}</p>
            <div className={styles.emptyActions}>
              <Link href="/login?next=%2Fadmin%2Forders%2Freports" className={styles.btnPrimary}>
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

  return <SellerReports />;
}
