"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { canTransition, statusLabels } from "@/features/shop/rules";
import { CheckoutVoucher, type VoucherSelection } from "./checkout-voucher";
import { PayosPayment, paymentRequest } from "./payos-payment";
import { paymentLabels, payosRedirectUrl } from "@/features/payments/rules";

type CartItem = { variantId: number; quantity: number; name: string; slug: string; color: string; size: string; stock: number; price: string | null; available: boolean };
type Order = { id: number; orderNumber: string; status: string; totalAmount: string; subtotalAmount: string | null; discountAmount: string; voucherCode: string | null; currency: string | null; createdAt: string; shippingName: string; shippingPhone: string; shippingAddress: string; items: { productName: string; sku: string; color: string; size: string; quantity: number; unitPrice: string; lineTotal: string | null }[]; payment?: { paidAt: string | null; reconciliationRequired: boolean; attempts: { status: string; paymentLinkId: string | null; paidAmount: string | null; reference: string | null; receipts?: { reference: string; amount: string; receivedAt: string }[] }[] } | null };
type ShopData = { items?: CartItem[]; orders?: Order[]; fullName?: string; email?: string; city?: string; birthYear?: number; addresses?: { recipientName: string; phone: string; line1: string }[]; daily?: { totalAmount: string; status: string; createdAt: string }[]; lowStock?: { id: number; sku: string; stock: number; color: string; size: string; product: { name: string } }[]; bestSellers?: { productName: string; _sum: { quantity: number } }[] };
export const vnd = (value: string | number | bigint) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : typeof value === "string" ? Number(value) : value)} ₫`;
async function request<T>(body?: Record<string, unknown>, view = "cart"): Promise<T> {
  const response = await fetch(`/api/shop?view=${view}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Không thể kết nối.");
  return result.data as T;
}
export function ShopClient({ view }: { view: "cart" | "checkout" | "orders" | "admin" | "profile" | "favorites" }) {
  const [data, setData] = useState<ShopData | null>(null), [favorites, setFavorites] = useState<{ product: { id: number; name: string; slug: string } }[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD"), [paymentOrder, setPaymentOrder] = useState<number | null>(null);
  const [shipping, setShipping] = useState({ name: "", phone: "", address: "" });
  const [voucherSelection, setVoucherSelection] = useState<VoucherSelection>({ ready: true, quote: null });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "favorites") setFavorites(await request(undefined, view));
      else {
        setData(await request(undefined, view === "checkout" ? "cart" : view));
        if (view === "checkout") {
          const saved = sessionStorage.getItem("aurel-payos-order");
          if (saved && /^[1-9]\d{0,9}$/.test(saved)) setPaymentOrder(Number(saved));
          const profile = await request<ShopData>(undefined, "profile");
          setShipping(current => current.name || current.phone || current.address ? current : { name: profile.fullName ?? "", phone: profile.addresses?.[0]?.phone ?? "", address: profile.addresses?.[0]?.line1 ?? "" });
        }
      }
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(false); }
  }, [view]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  async function mutate(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await request<{ id?: number; orderNumber?: string; paymentMethod?: string }>(input);
      if (input.action === "cart" || result.orderNumber) setVoucherSelection({ ready: true, quote: null });
      if (result.orderNumber) {
        sessionStorage.removeItem("aurel-checkout-key");
        if (result.paymentMethod === "PAYOS" && result.id) {
          try {
            const payment = await paymentRequest(result.id, "create");
            const targetUrl = payosRedirectUrl(payment);
            if (targetUrl) {
              sessionStorage.removeItem("aurel-payos-order");
              window.location.assign(targetUrl);
              return;
            }
          } catch {
            // Fallback to payment retry panel if immediate redirect call fails
          }
          setPaymentOrder(result.id);
          sessionStorage.setItem("aurel-payos-order", String(result.id));
        }
        else setConfirmation(result.orderNumber);
      }
      else setMessage("Đã lưu thành công.");
      await load();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (action === "checkout") {
      if (!voucherSelection.ready) { setMessage("Hãy áp dụng mã giảm giá hoặc chọn Không dùng mã trước khi đặt hàng."); return; }
      const key = sessionStorage.getItem("aurel-checkout-key") ?? crypto.randomUUID();
      sessionStorage.setItem("aurel-checkout-key", key);
      fields.key = key;
      fields.paymentMethod = paymentMethod;
      if (voucherSelection.quote) { fields.voucherCode = voucherSelection.quote.voucherCode ?? ""; fields.expectedTotal = voucherSelection.quote.totalAmount; }
    }
    void mutate({ ...fields, action });
  }
  const items = data?.items ?? [], orders = data?.orders ?? [];
  const total = items.reduce((sum, item) => sum + BigInt(item.price ?? "0") * BigInt(item.quantity), BigInt(0));
  return <div className="shop-panel">
    <nav className="shop-nav"><Link href="/products">Mua sắm</Link><Link href="/cart">Giỏ hàng</Link><Link href="/account/orders">Đơn của tôi</Link><Link href="/account">Hồ sơ</Link><Link href="/favorites">Yêu thích</Link>{view === "admin" && <Link href="/admin/vouchers">Voucher</Link>}{view === "admin" && <Link href="/admin/products">Quản lý sản phẩm</Link>}</nav>
    {message && <p role="status">{message}</p>}
    {confirmation && <div role="status"><h2>Đặt hàng thành công</h2><p>Mã đơn: {confirmation}</p><p>COD DEMO — thanh toán khi nhận hàng, chưa thu tiền.</p><Link href="/account/orders">Theo dõi đơn hàng</Link></div>}
    {paymentOrder && <PayosPayment key={paymentOrder} orderId={paymentOrder} autoCreate/>}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {!loading && !data && view !== "favorites" && <p><Link href="/login">Đăng nhập</Link> hoặc <button onClick={() => { setMessage(""); void load(); }}>Thử lại</button></p>}
    {data && (view === "cart" || view === "checkout") && <>
      {!items.length ? <p>Giỏ hàng đang trống. <Link href="/products">Khám phá sản phẩm</Link></p> : <>
        <div className="shop-scroll"><table><thead><tr><th>Sản phẩm</th><th>Biến thể</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th>Thao tác</th></tr></thead><tbody>{items.map(item => <tr key={item.variantId}><td><Link href={`/products/${item.slug}`}>{item.name}</Link>{(!item.available || !item.price || item.stock < item.quantity) && <p role="alert">Không đủ hàng hoặc giá chưa khả dụng</p>}</td><td>{item.color} / {item.size}</td><td>{item.price ? vnd(item.price) : "Chưa có giá"}</td><td><button aria-label={`Giảm ${item.name}`} disabled={busy} onClick={() => mutate({ action: "cart", variantId: item.variantId, quantity: item.quantity - 1 })}>−</button> {item.quantity} <button aria-label={`Tăng ${item.name}`} disabled={busy || item.quantity >= Math.min(item.stock, 99)} onClick={() => mutate({ action: "cart", variantId: item.variantId, quantity: item.quantity + 1 })}>+</button></td><td>{item.price ? vnd(BigInt(item.price) * BigInt(item.quantity)) : "—"}</td><td><button disabled={busy} onClick={() => mutate({ action: "cart", variantId: item.variantId, quantity: 0 })}>Xóa</button></td></tr>)}</tbody></table></div>
        <p><strong>Tạm tính: {vnd(total)}</strong></p><p>Phí vận chuyển hiện tại: 0 ₫; tổng thanh toán được kiểm tra lại khi đặt.</p>
        {view === "checkout" && <CheckoutVoucher key={items.map(item => `${item.variantId}:${item.quantity}:${item.price}`).join("|")} onChange={setVoucherSelection}/>}
        {view === "cart" ? <Link className="button" href="/checkout">Tiến hành đặt hàng</Link> : <form onSubmit={event => submit(event, "checkout")} className="shop-form"><h2>Thông tin nhận hàng</h2><label>Họ tên<input name="name" value={shipping.name} onChange={event => setShipping({ ...shipping, name: event.target.value })} required minLength={2} maxLength={100} autoComplete="name"/></label><label>Điện thoại<input name="phone" type="tel" inputMode="tel" value={shipping.phone} onChange={event => setShipping({ ...shipping, phone: event.target.value })} required minLength={9} maxLength={20} autoComplete="tel"/></label><label>Địa chỉ nhận hàng<textarea name="address" value={shipping.address} onChange={event => setShipping({ ...shipping, address: event.target.value })} required minLength={10} maxLength={500} autoComplete="street-address"/></label><fieldset className="shop-payment-methods"><legend>Phương thức thanh toán</legend><label><input type="radio" name="payment-choice" value="COD" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")}/> COD DEMO — thanh toán khi nhận hàng</label><label><input type="radio" name="payment-choice" value="PAYOS" checked={paymentMethod === "PAYOS"} onChange={() => setPaymentMethod("PAYOS")}/> Thanh toán trực tuyến — payOS</label></fieldset><p>{paymentMethod === "PAYOS" ? "payOS sử dụng chuyển khoản ngân hàng thật. Kiểm tra kỹ đơn và số tiền trước khi thanh toán." : "Đơn COD demo chưa thu tiền trực tuyến."}</p><label><input type="checkbox" required/> {paymentMethod === "PAYOS" ? "Tôi xác nhận thông tin và đồng ý thanh toán đơn hàng." : "Tôi xác nhận đây là đơn đặt thử của dự án demo."}</label><button className="button" disabled={busy || !voucherSelection.ready || items.some(item => !item.available || !item.price || item.stock < item.quantity)}>{busy ? "Đang xử lý…" : paymentMethod === "PAYOS" ? "Đặt hàng & thanh toán payOS" : "Xác nhận đặt hàng"}</button></form>}
      </>}
    </>}
    {data && view === "profile" && <form key={`${data.fullName}-${data.city}`} className="shop-form" onSubmit={event => submit(event, "profile")}><p>Email: {data.email}</p><label>Họ tên<input name="name" defaultValue={data.fullName} required minLength={2} maxLength={100}/></label><label>Năm sinh<input name="birthYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={data.birthYear ?? ""}/></label><label>Thành phố<input name="city" defaultValue={data.city ?? ""} maxLength={100}/></label><label>Điện thoại nhận hàng<input name="phone" type="tel" inputMode="tel" defaultValue={data.addresses?.[0]?.phone ?? ""} maxLength={20}/></label><label>Địa chỉ mặc định<textarea name="address" defaultValue={data.addresses?.[0]?.line1 ?? ""} maxLength={500}/></label><button className="button" disabled={busy}>Lưu thông tin</button><Link href="/forgot-password">Đổi mật khẩu qua email</Link></form>}
    {view === "favorites" && !loading && <>{!favorites.length && <p>Chưa có sản phẩm yêu thích.</p>}{favorites.map(row => <p key={row.product.id}><Link href={`/products/${row.product.slug}`}>{row.product.name}</Link> <button disabled={busy} onClick={() => mutate({ action: "favorite", slug: row.product.slug, remove: true })}>Bỏ lưu</button></p>)}</>}
    {data && view === "admin" && <section><h2>Báo cáo COD demo</h2><p>Doanh thu quy ước: tổng đơn VND đã hoàn tất, chưa phải đối soát tiền thực thu.</p><div className="shop-stats">{[1, 7, 30].map(days => { const rows = (data.daily ?? []).filter(row => new Date(row.createdAt).getTime() >= Date.now() - days * 86400000); return <p key={days}><strong>{days === 1 ? "24 giờ" : `${days} ngày`} gần nhất</strong><br/>{rows.length} đơn · {vnd(rows.filter(row => row.status === "DELIVERED").reduce((sum, row) => sum + Number(row.totalAmount), 0))} hoàn tất</p>; })}</div><h3>Cảnh báo tồn ≤ 5 (tối đa 100 biến thể)</h3>{!data.lowStock?.length && <p>Không có cảnh báo.</p>}{data.lowStock?.map(row => <p key={row.id}>{row.product.name} · {row.sku} · {row.color}/{row.size}: <strong>{row.stock}</strong></p>)}<h3>Bán chạy từ đơn hoàn tất</h3>{!data.bestSellers?.length && <p>Chưa có đơn hoàn tất.</p>}{data.bestSellers?.map(row => <p key={row.productName}>{row.productName}: {row._sum.quantity}</p>)}</section>}
    {data && (view === "orders" || view === "admin") && <section>
      <h2>{view === "admin" ? "100 đơn gần nhất" : "Đơn hàng của bạn (tối đa 100)"}</h2>
      {!orders.length && <p>Chưa có đơn hàng.</p>}
      {orders.map(order => <article className="shop-order" key={order.id}>
        <h3>{order.orderNumber}</h3>
        <p>{new Date(order.createdAt).toLocaleString("vi-VN")} · <strong>{statusLabels[order.status]}</strong> · {order.currency === "VND" ? vnd(order.totalAmount) : `${order.totalAmount} ${order.currency ?? "chưa xác định tiền tệ"}`}</p>
        <OrderDiscount order={order}/>
        <details><summary>Chi tiết / địa chỉ nhận hàng</summary><p>{order.shippingName} · {order.shippingPhone}<br/>{order.shippingAddress}</p>
          {order.items.map(item => <p key={item.sku}>{item.productName} · {item.color}/{item.size} · SL {item.quantity} · {order.currency === "VND" ? vnd(item.unitPrice) : item.unitPrice}</p>)}
          {order.orderNumber.startsWith("DEMO-") && <p>{order.payment ? "payOS" : "COD DEMO, chưa đối soát thanh toán"}; phí vận chuyển 0 ₫.</p>}
        </details>
        <div className="shop-actions">
          {order.orderNumber.startsWith("DEMO-") && Object.entries(statusLabels).filter(([status]) => {
            if (!canTransition(order.status, status, view === "admin")) return false;
            if (!order.payment) return true;
            return status === "CANCELLED" ? !order.payment.paidAt && !order.payment.reconciliationRequired && !order.payment.attempts.some(attempt => attempt.status === "PENDING" || attempt.status === "PROCESSING") : !!order.payment.paidAt && !order.payment.reconciliationRequired;
          }).map(([status, label]) => <button key={status} disabled={busy} onClick={() => { if (window.confirm(`Chuyển đơn sang “${label}”?`)) void mutate({ action: "status", id: order.id, expected: order.status, status }); }}>{label}</button>)}
          {view === "admin" && <Link href={`/admin/orders/${order.id}/print`} target="_blank">In phiếu đóng gói</Link>}
        </div>
      </article>)}
    </section>}
  </div>;
}

function OrderDiscount({ order }: { order: Order }) {
  const payment = order.payment, latest = payment?.attempts.find(attempt => attempt.status === "PAID") ?? payment?.attempts[0];
  return <>
    {payment && <div><p>Phương thức: payOS · {paymentLabels[payment.paidAt ? "PAID" : latest?.status ?? "PROCESSING"]}</p>{payment.paidAt && <p>Ngày thanh toán: {new Date(payment.paidAt).toLocaleString("vi-VN")} · Số tiền nhận: {latest?.paidAmount ? vnd(latest.paidAmount) : "Xem lần thanh toán trước"}</p>}{latest?.paymentLinkId && <p>Mã thanh toán: {latest.paymentLinkId}<br/>Tham chiếu: {latest.reference ?? "Chưa có"}</p>}{payment.reconciliationRequired && <p role="alert">Cần đối soát trước khi giao hàng/hoàn tiền.</p>}{order.status === "PENDING" && !payment.paidAt && <Link href={`/checkout/success?order=${order.id}`}>Tiếp tục / Kiểm tra thanh toán payOS</Link>}</div>}
    {order.voucherCode && <p>Mã giảm giá: {order.voucherCode}<br/>Tiền hàng: {vnd(order.subtotalAmount ?? order.totalAmount)} · Giảm: −{vnd(order.discountAmount)} · Phải trả: {vnd(order.totalAmount)}</p>}
    {payment?.attempts.some(attempt => attempt.receipts?.length) && <details><summary>Giao dịch đã ghi nhận</summary>{payment.attempts.flatMap(attempt => attempt.receipts ?? []).map(receipt => <p key={receipt.reference}>{receipt.reference} · {vnd(receipt.amount)} · {new Date(receipt.receivedAt).toLocaleString("vi-VN")}</p>)}</details>}
  </>;
}
