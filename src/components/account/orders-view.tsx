"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { UserOrder } from "@/features/orders/user-orders";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LayersIcon,
  PackageIcon,
  RotateCcwIcon,
  TruckIcon,
} from "./account-icons";
import styles from "./orders.module.css";

const tabs = [
  { key: "ALL", label: "Tất cả", Icon: LayersIcon },
  { key: "PENDING", label: "Chờ xác nhận", Icon: ClockIcon },
  { key: "CONFIRMED", label: "Đang xử lý", Icon: PackageIcon },
  { key: "SHIPPED", label: "Đang giao", Icon: TruckIcon },
  { key: "DELIVERED", label: "Đã giao", Icon: CheckCircleIcon },
  { key: "CANCELLED", label: "Đã hủy", Icon: RotateCcwIcon },
] as const;

function OrderThumbnail({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={styles.thumbFallback} role="img" aria-label={`Ảnh không khả dụng: ${name}`}>
      <PackageIcon aria-hidden="true" />
    </span>;
  }
  return <Image
    src={src}
    alt={name}
    fill
    sizes="48px"
    unoptimized={src.startsWith("/images/uploads/")}
    className={styles.thumbImage}
    onError={() => setFailed(true)}
  />;
}

export function OrdersView({ orders }: { orders: UserOrder[] }) {
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filtered = selectedTab === "ALL" ? orders : orders.filter(o => o.status === selectedTab);
  const totalPages = Math.max(orders.length >= 3 ? 3 : 1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleTabChange(key: string) {
    setSelectedTab(key);
    setPage(1);
  }

  function toggleDetails(id: number) {
    setExpandedId(current => (current === id ? null : id));
  }

  return (
    <div className={styles.container}>
      {/* Tabs Filter Bar */}
      <nav className={styles.tabsBar} aria-label="Lọc theo trạng thái đơn hàng">
        <ul className={styles.tabsList}>
          {tabs.map(({ key, label, Icon }) => {
            const active = selectedTab === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={active ? styles.tabActive : styles.tab}
                  onClick={() => handleTabChange(key)}
                  aria-pressed={active}
                >
                  <Icon className={styles.tabIcon} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <div className={styles.emptyCard} role="status">
          <PackageIcon className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>Chưa có đơn hàng nào</h2>
          <p className={styles.emptyDesc}>
            {selectedTab === "ALL"
              ? "Bạn chưa có đơn đặt hàng nào tại AUREL. Hãy khám phá bộ sưu tập mới nhé!"
              : `Không tìm thấy đơn hàng nào ở trạng thái này.`}
          </p>
          <Link href="/products" className={styles.emptyCta}>
            Khám phá sản phẩm
            <ArrowRightIcon />
          </Link>
        </div>
      ) : (
        <div className={styles.ordersList} role="feed" aria-label="Danh sách đơn hàng">
          {pagedOrders.map(order => {
            const isDelivered = order.status === "DELIVERED";
            const isShipped = order.status === "SHIPPED";
            const isPending = order.status === "PENDING";
            const isExpanded = expandedId === order.id;

            const visibleItems = order.items.slice(0, 2);
            const remainingCount = Math.max(0, order.items.length - 2);

            return (
              <article key={order.id} className={styles.orderCard}>
                <div className={styles.cardMain}>
                  {/* Column 1: Order number & Date */}
                  <div className={styles.infoCol}>
                    <strong className={styles.orderNumber}>{order.displayNumber}</strong>
                    <span className={styles.orderDate}>{order.formattedDate}</span>
                  </div>

                  {/* Column 2: Product Thumbnails */}
                  <div className={styles.thumbsCol}>
                    {visibleItems.map((item, idx) => (
                      <div key={idx} className={styles.thumbWrapper} title={item.productName}>
                        <OrderThumbnail key={item.imageUrl ?? "no-image"} src={item.imageUrl} name={item.productName} />
                      </div>
                    ))}
                    {remainingCount > 0 && (
                      <div
                        className={styles.moreBadge}
                        title={`Còn thêm ${remainingCount} sản phẩm khác`}
                      >
                        +{remainingCount}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Total amount */}
                  <div className={styles.totalCol}>
                    <span className={styles.totalLabel}>Tổng thanh toán</span>
                    <strong className={styles.totalAmount}>{order.formattedTotal}</strong>
                  </div>

                  {/* Column 4: Status Badge */}
                  <div className={styles.statusCol}>
                    <div
                      className={
                        isDelivered
                          ? styles.badgeDelivered
                          : isShipped
                            ? styles.badgeShipped
                            : isPending
                              ? styles.badgePending
                              : styles.badgeDefault
                      }
                    >
                      {isDelivered && <CheckCircleIcon className={styles.badgeIcon} />}
                      {isShipped && <TruckIcon className={styles.badgeIcon} />}
                      {isPending && <ClockIcon className={styles.badgeIcon} />}
                      {order.status === "CONFIRMED" && <PackageIcon className={styles.badgeIcon} />}
                      {order.status === "CANCELLED" && <RotateCcwIcon className={styles.badgeIcon} />}
                      <span>
                        {order.status === "DELIVERED"
                          ? "Đã giao"
                          : order.status === "SHIPPED"
                            ? "Đang giao"
                            : order.status === "CONFIRMED"
                              ? "Đang xử lý"
                              : order.status === "CANCELLED"
                                ? "Đã hủy"
                                : "Chờ xác nhận"}
                      </span>
                    </div>
                    <span className={styles.statusSubtext}>{order.statusSubtext}</span>
                  </div>

                  {/* Column 5: Action Button */}
                  <div className={styles.actionCol}>
                    <button
                      type="button"
                      className={isShipped ? styles.btnPrimary : styles.btnSecondary}
                      onClick={() => toggleDetails(order.id)}
                      aria-expanded={isExpanded}
                    >
                      <span>{isShipped ? "Theo dõi đơn hàng" : "Xem chi tiết"}</span>
                      <ArrowRightIcon />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className={styles.detailsDrawer}>
                    <div className={styles.detailsGrid}>
                      <div className={styles.detailsRecipient}>
                        <h4>Thông tin nhận hàng</h4>
                        <p>
                          <strong>{order.shippingName}</strong> · {order.shippingPhone}
                        </p>
                        <p>{order.shippingAddress}</p>
                      </div>
                      <div className={styles.detailsItems}>
                        <h4>Chi tiết sản phẩm ({order.items.length})</h4>
                        <ul>
                          {order.items.map((it, i) => (
                            <li key={i}>
                              <span>
                                {it.productName} ({it.color} / {it.size}) × {it.quantity}
                              </span>
                              <span>{it.unitPrice}</span>
                            </li>
                          ))}
                        </ul>
                        {order.discountAmount && Number(order.discountAmount) > 0 && (
                          <p className={styles.discountRow}>
                            Giảm giá: −{order.discountAmount} {order.currency}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang đơn hàng">
          <button
            type="button"
            className={styles.pageArrow}
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            aria-label="Trang trước"
          >
            <ChevronLeftIcon />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              type="button"
              className={num === currentPage ? styles.pageNumActive : styles.pageNum}
              onClick={() => setPage(num)}
              aria-current={num === currentPage ? "page" : undefined}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className={styles.pageArrow}
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            aria-label="Trang sau"
          >
            <ChevronRightIcon />
          </button>
        </nav>
      )}
    </div>
  );
}
