import Link from "next/link";
import { PayosPayment } from "./payos-payment";
import { shopActor } from "@/features/shop/service";
import { paymentView } from "@/features/payments/service";
export async function PaymentReturn({ searchParams, mode }: { searchParams: Promise<Record<string, string | string[] | undefined>>; mode: "success" | "cancel" }) {
  const query = await searchParams;
  const raw = query.order;
  let orderId = 0;
  try {
    if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 2147483647) throw new Error();
    orderId = Number(raw); const actor = await shopActor(); await paymentView(orderId, actor.id);
  } catch { return <div className="container page-section"><h1>AUREL</h1><p>Đăng nhập bằng tài khoản đặt hàng để xem trạng thái thanh toán.</p><Link href={`/login?next=${encodeURIComponent(`/checkout/${mode}${orderId ? `?order=${orderId}` : ""}`)}`}>Đăng nhập</Link> · <Link href="/account/orders">Xem đơn hàng</Link></div>; }
  return <div className="container page-section"><PayosPayment orderId={orderId} returnMode={mode}/></div>;
}
