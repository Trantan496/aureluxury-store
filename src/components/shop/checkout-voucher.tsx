"use client";
import { useState } from "react";
export type VoucherQuote = { subtotalAmount: string; discountAmount: string; totalAmount: string; voucherCode: string | null };
export type VoucherSelection = { ready: boolean; quote: VoucherQuote | null };
const amount = (value: string) => `${new Intl.NumberFormat("vi-VN").format(BigInt(value))} ₫`;
export function CheckoutVoucher({ onChange }: { onChange: (value: VoucherSelection) => void }) {
  const [code, setCode] = useState(""), [quote, setQuote] = useState<VoucherQuote | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  function remove() { setCode(""); setQuote(null); setMessage(""); onChange({ ready: true, quote: null }); }
  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (!code.trim()) { remove(); return; }
    setBusy(true); setMessage(""); onChange({ ready: false, quote: null });
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "voucher-quote", code: code.trim() }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Không thể áp dụng mã.");
      const next = result.data as VoucherQuote;
      setCode(next.voucherCode ?? ""); setQuote(next); onChange({ ready: true, quote: next }); setMessage("Đã áp dụng mã. Lượt dùng được kiểm tra lại khi đặt hàng.");
    } catch (error) { setQuote(null); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section aria-label="Mã giảm giá"><form className="shop-form" onSubmit={apply}><label>Mã giảm giá<input value={code} maxLength={32} autoCapitalize="characters" autoComplete="off" disabled={busy} onChange={event => { setCode(event.target.value); setQuote(null); setMessage(""); onChange({ ready: event.target.value.trim() === "", quote: null }); }} placeholder="Nhập mã voucher"/></label><div className="shop-actions"><button type="submit" disabled={busy}>{busy ? "Đang kiểm tra…" : "Áp dụng mã"}</button><button type="button" disabled={busy} onClick={remove}>Không dùng mã</button></div></form>{message && <p role="status">{message}</p>}{quote && <dl className="shop-totals"><dt>Tiền hàng</dt><dd>{amount(quote.subtotalAmount)}</dd><dt>Giảm giá ({quote.voucherCode})</dt><dd>−{amount(quote.discountAmount)}</dd><dt>Tổng phải trả</dt><dd><strong>{amount(quote.totalAmount)}</strong></dd></dl>}</section>;
}
