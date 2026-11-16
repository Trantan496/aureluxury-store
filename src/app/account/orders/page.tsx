import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { OrdersView } from "@/components/account/orders-view";
import { loadUserOrders, type UserOrder } from "@/features/orders/user-orders";
import { shopActor } from "@/features/shop/service";
import styles from "@/components/wishlist/wishlist.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đơn của tôi | AUREL" };

// Sample preview data matching the reference screenshot in dev mode when ?preview=1
const previewOrders: UserOrder[] = [
  {
    id: 102839,
    orderNumber: "AUR102839",
    displayNumber: "#AUR102839",
    status: "DELIVERED",
    totalAmount: "2680000",
    formattedTotal: "2.680.000 ₫",
    subtotalAmount: "2680000",
    discountAmount: "0",
    currency: "VND",
    createdAt: "2026-11-02T10:00:00.000Z",
    formattedDate: "Đặt ngày 02 Th11, 2026",
    statusSubtext: "Giao thành công vào 04 Th11, 2026",
    shippingName: "Trần Ngọc Tân",
    shippingPhone: "0901234567",
    shippingAddress: "Số 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    items: [
      {
        productName: "AUREL - ÁO SƠ MI LỤA DÁNG SUÔNG",
        sku: "SHIRT-SILK-01",
        color: "Kem",
        size: "M",
        quantity: 1,
        unitPrice: "890.000 ₫",
        imageUrl: "/images/aurel/collection-demo/knit.png",
      },
      {
        productName: "AUREL - QUẦN ÂU ỐNG SUÔNG",
        sku: "PANTS-WIDE-01",
        color: "Be",
        size: "M",
        quantity: 1,
        unitPrice: "1.790.000 ₫",
        imageUrl: "/images/aurel/collection-demo/trousers.png",
      },
      {
        productName: "AUREL - KHĂN LỤA",
        sku: "SCARF-01",
        color: "Họa tiết",
        size: "F",
        quantity: 1,
        unitPrice: "500.000 ₫",
        imageUrl: null,
      },
    ],
  },
  {
    id: 102771,
    orderNumber: "AUR102771",
    displayNumber: "#AUR102771",
    status: "SHIPPED",
    totalAmount: "3560000",
    formattedTotal: "3.560.000 ₫",
    subtotalAmount: "3560000",
    discountAmount: "0",
    currency: "VND",
    createdAt: "2026-10-30T14:30:00.000Z",
    formattedDate: "Đặt ngày 30 Th10, 2026",
    statusSubtext: "Dự kiến giao: 03 Th11, 2026",
    shippingName: "Trần Ngọc Tân",
    shippingPhone: "0901234567",
    shippingAddress: "Số 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    items: [
      {
        productName: "AUREL - ÁO KHOÁC DẠ NGẮN",
        sku: "COAT-SHORT-01",
        color: "Nâu",
        size: "L",
        quantity: 1,
        unitPrice: "2.100.000 ₫",
        imageUrl: "/images/aurel/collection-demo/coat.png",
      },
      {
        productName: "AUREL - ÁO THUN COTTON CAO CẤP",
        sku: "TSHIRT-01",
        color: "Trắng kem",
        size: "L",
        quantity: 2,
        unitPrice: "730.000 ₫",
        imageUrl: "/images/aurel/collection-demo/knit.png",
      },
      {
        productName: "AUREL - TÚI DA MINI",
        sku: "BAG-MINI-01",
        color: "Nâu",
        size: "F",
        quantity: 1,
        unitPrice: "730.000 ₫",
        imageUrl: "/images/aurel/collection-demo/bag.png",
      },
      {
        productName: "AUREL - TẤT LEN CỔ CAO",
        sku: "SOCKS-01",
        color: "Kem",
        size: "F",
        quantity: 1,
        unitPrice: "200.000 ₫",
        imageUrl: null,
      },
    ],
  },
  {
    id: 102690,
    orderNumber: "AUR102690",
    displayNumber: "#AUR102690",
    status: "PENDING",
    totalAmount: "1290000",
    formattedTotal: "1.290.000 ₫",
    subtotalAmount: "1290000",
    discountAmount: "0",
    currency: "VND",
    createdAt: "2026-10-28T09:15:00.000Z",
    formattedDate: "Đặt ngày 28 Th10, 2026",
    statusSubtext: "Đơn hàng đang được kiểm tra.",
    shippingName: "Trần Ngọc Tân",
    shippingPhone: "0901234567",
    shippingAddress: "Số 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    items: [
      {
        productName: "AUREL - ÁO POLO DỆT KIM",
        sku: "POLO-KNIT-01",
        color: "Nâu sẫm",
        size: "M",
        quantity: 1,
        unitPrice: "690.000 ₫",
        imageUrl: "/images/aurel/collection-demo/knit.png",
      },
      {
        productName: "AUREL - QUẦN LINEN THOÁNG MÁT",
        sku: "PANTS-LINEN-01",
        color: "Be",
        size: "M",
        quantity: 1,
        unitPrice: "600.000 ₫",
        imageUrl: "/images/aurel/collection-demo/trousers.png",
      },
    ],
  },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const isPreview = process.env.NODE_ENV !== "production" && params?.preview === "1";

  let realOrders: UserOrder[] | null = null;
  try {
    const actor = await shopActor();
    realOrders = await loadUserOrders(actor.id);
  } catch {
    realOrders = null;
  }

  const orders = realOrders ?? (isPreview ? previewOrders : null);

  return (
    <AccountShell title="Đơn của tôi" current="Đơn của tôi">
      <p style={{ margin: "-12px 0 24px", color: "#817970", fontSize: "14.5px" }}>
        Theo dõi trạng thái đơn hàng và xem lại các đơn mua sắm của bạn.
      </p>
      {orders ? (
        <OrdersView orders={orders} />
      ) : (
        <section className={styles.empty} role="status">
          <h2>Đăng nhập để xem đơn hàng</h2>
          <p>Xem lại lịch sử mua sắm và theo dõi quá trình giao hàng cùng AUREL.</p>
          <Link href="/login?next=%2Faccount%2Forders" className={styles.cta}>
            Đăng nhập
          </Link>
        </section>
      )}
    </AccountShell>
  );
}
