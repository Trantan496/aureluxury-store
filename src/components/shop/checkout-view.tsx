"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  HouseIcon,
  ChevronRightIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  TagIcon,
  CashIcon,
  CreditCardIcon,
  PencilIcon,
  ShoppingBagIcon,
  TruckIcon,
  InfoIcon,
  CheckIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "@/components/account/account-icons";
import { PayosPayment, paymentRequest } from "./payos-payment";
import { payosRedirectUrl } from "@/features/payments/rules";
import type { VoucherQuote } from "./checkout-voucher";
import styles from "./checkout.module.css";

export type CheckoutCartItem = {
  id?: number;
  variantId: number;
  quantity: number;
  name: string;
  slug: string;
  color: string;
  size: string;
  stock: number;
  price: string | null;
  available: boolean;
  image?: string | null;
};

type ShippingInfo = {
  name: string;
  phone: string;
  address: string;
};

const formatVND = (value: string | number | bigint) => {
  const num =
    typeof value === "string" && /^\d+$/.test(value)
      ? BigInt(value)
      : typeof value === "string"
        ? Number(value)
        : value;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(num)} ₫`;
};

// Preview data matching the reference screenshot in dev / preview mode
const PREVIEW_ITEMS: CheckoutCartItem[] = [
  {
    variantId: 101,
    quantity: 1,
    name: "Áo khoác cardigan len Merino pha Cotton",
    slug: "ao-khoac-cardigan-len-merino-pha-cotton",
    color: "Beige",
    size: "M",
    stock: 10,
    price: "320000",
    available: true,
    image: "/images/aurel/collection-demo/knit.png",
  },
  {
    variantId: 102,
    quantity: 1,
    name: "AUREL Cozy Bow Fleece Jacket – Ivory Cream",
    slug: "aurel-cozy-bow-fleece-jacket-ivory-cream",
    color: "Beige",
    size: "M",
    stock: 10,
    price: "400000",
    available: true,
    image: "/images/aurel/collection-demo/coat.png",
  },
];

export function CheckoutView({
  initialPreview = false,
}: {
  initialPreview?: boolean;
}) {
  const [items, setItems] = useState<CheckoutCartItem[]>([]);
  const [shipping, setShipping] = useState<ShippingInfo>({
    name: "",
    phone: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "PAYOS">("COD");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherQuote, setVoucherQuote] = useState<VoucherQuote | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [orderNote, setOrderNote] = useState("");
  const [demoAgreed, setDemoAgreed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<number | null>(null);
  const [redirectingPayos, setRedirectingPayos] = useState(false);
  const [isPreview, setIsPreview] = useState(initialPreview);
  const [buyNowVariantId, setBuyNowVariantId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Check url preview flag
      const params = new URLSearchParams(window.location.search);
      const urlPreview = params.get("preview") === "1";
      const rawVariantId = params.get("variantId");
      const scopedVariantId = rawVariantId && /^[1-9]\d*$/.test(rawVariantId) ? Number(rawVariantId) : null;
      setBuyNowVariantId(scopedVariantId);

      const rawItems = params.get("items");
      let selectedIds: number[] | null = null;
      if (rawItems) {
        selectedIds = rawItems.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0);
      } else {
        try {
          const stored = sessionStorage.getItem("aurel-selected-items");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              selectedIds = parsed.map(Number).filter(n => Number.isInteger(n) && n > 0);
            }
          }
        } catch {
          // ignore storage error
        }
      }

      const [cartRes, profileRes] = await Promise.allSettled([
        fetch(scopedVariantId ? `/api/shop?view=buy-now&variantId=${encodeURIComponent(scopedVariantId)}` : "/api/shop?view=cart", { cache: "no-store" }).then(async (r) => {
          if (!r.ok) throw new Error("Chưa thể tải giỏ hàng.");
          return r.json();
        }),
        fetch("/api/shop?view=profile", { cache: "no-store" }).then(async (r) => {
          if (!r.ok) return null;
          return r.json();
        }),
      ]);

      let loadedItems: CheckoutCartItem[] = [];
      if (cartRes.status === "fulfilled" && cartRes.value?.data?.items) {
        loadedItems = cartRes.value.data.items;
      }

      if (selectedIds && selectedIds.length > 0) {
        const filtered = loadedItems.filter(item => selectedIds!.includes(item.variantId));
        if (filtered.length > 0) loadedItems = filtered;
      }

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        const p = profileRes.value.data;
        setShipping((cur) => ({
          name: cur.name || p.fullName || "",
          phone: cur.phone || p.addresses?.[0]?.phone || "",
          address: cur.address || p.addresses?.[0]?.line1 || "",
        }));
      }

      if ((urlPreview || initialPreview) && loadedItems.length === 0) {
        setIsPreview(true);
        const sampleItems = selectedIds && selectedIds.length > 0
          ? PREVIEW_ITEMS.filter(i => selectedIds!.includes(i.variantId))
          : PREVIEW_ITEMS;
        setItems(sampleItems.length > 0 ? sampleItems : PREVIEW_ITEMS);
        setShipping((cur) => ({
          name: cur.name || "Trần Ngọc Tân",
          phone: cur.phone || "",
          address: cur.address || "",
        }));
      } else {
        setItems(loadedItems);
      }

      // Check if payos order exists
      const savedPayos = sessionStorage.getItem("aurel-payos-order");
      if (savedPayos && /^[1-9]\d{0,9}$/.test(savedPayos)) {
        setPaymentOrder(Number(savedPayos));
      }
    } catch (err) {
      if (initialPreview) {
        setIsPreview(true);
        setItems(PREVIEW_ITEMS);
        setShipping((cur) => ({
          name: cur.name || "Trần Ngọc Tân",
          phone: cur.phone || "",
          address: cur.address || "",
        }));
      } else {
        setError((err as Error).message || "Không thể kết nối.");
      }
    } finally {
      setLoading(false);
    }
  }, [initialPreview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.price ?? "0") * BigInt(item.quantity),
    BigInt(0)
  );

  const discountAmount = voucherQuote ? BigInt(voucherQuote.discountAmount) : BigInt(0);
  const finalTotal = voucherQuote ? BigInt(voucherQuote.totalAmount) : subtotal;

  async function handleApplyVoucher(e: React.FormEvent) {
    e.preventDefault();
    const code = voucherCode.trim();
    if (!code) {
      setVoucherQuote(null);
      setVoucherMessage(null);
      return;
    }
    setBusy(true);
    setVoucherMessage(null);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "voucher-quote",
          code,
          ...(buyNowVariantId ? { buyNowVariantId } : {}),
          ...(items.length > 0 && !buyNowVariantId ? { selectedVariantIds: items.map(i => i.variantId) } : {}),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Mã giảm giá không hợp lệ.");
      const quote = result.data as VoucherQuote;
      setVoucherQuote(quote);
      setVoucherMessage({
        text: `Đã áp dụng mã "${quote.voucherCode}". Giảm ${formatVND(quote.discountAmount)}.`,
        isError: false,
      });
    } catch (err) {
      setVoucherQuote(null);
      setVoucherMessage({
        text: (err as Error).message || "Không thể áp dụng mã.",
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveVoucher() {
    setVoucherCode("");
    setVoucherQuote(null);
    setVoucherMessage(null);
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!shipping.name.trim() || shipping.name.trim().length < 2) {
      setError("Vui lòng nhập họ tên nhận hàng (tối thiểu 2 ký tự).");
      return;
    }
    if (!shipping.phone.trim() || !/^\+?[0-9 ()-]{9,20}$/.test(shipping.phone.trim())) {
      setError("Vui lòng nhập số điện thoại hợp lệ (9–20 chữ số).");
      return;
    }
    if (!shipping.address.trim() || shipping.address.trim().length < 10) {
      setError("Vui lòng nhập địa chỉ nhận hàng chi tiết (tối thiểu 10 ký tự).");
      return;
    }
    if (!demoAgreed) {
      setError("Vui lòng xác nhận thỏa thuận đơn hàng trước khi tiếp tục.");
      return;
    }

    if (isPreview) {
      // Mock order completion in preview mode
      setConfirmation("DEMO-PREVIEW-9988");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const checkoutKeyName = buyNowVariantId ? `aurel-checkout-key:buy-now:${buyNowVariantId}` : "aurel-checkout-key:cart";
      const key = sessionStorage.getItem(checkoutKeyName) ?? crypto.randomUUID();
      sessionStorage.setItem(checkoutKeyName, key);

      const payload: Record<string, unknown> = {
        action: "checkout",
        name: shipping.name.trim(),
        phone: shipping.phone.trim(),
        address: shipping.address.trim(),
        paymentMethod,
        key,
        ...(buyNowVariantId ? { buyNowVariantId } : {}),
        ...(items.length > 0 && !buyNowVariantId ? { selectedVariantIds: items.map(i => i.variantId) } : {}),
      };

      if (voucherQuote) {
        payload.voucherCode = voucherQuote.voucherCode ?? "";
        payload.expectedTotal = voucherQuote.totalAmount;
      } else {
        payload.expectedTotal = subtotal.toString();
      }

      const res = await fetch("/api/shop?view=cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Không thể tạo đơn hàng.");

      sessionStorage.removeItem(checkoutKeyName);

      if (paymentMethod === "PAYOS" && result.data?.id) {
        const orderId = Number(result.data.id);
        setRedirectingPayos(true);
        try {
          const payment = await paymentRequest(orderId, "create");
          const targetUrl = payosRedirectUrl(payment);
          if (targetUrl) {
            try {
              sessionStorage.removeItem("aurel-payos-order");
              if (!buyNowVariantId) sessionStorage.removeItem("aurel-selected-items");
            } catch {
              // ignore storage error
            }
            window.location.assign(targetUrl);
            return;
          }
        } catch (payosErr) {
          setError((payosErr as Error).message || "Chưa thể chuyển hướng sang payOS.");
        } finally {
          setRedirectingPayos(false);
        }
        setPaymentOrder(orderId);
        sessionStorage.setItem("aurel-payos-order", String(orderId));
      } else {
        setConfirmation(result.data?.orderNumber ?? "Thành công");
      }
    } catch (err) {
      setError((err as Error).message || "Không thể hoàn tất đặt hàng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>
            <HouseIcon className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRightIcon className={styles.breadcrumbSeparator} />
          <Link href="/cart" className={styles.breadcrumbLink}>
            <span>Giỏ hàng</span>
          </Link>
          <ChevronRightIcon className={styles.breadcrumbSeparator} />
          <span className={styles.breadcrumbCurrent}>Thanh toán</span>
        </nav>

        {/* Header */}
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Thanh toán</h1>
          <p className={styles.pageSubtitle}>
            Hoàn tất thông tin để đặt hàng và nhận sản phẩm từ AUREL.
          </p>
        </header>

        {/* Stepper */}
        <div className={styles.stepperRow} aria-label="Tiến trình đặt hàng">
          <div className={styles.stepItem}>
            <div className={styles.stepCircleCompleted}>
              <CheckIcon className="w-3.5 h-3.5" />
            </div>
            <span className={styles.stepLabelCompleted}>Giỏ hàng</span>
          </div>

          <div className={styles.stepDivider} />

          <div className={styles.stepItem}>
            <div className={styles.stepCircleActive}>2</div>
            <span className={styles.stepLabelActive}>Thanh toán</span>
          </div>

          <div className={styles.stepDivider} />

          <div className={styles.stepItem}>
            <div className={styles.stepCircleUpcoming}>3</div>
            <span className={styles.stepLabelUpcoming}>Hoàn tất</span>
          </div>
        </div>

        {/* Status Error Message */}
        {error && (
          <div role="alert" className={`${styles.statusMessage} ${styles.statusError}`}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className={styles.emptyStateCard}>
            <ShoppingBagIcon className={styles.emptyStateIcon} />
            <h2 className={styles.emptyStateTitle}>Giỏ hàng của bạn đang trống</h2>
            <p className={styles.emptyStateSubtitle}>
              Hãy chọn những trang phục yêu thích để tiến hành thanh toán.
            </p>
            <Link href="/products" className={styles.primaryAction}>
              Khám phá bộ sưu tập →
            </Link>
          </div>
        )}

        {/* Main Content Form */}
        {items.length > 0 && (
          <form onSubmit={handleSubmitOrder}>
            <div className={styles.checkoutGrid}>
              {/* Left Column */}
              <div className={styles.leftColumn}>
                {/* 1. Thông tin nhận hàng */}
                <section className={styles.card} aria-labelledby="shipping-heading">
                  <div className={styles.cardHeader}>
                    <UserIcon className={styles.cardIcon} />
                    <h2 id="shipping-heading" className={styles.cardTitle}>
                      Thông tin nhận hàng
                    </h2>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="shipping-name" className={styles.fieldLabel}>
                      Họ tên <span className={styles.fieldRequired}>*</span>
                    </label>
                    <div className={styles.inputWrapper}>
                      <UserIcon className={styles.fieldIcon} />
                      <input
                        id="shipping-name"
                        name="name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={shipping.name}
                        onChange={(e) =>
                          setShipping({ ...shipping, name: e.target.value })
                        }
                        placeholder="Nhập họ và tên"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="shipping-phone" className={styles.fieldLabel}>
                      Điện thoại <span className={styles.fieldRequired}>*</span>
                    </label>
                    <div className={styles.inputWrapper}>
                      <PhoneIcon className={styles.fieldIcon} />
                      <input
                        id="shipping-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        required
                        minLength={9}
                        maxLength={20}
                        value={shipping.phone}
                        onChange={(e) =>
                          setShipping({ ...shipping, phone: e.target.value })
                        }
                        placeholder="Nhập số điện thoại"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="shipping-address" className={styles.fieldLabel}>
                      Địa chỉ nhận hàng <span className={styles.fieldRequired}>*</span>
                    </label>
                    <div className={styles.textareaWrapper}>
                      <MapPinIcon className={styles.textareaFieldIcon} />
                      <textarea
                        id="shipping-address"
                        name="address"
                        required
                        minLength={10}
                        maxLength={500}
                        rows={2}
                        value={shipping.address}
                        onChange={(e) =>
                          setShipping({ ...shipping, address: e.target.value })
                        }
                        placeholder="Nhập địa chỉ nhận hàng"
                        className={styles.textarea}
                      />
                    </div>
                  </div>
                </section>

                {/* 2. Mã giảm giá */}
                <section className={styles.card} aria-labelledby="voucher-heading">
                  <div className={styles.cardHeader}>
                    <TagIcon className={styles.cardIcon} />
                    <h2 id="voucher-heading" className={styles.cardTitle}>
                      Mã giảm giá
                    </h2>
                  </div>

                  <div className={styles.voucherRow}>
                    <div className={styles.inputWrapper} style={{ flex: 1 }}>
                      <TagIcon className={styles.fieldIcon} />
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Nhập mã voucher"
                        className={styles.input}
                        maxLength={32}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={busy || !voucherCode.trim()}
                      className={styles.applyButton}
                    >
                      {busy ? "Đang xử lý…" : "Áp dụng"}
                    </button>
                  </div>

                  {voucherMessage && (
                    <div className={styles.voucherFeedback}>
                      <span
                        className={
                          voucherMessage.isError
                            ? styles.voucherError
                            : styles.voucherSuccess
                        }
                      >
                        {voucherMessage.text}
                      </span>
                      {voucherQuote && (
                        <button
                          type="button"
                          onClick={handleRemoveVoucher}
                          className={styles.removeVoucherButton}
                        >
                          Bỏ mã
                        </button>
                      )}
                    </div>
                  )}
                </section>

                {/* 3. Phương thức thanh toán */}
                <section className={styles.card} aria-labelledby="payment-heading">
                  <div className={styles.cardHeader}>
                    <CreditCardIcon className={styles.cardIcon} />
                    <h2 id="payment-heading" className={styles.cardTitle}>
                      Phương thức thanh toán
                    </h2>
                  </div>

                  <div className={styles.paymentOptions}>
                    {/* COD Option */}
                    <div
                      className={`${styles.paymentOption} ${
                        paymentMethod === "COD" ? styles.paymentOptionActive : ""
                      }`}
                      onClick={() => setPaymentMethod("COD")}
                      role="radio"
                      aria-checked={paymentMethod === "COD"}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          setPaymentMethod("COD");
                        }
                      }}
                    >
                      <div
                        className={`${styles.radioOuter} ${
                          paymentMethod === "COD" ? styles.radioOuterActive : ""
                        }`}
                      >
                        {paymentMethod === "COD" && <div className={styles.radioInner} />}
                      </div>
                      <div className={styles.paymentIconBox}>
                        <CashIcon className="w-5 h-5" />
                      </div>
                      <div className={styles.paymentInfo}>
                        <p className={styles.paymentTitle}>
                          Thanh toán khi nhận hàng (COD)
                        </p>
                        <p className={styles.paymentDesc}>
                          Thanh toán bằng tiền mặt khi nhận hàng.
                        </p>
                      </div>
                    </div>

                    {/* payOS Option */}
                    <div
                      className={`${styles.paymentOption} ${
                        paymentMethod === "PAYOS" ? styles.paymentOptionActive : ""
                      }`}
                      onClick={() => setPaymentMethod("PAYOS")}
                      role="radio"
                      aria-checked={paymentMethod === "PAYOS"}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          setPaymentMethod("PAYOS");
                        }
                      }}
                    >
                      <div
                        className={`${styles.radioOuter} ${
                          paymentMethod === "PAYOS" ? styles.radioOuterActive : ""
                        }`}
                      >
                        {paymentMethod === "PAYOS" && (
                          <div className={styles.radioInner} />
                        )}
                      </div>
                      <div className={styles.paymentIconBox}>
                        <CreditCardIcon className="w-5 h-5" />
                      </div>
                      <div className={styles.paymentInfo}>
                        <p className={styles.paymentTitle}>
                          Thanh toán trực tuyến — payOS
                        </p>
                        <p className={styles.paymentDesc}>
                          Thanh toán nhanh, an toàn và bảo mật.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. Ghi chú đơn hàng */}
                <section className={styles.card} aria-labelledby="notes-heading">
                  <div className={styles.cardHeader}>
                    <PencilIcon className={styles.cardIcon} />
                    <h2 id="notes-heading" className={styles.cardTitle}>
                      Ghi chú đơn hàng (không bắt buộc)
                    </h2>
                  </div>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao, ..."
                    className={styles.notesTextarea}
                  />
                </section>
              </div>

              {/* Right Column: Order Summary */}
              <div className={styles.rightColumn}>
                <aside className={styles.orderSummaryCard} aria-label="Tóm tắt đơn hàng">
                  <div className={styles.cardHeader}>
                    <ShoppingBagIcon className={styles.cardIcon} />
                    <h2 className={styles.cardTitle}>
                      Đơn hàng của bạn ({items.length} sản phẩm)
                    </h2>
                  </div>

                  {/* Items List */}
                  <div className={styles.orderItemsList}>
                    {items.map((item) => (
                      <div key={item.variantId} className={styles.orderItem}>
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={64}
                            height={64}
                            className={styles.itemThumbnail}
                            unoptimized={item.image.startsWith("/images/uploads/")}
                          />
                        ) : (
                          <div
                            className={`${styles.itemThumbnail} flex items-center justify-center text-stone-400`}
                          >
                            <ShoppingBagIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemName}>{item.name}</h3>
                          <p className={styles.itemMeta}>
                            {item.color} / {item.size}
                          </p>
                        </div>
                        <div className={styles.itemQuantityPrice}>
                          <p className={styles.itemQuantity}>×{item.quantity}</p>
                          <p className={styles.itemPrice}>
                            {item.price
                              ? formatVND(BigInt(item.price) * BigInt(item.quantity))
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.calcDivider} />

                  {/* Pricing Breakdown */}
                  <div className={styles.calcRow}>
                    <span>Tạm tính</span>
                    <span className={styles.calcValue}>{formatVND(subtotal)}</span>
                  </div>

                  <div className={styles.calcRow}>
                    <span className={styles.calcLabelWithIcon}>
                      Phí vận chuyển <InfoIcon className="w-3.5 h-3.5 text-stone-400" />
                    </span>
                    <span className={styles.calcValue}>0 ₫</span>
                  </div>

                  {voucherQuote && (
                    <div className={`${styles.calcRow} ${styles.discountRow}`}>
                      <span>Mã giảm giá ({voucherQuote.voucherCode})</span>
                      <span className={styles.discountValue}>
                        −{formatVND(discountAmount)}
                      </span>
                    </div>
                  )}

                  {/* Total Amount Box */}
                  <div className={styles.totalBox}>
                    <span className={styles.totalLabel}>Tổng thanh toán</span>
                    <span className={styles.totalAmount}>{formatVND(finalTotal)}</span>
                  </div>

                  {/* Free Shipping Box */}
                  <div className={styles.freeShippingBox}>
                    <TruckIcon className={styles.shippingIcon} />
                    <div>
                      <p className={styles.freeShippingTitle}>Miễn phí vận chuyển</p>
                      <p className={styles.freeShippingDesc}>
                        Đơn hàng của bạn được miễn phí vận chuyển.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className={styles.bottomActionBar}>
              <label className={styles.agreementLabel}>
                <div
                  className={`${styles.customCheckbox} ${
                    demoAgreed ? styles.customCheckboxChecked : ""
                  }`}
                  onClick={() => setDemoAgreed(!demoAgreed)}
                  role="checkbox"
                  aria-checked={demoAgreed}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      setDemoAgreed(!demoAgreed);
                    }
                  }}
                >
                  {demoAgreed && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <span>
                  {paymentMethod === "PAYOS"
                    ? "Tôi xác nhận thông tin và đồng ý thanh toán qua cổng payOS."
                    : "Tôi xác nhận đây là đơn đặt thử của dự án demo."}
                </span>
              </label>

              <button
                type="submit"
                disabled={busy || !demoAgreed}
                className={styles.submitButton}
              >
                <span>
                  {busy
                    ? redirectingPayos
                      ? "Đang chuyển hướng sang payOS…"
                      : "Đang xử lý…"
                    : paymentMethod === "PAYOS"
                      ? "Đặt hàng & thanh toán payOS"
                      : "Xác nhận đặt hàng"}
                </span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* COD Order Confirmation Modal */}
        {confirmation && (
          <div className={styles.modalBackdrop}>
            <div className={styles.successModal}>
              <div className={styles.successIconCircle}>
                <CheckCircleIcon className="w-8 h-8" />
              </div>
              <h2 className={styles.successTitle}>Đặt hàng thành công</h2>
              <div className={styles.orderNumberBadge}>Mã đơn: #{confirmation}</div>
              <p className={styles.successDesc}>
                Cảm ơn bạn đã lựa chọn AUREL. Đơn hàng của bạn đang được xử lý theo hình
                thức thanh toán khi nhận hàng (COD).
              </p>
              <div className={styles.successActions}>
                <Link href="/account/orders" className={styles.primaryAction}>
                  Theo dõi đơn hàng
                </Link>
                <Link href="/products" className={styles.secondaryAction}>
                  Tiếp tục mua sắm
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* payOS Payment Overlay */}
        {paymentOrder && (
          <div className={styles.modalBackdrop}>
            <div
              className={styles.successModal}
              style={{ maxWidth: "640px", textAlign: "left" }}
            >
              <PayosPayment orderId={paymentOrder} autoCreate />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
