import Link from "next/link";
import { createProductDataService } from "@/lib/products";
import styles from "@/components/admin/products.module.css";
import { ProductAdminFrame } from "@/components/admin/product-admin-frame";
export const dynamic = "force-dynamic";
export const metadata = { title: "Quản lý sản phẩm", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function AdminProductsLayout({ children }: { children: React.ReactNode }) {
  const access = await createProductDataService().managementList();
  if (!access.ok) return <section className={`${styles.shell} ${styles.access}`}><h1>{access.error.code === "UNAUTHENTICATED" ? "Đăng nhập để tiếp tục" : access.error.code === "FORBIDDEN" ? "Chỉ dành cho ADMIN" : "Chưa thể tải quản lý sản phẩm"}</h1><Link href="/login?next=%2Fadmin%2Fproducts">Đăng nhập</Link></section>;
  return <ProductAdminFrame navigation={{ categories:access.data.categories,collections:access.data.collections,rows:access.data.rows,limited:access.data.navigationLimited }}>{children}</ProductAdminFrame>;
}
