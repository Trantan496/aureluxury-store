"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { paymentBankName, paymentLabels, payosRedirectUrl, pendingPayment, type PaymentView } from "@/features/payments/rules";
import styles from "./payos-payment.module.css";

export async function paymentRequest(orderId: number, action?: "create" | "reconcile" | "cancel", signal?: AbortSignal): Promise<PaymentView> {
  const response = await fetch(action === "create" ? "/api/payos/create" : `/api/payos/status?order=${orderId}`, { cache: "no-store", signal, ...(action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action }) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Chưa thể kết nối thanh toán.");
  return result.data;
}
export function PayosPayment({ orderId, autoCreate = false, returnMode }: { orderId: number; autoCreate?: boolean; returnMode?: "success" | "cancel" }) {
  const [payment, setPayment] = useState<PaymentView | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(async (action?: "create" | "reconcile" | "cancel", signal?: AbortSignal) => {
    const data = await paymentRequest(orderId, action, signal); setPayment(data); return data;
  }, [orderId]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let interval = 5000, lastReconcile = 0, terminal = false;
    const reconcileCadence = returnMode === "success" ? 32000 : 60000;
    async function poll(first = false) {
      if (controller.signal.aborted) return;
      if (document.hidden) { timer = setTimeout(() => void poll(first), 10000); return; }
      try {
        const data = await refresh(first && autoCreate && generation === 0 ? "create" : first && returnMode ? "reconcile" : Date.now() - lastReconcile > reconcileCadence && !first ? "reconcile" : undefined, controller.signal);
        if (first || Date.now() - lastReconcile > reconcileCadence) lastReconcile = Date.now();
        if (returnMode || data.status === "PAID") {
          try { sessionStorage.removeItem("aurel-payos-order"); } catch { /* ignore storage errors */ }
        }
        if (!returnMode && first && autoCreate) {
          const targetUrl = payosRedirectUrl(data);
          if (targetUrl) {
            try { sessionStorage.removeItem("aurel-payos-order"); } catch { /* ignore storage errors */ }
            window.location.assign(targetUrl);
            return;
          }
        }
        terminal = !pendingPayment(data.status); setMessage("");
      } catch (error) { if (!controller.signal.aborted) setMessage((error as Error).message); }
      if (!terminal && !controller.signal.aborted) { timer = setTimeout(() => void poll(), interval); interval = Math.min(interval + 2500, 15000); }
    }
    timer = setTimeout(() => void poll(true), 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [autoCreate, generation, refresh, returnMode]);
  useEffect(() => { if (!payment || !pendingPayment(payment.status)) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [payment]);
  async function run(action: "create" | "reconcile" | "cancel") {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const data = await refresh(action);
      if (action === "create") {
        const targetUrl = payosRedirectUrl(data);
        if (targetUrl && !returnMode) {
          try { sessionStorage.removeItem("aurel-payos-order"); } catch { /* ignore storage errors */ }
          window.location.assign(targetUrl);
          return;
        }
        if (pendingPayment(data.status)) setGeneration(value => value + 1);
      }
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Đã sao chép."); } catch { setMessage("Không thể sao chép tự động. Hãy chọn và sao chép nội dung bên dưới."); }
  }
  const remaining = payment?.expiresAt && now !== null ? Math.max(0, Math.ceil((new Date(payment.expiresAt).getTime() - now) / 1000)) : null;
  const paid = payment?.status === "PAID", active = payment && pendingPayment(payment.status);
  return <section className={styles.card} aria-label="Thanh toán payOS">
    <p className={styles.brand}>AUREL · PAYOS</p>
    <h2>{paid ? payment.reconciliationRequired ? "Đã nhận tiền · Cần đối soát" : "Thanh toán đã được xác nhận" : returnMode === "success" ? "Đang xác nhận thanh toán…" : returnMode === "cancel" ? "Bạn đã quay lại từ trang thanh toán" : "Thanh toán trực tuyến"}</h2>
    <p role="status" aria-live="polite">{payment ? paymentLabels[payment.status] : "Đang tải thông tin thanh toán…"}</p>
    {returnMode === "cancel" && !paid && <p>Quay lại website chưa hủy đơn hàng. Bạn có thể tiếp tục thanh toán hoặc hủy phiên payOS bên dưới.</p>}
    {payment && <><p>Đơn {payment.orderNumber} · <strong>{new Intl.NumberFormat("vi-VN").format(BigInt(payment.amount))} VND</strong></p>
      {payment.reconciliationRequired && <p role="alert">AUREL đang đối soát khoản tiền này. Vui lòng chưa chuyển thêm tiền.</p>}
      {active && !payment.reconciliationRequired && <div className={styles.layout}>
        {payment.qrImage && <div className={styles.qr}>{/* Local data URL: do not send payment payload to an image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.qrImage} alt="Mã VietQR thanh toán đúng đơn AUREL" width={320} height={320}/></div>}
        <div className={styles.details}><p>Mở ứng dụng ngân hàng và quét mã. Nếu đang dùng một điện thoại, mở trang payOS để chọn cách thanh toán phù hợp.</p>
          <dl><dt>Ngân hàng</dt><dd>{paymentBankName(payment.bankBin)}</dd><dt>Chủ tài khoản</dt><dd>{payment.accountName ?? "Xem trên trang payOS"}</dd><dt>Số tài khoản</dt><dd>{payment.accountNumber ?? "Xem trên trang payOS"}{payment.accountNumber && <button type="button" onClick={() => void copy(payment.accountNumber!)}>Sao chép</button>}</dd><dt>Số tiền chính xác</dt><dd>{payment.amount} VND <button type="button" onClick={() => void copy(payment.amount)}>Sao chép</button></dd><dt>Nội dung chuyển khoản</dt><dd>{payment.description}<button type="button" onClick={() => void copy(payment.description ?? "")}>Sao chép</button></dd></dl>
          {remaining !== null && <p>{remaining > 0 ? `Thời gian còn lại: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Đã đến hạn phiên. Đang chờ payOS xác nhận trạng thái; chưa chuyển thêm tiền."}</p>}
          {payment.checkoutUrl && <a className={styles.hosted} href={payment.checkoutUrl}>Mở trang thanh toán payOS ↗</a>}
        </div></div>}
      {paid && <><p>Ngày xác nhận: {payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "Đang cập nhật"}</p><ul>{payment.items.map((item, index) => <li key={index}>{item.productName} · {item.color}/{item.size} · Số lượng {item.quantity}</li>)}</ul><p>Giao đến: {payment.shippingName}<br/>{payment.shippingAddress}</p></>}
      {!paid && payment.orderStatus === "PENDING" && <div className={styles.actions}>{!payment.reconciliationRequired && <button disabled={busy} type="button" onClick={() => void run("create")}>{active ? "Thử lại / Tải phiên thanh toán" : "Tạo phiên thanh toán mới"}</button>}<button disabled={busy} type="button" onClick={() => void run("reconcile")}>Kiểm tra thanh toán</button>{active && <button disabled={busy} type="button" onClick={() => void run("cancel")}>Hủy phiên payOS</button>}</div>}
    </>}
    {!payment && <button disabled={busy} type="button" onClick={() => void run(autoCreate ? "create" : "reconcile")}>Thử lại</button>}
    {message && <p role="status">{message}</p>}
    <div className={styles.actions}><Link href="/account/orders">Xem đơn hàng</Link><Link href="/checkout">Quay lại checkout</Link><Link href="/products">Tiếp tục mua sắm</Link></div>
  </section>;
}
