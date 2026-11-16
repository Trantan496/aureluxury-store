"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  HouseIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
  TruckIcon,
  InfoIcon,
  TrashIcon,
  ArrowRightIcon,
  LockIcon,
  RotateCcwIcon,
  CheckIcon,
} from "@/components/account/account-icons";
import styles from "./cart.module.css";
import type { CheckoutCartItem } from "./checkout-view";

const formatVND = (value: string | number | bigint) => {
  const num =
    typeof value === "string" && /^\d+$/.test(value)
      ? BigInt(value)
      : typeof value === "string"
        ? Number(value)
        : value;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(num)} ₫`;
};

// Preview data with 2 items (Item A and Item B) matching the user's scenario
const PREVIEW_CART_ITEMS: CheckoutCartItem[] = [
  {
    variantId: 102,
    quantity: 1,
    name: "AUREL Cozy Bow Fleece Jacket – Ivory Cream",
    slug: "aurel-cozy-bow-fleece-jacket-ivory-cream",
    color: "beige",
    size: "M",
    stock: 10,
    price: "400000",
    available: true,
    image: "/images/aurel/collection-demo/coat.png",
  },
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
];

export function CartView({
  initialPreview = false,
  embedded = false,
}: {
  initialPreview?: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CheckoutCartItem[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPreview, setIsPreview] = useState(initialPreview);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPreview = params.get("preview") === "1";

      const res = await fetch("/api/shop?view=cart", { cache: "no-store" });
      const result = await res.json();

      let loadedItems: CheckoutCartItem[] = [];
      if (res.ok && result?.data?.items) {
        loadedItems = result.data.items;
      }

      if ((urlPreview || initialPreview) && loadedItems.length === 0) {
        setIsPreview(true);
        setItems(PREVIEW_CART_ITEMS);
        setSelectedVariantIds(PREVIEW_CART_ITEMS.map((i) => i.variantId));
      } else {
        setItems(loadedItems);
        setSelectedVariantIds(
          loadedItems
            .filter((i) => i.available && i.price && i.stock >= i.quantity)
            .map((i) => i.variantId)
        );
      }
    } catch {
      if (initialPreview) {
        setIsPreview(true);
        setItems(PREVIEW_CART_ITEMS);
        setSelectedVariantIds(PREVIEW_CART_ITEMS.map((i) => i.variantId));
      } else {
        setError("Chưa thể tải dữ liệu giỏ hàng. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  }, [initialPreview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCart();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCart]);

  // Toggle single item selection
  function toggleItemSelection(variantId: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSelectedVariantIds((prev) =>
      prev.includes(variantId)
        ? prev.filter((id) => id !== variantId)
        : [...prev, variantId]
    );
  }

  // Toggle select all items
  function toggleSelectAll() {
    const validItemIds = items
      .filter((i) => i.available && i.price && i.stock >= i.quantity)
      .map((i) => i.variantId);

    if (selectedVariantIds.length === validItemIds.length) {
      setSelectedVariantIds([]);
    } else {
      setSelectedVariantIds(validItemIds);
    }
  }

  async function updateQuantity(variantId: number, nextQty: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (busy) return;

    if (isPreview) {
      if (nextQty <= 0) {
        setItems((current) => current.filter((i) => i.variantId !== variantId));
        setSelectedVariantIds((prev) => prev.filter((id) => id !== variantId));
      } else {
        setItems((current) =>
          current.map((item) =>
            item.variantId === variantId ? { ...item, quantity: nextQty } : item
          )
        );
      }
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop?view=cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cart",
          variantId,
          quantity: nextQty,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Không thể cập nhật số lượng.");
      await loadCart();
    } catch (err) {
      setError((err as Error).message || "Không thể cập nhật số lượng.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(variantId: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    await updateQuantity(variantId, 0);
  }

  // Proceed to checkout with selected items
  function handleProceedToCheckout() {
    if (selectedVariantIds.length === 0) return;
    try {
      sessionStorage.setItem("aurel-selected-items", JSON.stringify(selectedVariantIds));
    } catch {
      // ignore storage errors
    }
    const query = selectedVariantIds.join(",");
    router.push(`/checkout?items=${encodeURIComponent(query)}`);
  }

  // Only calculate totals for SELECTED items
  const selectedItems = items.filter((item) => selectedVariantIds.includes(item.variantId));
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + BigInt(item.price ?? "0") * BigInt(item.quantity),
    BigInt(0)
  );

  const allValidSelected =
    items.length > 0 &&
    items
      .filter((i) => i.available && i.price && i.stock >= i.quantity)
      .every((i) => selectedVariantIds.includes(i.variantId));

  const content = (
    <div className={embedded ? styles.embeddedWrapper : styles.container}>
      {/* Breadcrumb if not embedded */}
      {!embedded && (
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>
            <HouseIcon className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRightIcon className={styles.breadcrumbSeparator} />
          <span className={styles.breadcrumbCurrent}>Giỏ hàng</span>
        </nav>
      )}

      {/* Header if not embedded */}
      {!embedded && (
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Giỏ hàng của bạn</h1>
          <p className={styles.pageSubtitle}>
            Quản lý các sản phẩm bạn đã chọn trước khi tiến hành thanh toán.
          </p>
        </header>
      )}

      {/* Stepper */}
      <div className={styles.stepperRow} aria-label="Tiến trình đặt hàng">
        <div className={styles.stepItem}>
          <div className={styles.stepCircleActive}>1</div>
          <span className={styles.stepLabelActive}>Giỏ hàng</span>
        </div>

        <div className={styles.stepDivider} />

        <div className={styles.stepItem}>
          <div className={styles.stepCircleUpcoming}>2</div>
          <span className={styles.stepLabelUpcoming}>Thanh toán</span>
        </div>

        <div className={styles.stepDivider} />

        <div className={styles.stepItem}>
          <div className={styles.stepCircleUpcoming}>3</div>
          <span className={styles.stepLabelUpcoming}>Hoàn tất</span>
        </div>
      </div>

      {/* Status Error */}
      {error && (
        <div role="alert" className={`${styles.statusMessage} ${styles.statusError}`}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className={styles.emptyStateCard}>
          <ShoppingBagIcon className={styles.emptyStateIcon} />
          <h2 className={styles.emptyStateTitle}>Đang tải giỏ hàng…</h2>
        </div>
      )}

      {/* Empty Cart State */}
      {!loading && items.length === 0 && (
        <div className={styles.emptyStateCard}>
          <ShoppingBagIcon className={styles.emptyStateIcon} />
          <h2 className={styles.emptyStateTitle}>Giỏ hàng của bạn đang trống</h2>
          <p className={styles.emptyStateSubtitle}>
            Chưa có sản phẩm nào trong giỏ hàng. Hãy khám phá những thiết kế mới nhất của
            AUREL để chọn cho mình trang phục ưng ý nhé.
          </p>
          <Link href="/products" className={styles.primaryAction}>
            <span>Khám phá bộ sưu tập</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Cart with items */}
      {items.length > 0 && (
        <div className={styles.cartGrid}>
          {/* Left Column: Products List */}
          <div className={styles.leftColumn}>
            <section className={styles.card} aria-labelledby="cart-items-heading">
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderTitle}>
                  <ShoppingBagIcon className={styles.cardIcon} />
                  <h2 id="cart-items-heading" className={styles.cardTitle}>
                    Danh sách sản phẩm ({items.length} món)
                  </h2>
                </div>
              </div>

              {/* Selection Toolbar */}
              <div className={styles.selectToolbar}>
                <label className={styles.selectAllLabel} onClick={toggleSelectAll}>
                  <div
                    className={`${styles.customCheckbox} ${
                      allValidSelected ? styles.customCheckboxChecked : ""
                    }`}
                    role="checkbox"
                    aria-checked={allValidSelected}
                  >
                    {allValidSelected && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <span>Chọn tất cả ({items.length} sản phẩm)</span>
                </label>
                <span className={styles.selectedCountBadge}>
                  Đã chọn: {selectedItems.length}/{items.length}
                </span>
              </div>

              <div className={styles.cartItemsList}>
                {items.map((item) => {
                  const isSelected = selectedVariantIds.includes(item.variantId);
                  const itemTotal = item.price
                    ? BigInt(item.price) * BigInt(item.quantity)
                    : BigInt(0);
                  const isOutOfStock =
                    !item.available || !item.price || item.stock < item.quantity;

                  return (
                    <div
                      key={item.variantId}
                      className={`${styles.cartItemCard} ${
                        isSelected ? styles.cartItemCardSelected : ""
                      }`}
                      onClick={() => !isOutOfStock && toggleItemSelection(item.variantId)}
                      role="checkbox"
                      aria-checked={isSelected}
                    >
                      {/* Item Checkbox */}
                      <div
                        className={`${styles.customCheckbox} ${
                          isSelected ? styles.customCheckboxChecked : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOutOfStock) toggleItemSelection(item.variantId);
                        }}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>

                      {/* Thumbnail */}
                      <Link
                        href={`/products/${item.slug}`}
                        className={styles.itemImageLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={76}
                            height={76}
                            className={styles.itemImage}
                            unoptimized={item.image.startsWith("/images/uploads/")}
                          />
                        ) : (
                          <div
                            className={`${styles.itemImage} flex items-center justify-center text-stone-400`}
                          >
                            <ShoppingBagIcon className="w-7 h-7" />
                          </div>
                        )}
                      </Link>

                      {/* Details */}
                      <div className={styles.itemDetails}>
                        <Link
                          href={`/products/${item.slug}`}
                          className={styles.itemName}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.name}
                        </Link>
                        <p className={styles.itemVariant}>
                          Màu: {item.color} · Size: {item.size}
                        </p>
                        <p className={styles.itemUnitPrice}>
                          Đơn giá: {item.price ? formatVND(item.price) : "Chưa có giá"}
                        </p>
                        {isOutOfStock && (
                          <span className={styles.stockWarning}>
                            Không đủ hàng hoặc giá chưa khả dụng
                          </span>
                        )}
                      </div>

                      {/* Quantity Controller */}
                      <div
                        className={styles.quantityControl}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Giảm số lượng ${item.name}`}
                          disabled={busy || item.quantity <= 1}
                          onClick={(e) =>
                            void updateQuantity(item.variantId, item.quantity - 1, e)
                          }
                          className={styles.quantityButton}
                        >
                          −
                        </button>
                        <span className={styles.quantityValue}>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Tăng số lượng ${item.name}`}
                          disabled={busy || item.quantity >= Math.min(item.stock, 99)}
                          onClick={(e) =>
                            void updateQuantity(item.variantId, item.quantity + 1, e)
                          }
                          className={styles.quantityButton}
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total & Remove Action */}
                      <div
                        className={styles.itemTotalAndActions}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className={styles.itemLineTotal}>{formatVND(itemTotal)}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => void removeItem(item.variantId, e)}
                          className={styles.removeButton}
                          aria-label={`Xóa ${item.name} khỏi giỏ`}
                        >
                          <TrashIcon className={styles.trashIcon} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer: Continue Shopping */}
              <div className={styles.cardFooter}>
                <Link href="/products" className={styles.continueShoppingLink}>
                  ← Tiếp tục mua sắm
                </Link>
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary */}
          <div className={styles.rightColumn}>
            <aside className={styles.summaryCard} aria-label="Tóm tắt đơn hàng">
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderTitle}>
                  <ShoppingBagIcon className={styles.cardIcon} />
                  <h2 className={styles.cardTitle}>Tóm tắt đơn hàng</h2>
                </div>
              </div>

              <div className={styles.calcRow}>
                <span>Tạm tính ({selectedItems.length} món đã chọn)</span>
                <span className={styles.calcValue}>{formatVND(subtotal)}</span>
              </div>

              <div className={styles.calcRow}>
                <span className={styles.calcLabelWithIcon}>
                  Phí vận chuyển <InfoIcon className="w-3.5 h-3.5 text-stone-400" />
                </span>
                <span className={styles.calcValue}>0 ₫</span>
              </div>

              {/* Total Highlight Box */}
              <div className={styles.totalBox}>
                <span className={styles.totalLabel}>Tổng thanh toán</span>
                <span className={styles.totalAmount}>{formatVND(subtotal)}</span>
              </div>

              {/* Free Shipping Notice */}
              <div className={styles.freeShippingBox}>
                <TruckIcon className={styles.shippingIcon} />
                <div>
                  <p className={styles.freeShippingTitle}>Miễn phí vận chuyển</p>
                  <p className={styles.freeShippingDesc}>
                    Đơn hàng của bạn đủ điều kiện miễn phí vận chuyển.
                  </p>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                type="button"
                onClick={handleProceedToCheckout}
                disabled={selectedItems.length === 0}
                className={styles.checkoutButton}
                aria-label="Tiến hành đặt hàng"
              >
                <span>
                  {selectedItems.length > 0
                    ? `Tiến hành đặt hàng (${selectedItems.length})`
                    : "Chọn sản phẩm để đặt hàng"}
                </span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>

              {/* Guarantees */}
              <div className={styles.guarantees}>
                <div className={styles.guaranteeItem}>
                  <TruckIcon className={styles.guaranteeIcon} />
                  <span>Giao hàng toàn quốc</span>
                </div>
                <div className={styles.guaranteeItem}>
                  <RotateCcwIcon className={styles.guaranteeIcon} />
                  <span>Đổi trả dễ dàng trong 30 ngày</span>
                </div>
                <div className={styles.guaranteeItem}>
                  <LockIcon className={styles.guaranteeIcon} />
                  <span>Thanh toán an toàn & bảo mật</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return <div className={styles.pageWrapper}>{content}</div>;
}
