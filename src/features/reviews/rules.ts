import type { ProductRatingSummary } from "../catalog/catalog.ts";
import { ShopError, integer } from "../shop/rules.ts";
import type { AdminReviewsFilter, ReviewStatus } from "./types.ts";

export const REVIEW_COMMENT_MIN = 1;
export const REVIEW_COMMENT_MAX = 1000;
export const ADMIN_REPLY_MAX = 1000;

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const VALID_STATUSES = new Set<ReviewStatus>(["PENDING", "APPROVED", "HIDDEN"]);

export function normalizeReviewText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ShopError(`${label} không hợp lệ.`, 400);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (CONTROL_CHARS.test(normalized)) throw new ShopError(`${label} chứa ký tự không hợp lệ.`, 400);
  if (normalized.length < min) {
    throw new ShopError(min === 1 ? `Vui lòng nhập ${label.toLowerCase()}.` : `${label} phải có ít nhất ${min} ký tự.`, 400);
  }
  if (normalized.length > max) {
    throw new ShopError(`${label} tối đa ${max} ký tự.`, 400);
  }
  return normalized;
}

export function validateReviewInput(input: { rating?: unknown; comment?: unknown }): { rating: number; comment: string } {
  const rating = input.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ShopError("Điểm đánh giá phải từ 1 đến 5 sao.", 400);
  }
  const comment = normalizeReviewText(input.comment, "Nội dung đánh giá", REVIEW_COMMENT_MIN, REVIEW_COMMENT_MAX);
  return { rating, comment };
}

export function validateModerationInput(input: Record<string, unknown>): {
  reviewId: number;
  status?: ReviewStatus;
  adminReply?: string | null;
} {
  const reviewId = integer(input.reviewId);
  let status: ReviewStatus | undefined;
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !VALID_STATUSES.has(input.status as ReviewStatus)) {
      throw new ShopError("Trạng thái kiểm duyệt không hợp lệ.", 400);
    }
    status = input.status as ReviewStatus;
  }

  let adminReply: string | null | undefined;
  if (input.adminReply !== undefined) {
    if (input.adminReply === null || (typeof input.adminReply === "string" && input.adminReply.trim() === "")) {
      adminReply = null;
    } else {
      adminReply = normalizeReviewText(input.adminReply, "Phản hồi của shop", 1, ADMIN_REPLY_MAX);
    }
  }

  if (status === undefined && adminReply === undefined) {
    throw new ShopError("Cần cập nhật trạng thái hoặc phản hồi của shop.", 400);
  }

  return { reviewId, ...(status !== undefined ? { status } : {}), ...(adminReply !== undefined ? { adminReply } : {}) };
}

export function parseAdminReviewsFilter(raw: string | null | undefined): AdminReviewsFilter {
  if (!raw) return "ALL";
  const upper = raw.toUpperCase();
  if (upper === "ALL" || VALID_STATUSES.has(upper as ReviewStatus)) {
    return upper as AdminReviewsFilter;
  }
  return "ALL";
}

export function summarizeApprovedReviews(ratings: readonly number[]): ProductRatingSummary | null {
  const valid = ratings.filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return {
    average: Number((total / valid.length).toFixed(1)),
    count: valid.length,
  };
}
