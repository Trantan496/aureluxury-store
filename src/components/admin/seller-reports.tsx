"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { canTransition, statusLabels } from "@/features/shop/rules";
import { paymentLabels } from "@/features/payments/rules";
import { SellerPortalIcon, SellerPortalNav } from "./seller-portal-nav";
import styles from "./seller-orders.module.css";

type ReportOrder = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string;
  subtotalAmount: string | null;
  discountAmount: string;
  voucherCode: string | null;
  currency: string | null;
  createdAt: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  items: {
    productName: string;
    sku: string;
    color: string;
    size: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string | null;
  }[];
  payment?: {
    paidAt: string | null;
    reconciliationRequired: boolean;
    attempts: {
      status: string;
      paymentLinkId: string | null;
      paidAmount: string | null;
      reference: string | null;
      receipts?: { reference: string; amount: string; receivedAt: string }[];
    }[];
  } | null;
};

type AdminReportData = {
  orders?: ReportOrder[];
  daily?: { totalAmount: string; status: string; createdAt: string }[];
  lowStock?: {
    id: number;
    sku: string;
    stock: number;
    color: string;
    size: string;
    product: { name: string };
  }[];
  bestSellers?: { productName: string; _sum: { quantity: number | null } }[];
};

function vnd(value: string | number | bigint) {
  const num =
    typeof value === "string" && /^\d+$/.test(value)
      ? BigInt(value)
      : typeof value === "string"
        ? Number(value)
        : value;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(num)} ₫`;
}

export function SellerReports() {
  const [data, setData] = useState<AdminReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [snapshotTime, setSnapshotTime] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shop?view=admin", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tải báo cáo.");
      setData(result.data as AdminReportData);
      setSnapshotTime(Date.now());
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải dữ liệu báo cáo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function updateStatus(order: ReportOrder, status: string, label: string) {
    if (busy) return;
    if (!window.confirm(`Chuyển đơn ${order.orderNumber} sang “${label}”?`)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/shop?view=admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id: order.id, expected: order.status, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể cập nhật trạng thái.");
      setNotice(`Đã cập nhật đơn ${order.orderNumber} sang trạng thái ${label}.`);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật trạng thái đơn.");
    } finally {
      setBusy(false);
    }
  }

  const daily = data?.daily ?? [];
  const lowStock = data?.lowStock ?? [];
  const bestSellers = data?.bestSellers ?? [];
  const orders = data?.orders ?? [];

  const periods = [
    { days: 1, label: "24 giờ gần nhất", sub: "Trong ngày hôm nay" },
    { days: 7, label: "7 ngày gần nhất", sub: "Chu kỳ 1 tuần" },
    { days: 30, label: "30 ngày gần nhất", sub: "Chu kỳ 1 tháng" },
  ].map((period) => {
    const rows = snapshotTime
      ? daily.filter(
          (row) => new Date(row.createdAt).getTime() >= snapshotTime - period.days * 86400000
        )
      : [];
    const deliveredRows = rows.filter((row) => row.status === "DELIVERED");
    const revenue = deliveredRows.reduce(
      (sum, row) => sum + (/^\d+$/.test(row.totalAmount) ? BigInt(row.totalAmount) : BigInt(0)),
      BigInt(0)
    );
    return {
      ...period,
      totalOrders: rows.length,
      deliveredCount: deliveredRows.length,
      revenue: vnd(revenue),
    };
  });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <SellerPortalNav active="reports" />

        <header className={styles.heroCard}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              AUREL · NGƯỜI BÁN
            </span>
            <h1>Báo cáo đơn hàng và tồn kho</h1>
            <p className={styles.heroSubtitle}>
              Doanh thu quy ước: tổng đơn VND đã hoàn tất, chưa phải đối soát tiền thực thu. Giám sát
              biến thể sắp hết hàng và 100 đơn gần nhất.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/admin/orders" className={styles.btnSubtle}>
              <SellerPortalIcon name="orders" />
              <span>Xử lý đơn hàng</span>
            </Link>
            <button
              type="button"
              className={styles.btnOutline}
              disabled={loading || busy}
              onClick={() => void load()}
            >
              <SellerPortalIcon name="refresh" />
              <span>Làm mới báo cáo</span>
            </button>
          </div>
        </header>

        <div className={styles.statusLine}>
          <span className={styles.statusIndicator}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>
              {lastUpdated
                ? `Dữ liệu cập nhật lúc ${lastUpdated} · Nguồn trực tiếp từ PostgreSQL.`
                : "Đang tải dữ liệu báo cáo và tồn kho…"}
            </span>
          </span>
          {loading && <span role="status">Đang đồng bộ số liệu…</span>}
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button
              type="button"
              className={styles.btnSubtle}
              disabled={busy}
              onClick={() => void load()}
            >
              Thử lại
            </button>
          </div>
        )}

        {notice && (
          <div role="status" className={styles.notice}>
            <span>{notice}</span>
          </div>
        )}

        {/* 3 Revenue KPI Cards */}
        <section className={styles.statsGrid} aria-label="Thống kê doanh thu theo chu kỳ">
          {periods.map((item) => (
            <article key={item.days} className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <span className={styles.statPeriod}>{item.label}</span>
                <span className={styles.statBadge}>{item.totalOrders} đơn</span>
              </div>
              <div className={styles.statValue}>{item.revenue}</div>
              <div className={styles.statFooter}>
                <span>{item.totalOrders} đơn · {item.deliveredCount} hoàn tất</span>
                <span>{item.sub}</span>
              </div>
            </article>
          ))}
        </section>

        {/* Two-Column Grid: Low Stock Alerts & Best Sellers */}
        <div className={styles.reportsGrid}>
          <section className={styles.sectionCard} aria-labelledby="low-stock-heading">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span className={styles.sectionIcon}>
                  <SellerPortalIcon name="alert" />
                </span>
                <div>
                  <h2 id="low-stock-heading">Cảnh báo tồn ≤ 5</h2>
                  <p>Tối đa 100 biến thể đang hoạt động có tồn kho thấp cần bổ sung</p>
                </div>
              </div>
              <span
                className={`${styles.countPill} ${lowStock.length > 0 ? styles.countPillWarning : ""}`}
              >
                {lowStock.length} biến thể
              </span>
            </div>

            {!loading && lowStock.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                  <SellerPortalIcon name="check" />
                </div>
                <h3>Không có cảnh báo tồn kho</h3>
                <p>Tất cả các biến thể đang mở bán đều có số lượng tồn kho trên mức cảnh báo.</p>
              </div>
            ) : (
              <div className={styles.stockList}>
                {lowStock.map((row) => (
                  <div key={row.id} className={styles.stockRow}>
                    <div className={styles.stockInfo}>
                      <span className={styles.stockName}>{row.product.name}</span>
                      <div className={styles.stockMeta}>
                        <span className={styles.skuTag}>{row.sku}</span>
                        <span className={styles.variantPill}>
                          {row.color} / {row.size}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`${styles.stockLevel} ${
                        row.stock <= 1 ? styles.stockCritical : styles.stockLow
                      }`}
                    >
                      Tồn: {row.stock}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.sectionCard} aria-labelledby="bestseller-heading">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span className={styles.sectionIcon}>
                  <SellerPortalIcon name="chart" />
                </span>
                <div>
                  <h2 id="bestseller-heading">Bán chạy từ đơn hoàn tất</h2>
                  <p>Xếp hạng theo số lượng sản phẩm trong các đơn đã giao thành công</p>
                </div>
              </div>
              <span className={styles.countPill}>Top {bestSellers.length || 10}</span>
            </div>

            {!loading && bestSellers.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                  <SellerPortalIcon name="box" />
                </div>
                <h3>Chưa có đơn hoàn tất</h3>
                <p>
                  Thống kê sản phẩm bán chạy sẽ tự động tổng hợp ngay khi có đơn hàng chuyển sang
                  trạng thái Đã giao.
                </p>
              </div>
            ) : (
              <ol className={styles.bestSellerList}>
                {bestSellers.map((row, idx) => (
                  <li key={row.productName} className={styles.bestSellerRow}>
                    <span className={styles.bestSellerRank}>#{idx + 1}</span>
                    <span className={styles.bestSellerName}>{row.productName}</span>
                    <span className={styles.bestSellerQty}>
                      Đã bán {row._sum.quantity ?? 0}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* 100 Recent Orders Section */}
        <section className={styles.sectionCard} aria-labelledby="recent-orders-heading">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span className={styles.sectionIcon}>
                <SellerPortalIcon name="orders" />
              </span>
              <div>
                <h2 id="recent-orders-heading">100 đơn gần nhất</h2>
                <p>Toàn bộ lịch sử đơn hàng và tra cứu nhanh trạng thái thanh toán</p>
              </div>
            </div>
            <span className={styles.countPill}>{orders.length} đơn</span>
          </div>

          {!loading && orders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <SellerPortalIcon name="orders" />
              </div>
              <h3>Chưa có đơn hàng</h3>
              <p>Khi khách hàng đặt mua từ cửa hàng, danh sách đơn sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th scope="col">Mã đơn &amp; Thời gian</th>
                    <th scope="col">Khách hàng &amp; Nhận hàng</th>
                    <th scope="col">Sản phẩm trong đơn</th>
                    <th scope="col">Thanh toán &amp; Tổng tiền</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" className={styles.thActions}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const payment = order.payment;
                    const latest =
                      payment?.attempts.find((attempt) => attempt.status === "PAID") ??
                      payment?.attempts[0];
                    return (
                      <tr key={order.id} className={styles.orderTableRow}>
                        <td className={styles.cellOrderCode}>
                          <strong className={styles.orderCode}>{order.orderNumber}</strong>
                          <span className={styles.cellSub}>
                            {new Date(order.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </td>

                        <td className={styles.cellCustomer}>
                          <div className={styles.customerNameRow}>
                            <strong>{order.shippingName}</strong>
                            <a href={`tel:${order.shippingPhone}`} className={styles.phoneLink}>
                              {order.shippingPhone}
                            </a>
                          </div>
                          <span className={styles.addressText}>{order.shippingAddress}</span>
                        </td>

                        <td className={styles.cellItems}>
                          <ul className={styles.tableItemList}>
                            {order.items.map((item) => (
                              <li key={item.sku} className={styles.tableItem}>
                                <div className={styles.tableItemTop}>
                                  <strong>{item.productName}</strong>
                                  <span className={styles.qtyBadge}>×{item.quantity}</span>
                                </div>
                                <div className={styles.tableItemMeta}>
                                  <span>
                                    {item.color} / {item.size}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {order.currency === "VND" ? vnd(item.unitPrice) : item.unitPrice}
                                  </span>
                                  <span className={styles.skuTag}>{item.sku}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </td>

                        <td className={styles.cellPayment}>
                          <strong className={styles.totalAmountText}>
                            {order.currency === "VND"
                              ? vnd(order.totalAmount)
                              : `${order.totalAmount} ${order.currency ?? "chưa xác định tiền tệ"}`}
                          </strong>
                          {order.voucherCode && (
                            <span className={styles.voucherTag}>
                              Mã giảm giá ({order.voucherCode}): −{vnd(order.discountAmount)}
                            </span>
                          )}
                          <span className={styles.badge} data-paid={!!payment?.paidAt}>
                            {payment
                              ? `payOS · ${paymentLabels[payment.paidAt ? "PAID" : latest?.status ?? "PROCESSING"]}`
                              : order.orderNumber.startsWith("DEMO-")
                                ? "COD DEMO"
                                : "Đơn lịch sử"}
                          </span>
                          {payment?.paidAt && (
                            <span className={styles.cellSub}>
                              Ngày TT: {new Date(payment.paidAt).toLocaleString("vi-VN")} · Thu:{" "}
                              {latest?.paidAmount
                                ? vnd(latest.paidAmount)
                                : "Xem lần thanh toán trước"}
                            </span>
                          )}
                        </td>

                        <td className={styles.cellStatus}>
                          <span className={styles.badge} data-status={order.status}>
                            {statusLabels[order.status] ?? order.status}
                          </span>
                          {payment?.reconciliationRequired && (
                            <p role="alert" className={styles.inlineReview}>
                              Cần đối soát trước khi giao hàng/hoàn tiền.
                            </p>
                          )}
                        </td>

                        <td className={styles.cellActions}>
                          <div className={styles.tableActionStack}>
                            {order.orderNumber.startsWith("DEMO-") &&
                              Object.entries(statusLabels)
                                .filter(([status]) => {
                                  if (!canTransition(order.status, status, true)) return false;
                                  if (!order.payment) return true;
                                  return status === "CANCELLED"
                                    ? !order.payment.paidAt &&
                                        !order.payment.reconciliationRequired &&
                                        !order.payment.attempts.some(
                                          (attempt) =>
                                            attempt.status === "PENDING" ||
                                            attempt.status === "PROCESSING"
                                        )
                                    : !!order.payment.paidAt &&
                                        !order.payment.reconciliationRequired;
                                })
                                .map(([status, label]) => (
                                  <button
                                    key={status}
                                    type="button"
                                    className={
                                      status === "CANCELLED"
                                        ? styles.btnTableOutline
                                        : styles.btnTablePrimary
                                    }
                                    disabled={busy}
                                    onClick={() => void updateStatus(order, status, label)}
                                  >
                                    {label}
                                  </button>
                                ))}
                            <Link
                              href={`/admin/orders/${order.id}/print`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.btnTableSubtle}
                            >
                              <SellerPortalIcon name="printer" />
                              <span>In phiếu đóng gói ↗</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
