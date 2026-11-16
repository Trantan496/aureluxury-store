import type { ProductRatingSummary } from "@/features/catalog/catalog";

export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";
export type AdminReviewsFilter = "ALL" | ReviewStatus;

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đang hiển thị",
  HIDDEN: "Đã ẩn",
};

export interface PublicReviewItem {
  id: number;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
  isOwn?: boolean;
}

export interface ViewerOwnReview {
  id: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
}

export interface ProductReviewsViewerState {
  canSubmit: boolean;
  reason: "UNAUTHENTICATED" | "NO_PURCHASE" | "ALREADY_REVIEWED" | "ELIGIBLE" | "UNAVAILABLE";
  ownReview: ViewerOwnReview | null;
}

export interface PublicProductReviewsPayload {
  available: boolean;
  summary: ProductRatingSummary | null;
  reviews: PublicReviewItem[];
  viewer: ProductReviewsViewerState;
}

export interface AdminReviewItem {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  userId: number;
  customerName: string;
  customerEmail: string;
  orderItemId: number | null;
  rating: number;
  comment: string;
  status: ReviewStatus;
  adminReply: string | null;
  adminRepliedAt: string | null;
  moderatedAt: string | null;
  createdAt: string;
}

export interface AutoFiveStarStatus {
  enabled: boolean;
  updatedAt: string | null;
}

export interface AdminReviewsPage {
  available: boolean;
  filter: AdminReviewsFilter;
  counts: Record<AdminReviewsFilter, number>;
  reviews: AdminReviewItem[];
  autoFiveStar?: AutoFiveStarStatus;
}
