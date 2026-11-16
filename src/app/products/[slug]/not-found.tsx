import { EmptyState } from "@/components/ui/empty-state";
import styles from "@/components/products/product-detail.module.css";
export default function ProductDetailNotFound() { return <div className={styles.page}><EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm không tồn tại hoặc hiện không được hiển thị. Bạn có thể tiếp tục khám phá danh mục." href="/products" action="Trở về danh mục"/></div>; }
