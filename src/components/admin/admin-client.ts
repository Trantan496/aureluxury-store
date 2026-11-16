"use client";
import type { ServiceResult } from "@/features/products/product-service";
import { fieldLabels } from "@/features/products/editor-state";
export const adminFieldLabels: Record<string, string> = { ...fieldLabels, searchTags: "Thẻ Tag tìm kiếm", hex:"Mã HEX", draftRequired:"Cần chuyển sản phẩm về nháp trước khi bổ sung biến thể", ageGroup: "Nhóm tuổi", name: "Tên sản phẩm", slug: "Đường dẫn", categoryId: "Danh mục", combination: "Tổ hợp màu và kích cỡ bị trùng", activeVariants: "Cần biến thể đang hoạt động", variants: "Biến thể", images: "Hình ảnh", productCode: "Mã sản phẩm", storageKey: "Đường dẫn ảnh", rightsReference: "Bằng chứng quyền sử dụng", sourceReference: "Nguồn ảnh", stock: "Tồn kho", amount: "Giá", currency: "Loại tiền", sku: "SKU", label: "Tên lựa chọn", duplicateOption: "Lựa chọn đã tồn tại", childOwnership: "Liên kết biến thể/ảnh", missingChildren: "Danh sách biến thể/ảnh đã lưu", taxonomyLimit: "Số lựa chọn đã đạt giới hạn", collection: "Bộ sưu tập", brand: "Thương hiệu", description: "Mô tả", confirmation: "Mã xác nhận", input: "Dữ liệu nhập", sortOrder: "Thứ tự ảnh", isPrimary: "Ảnh chính", color: "Màu sắc", size: "Kích cỡ" };
export class AdminRequestError extends Error {
  constructor(message: string, public code: string, public field?: string) { super(message); this.name = "AdminRequestError"; }
}
export async function adminRequest<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/products", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as ServiceResult<T>;
  if (!result.ok) {
    const messages: Record<string, string> = { CONFLICT: "Dữ liệu đã thay đổi hoặc có bản ghi liên quan. Tải lại để kiểm tra trước khi thử tiếp.", FORBIDDEN: "Bạn không có quyền ADMIN.", UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn.", INVALID_INPUT: "Dữ liệu không hợp lệ", FEATURE_UNAVAILABLE: "Thao tác chưa khả dụng.", DATABASE_ERROR: "Không thể xác nhận kết quả. Tải lại dữ liệu trước khi thử tiếp." };
    throw new AdminRequestError((messages[result.error.code] ?? "Không thể hoàn tất thao tác.") + (result.error.field ? ` (${adminFieldLabels[result.error.field] ?? "Thông tin nhập"})` : ""), result.error.code, result.error.field);
  }
  return result.data;
}
