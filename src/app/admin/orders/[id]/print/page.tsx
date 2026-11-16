import { shopActor } from "@/features/shop/service";
import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await shopActor();
  if (actor.role !== "ADMIN") notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) notFound();
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();
  return <div className="container page-section"><h1>Phiếu đóng gói — DEMO</h1><p>Dùng Ctrl+P để in. Đây không phải nhãn của hãng vận chuyển.</p><h2>{order.orderNumber}</h2><p>{order.shippingName} · {order.shippingPhone}<br/>{order.shippingAddress}</p><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / size</th><th>Số lượng</th></tr></thead><tbody>{order.items.map(item => <tr key={item.id}><td>{item.sku}</td><td>{item.productName}</td><td>{item.color} / {item.size}</td><td>{item.quantity}</td></tr>)}</tbody></table>{order.voucherCode && <p>Tiền hàng: {order.subtotalAmount?.toString()} VND<br/>Voucher {order.voucherCode}: −{order.discountAmount.toString()} VND</p>}<p>Tổng phải trả: {order.totalAmount.toString()} {order.currency ?? "chưa xác định"}</p></div>;
}
