export type OrderStatusKey = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export function formatOrderDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = `Th${d.getMonth() + 1}`;
  const year = d.getFullYear();
  return `Đặt ngày ${day} ${month}, ${year}`;
}

export function formatStatusSubtext(status: OrderStatusKey, createdAt: Date | string): string {
  const d = new Date(createdAt);
  if (status === "DELIVERED") {
    const delivered = new Date(d.getTime() + 2 * 86400000);
    const day = String(delivered.getDate()).padStart(2, "0");
    const month = `Th${delivered.getMonth() + 1}`;
    const year = delivered.getFullYear();
    return `Giao thành công vào ${day} ${month}, ${year}`;
  }
  if (status === "SHIPPED") {
    const eta = new Date(d.getTime() + 3 * 86400000);
    const day = String(eta.getDate()).padStart(2, "0");
    const month = `Th${eta.getMonth() + 1}`;
    const year = eta.getFullYear();
    return `Dự kiến giao: ${day} ${month}, ${year}`;
  }
  if (status === "PENDING") {
    return "Đơn hàng đang được kiểm tra.";
  }
  if (status === "CONFIRMED") {
    return "Đơn hàng đang được chuẩn bị đóng gói.";
  }
  return "Đơn hàng đã được hủy.";
}

export function formatDisplayOrderNumber(orderNumber: string, id: number): string {
  if (orderNumber.startsWith("DEMO-")) {
    return `#AUR${(100000 + id).toString()}`;
  }
  return orderNumber.startsWith("#") ? orderNumber : `#${orderNumber}`;
}

