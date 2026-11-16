import { ShopError, integer } from "../shop/rules.ts";
import {
  parseAdminReviewsFilter,
  summarizeApprovedReviews,
  validateModerationInput,
  validateReviewInput,
} from "./rules.ts";
import type {
  AdminReviewItem,
  AdminReviewsFilter,
  AdminReviewsPage,
  PublicProductReviewsPayload,
  PublicReviewItem,
  ReviewStatus,
  ViewerOwnReview,
} from "./types.ts";

export interface ReviewActor {
  id: number;
  role: string;
}

export interface ReviewTransactionContext {
  findExistingReview(userId: number, productId: number): Promise<ViewerOwnReview | null>;
  findEligibleDeliveredOrderItem(userId: number, productId: number): Promise<number | null>;
  createReview(data: {
    productId: number;
    userId: number;
    orderItemId: number | null;
    rating: number;
    comment: string;
    status: ReviewStatus;
  }): Promise<{ id: number; status: ReviewStatus }>;
}

export interface ReviewStore {
  findActiveProduct(ref: { productId?: number; productSlug?: string }): Promise<{ id: number } | null>;
  runLockedForUser<T>(userId: number, work: (tx: ReviewTransactionContext) => Promise<T>): Promise<T>;
  listApprovedReviews(productId: number, viewerUserId?: number | null): Promise<PublicReviewItem[]>;
  findExistingReview(userId: number, productId: number): Promise<ViewerOwnReview | null>;
  findEligibleDeliveredOrderItem(userId: number, productId: number): Promise<number | null>;
  listAdminReviews(filter: AdminReviewsFilter): Promise<{
    counts: Record<AdminReviewsFilter, number>;
    reviews: AdminReviewItem[];
  }>;
  findReviewById(reviewId: number): Promise<AdminReviewItem | null>;
  updateOwnReview(data: {
    reviewId: number;
    rating: number;
    comment: string;
    status: ReviewStatus;
  }): Promise<ViewerOwnReview>;
  deleteOwnReview(reviewId: number): Promise<void>;
  updateReviewModeration(data: {
    reviewId: number;
    status?: ReviewStatus;
    adminReply?: string | null;
    moderatedById: number;
    now: Date;
  }): Promise<AdminReviewItem>;
}

export async function submitReviewUseCase(
  actor: ReviewActor | null,
  input: Record<string, unknown>,
  store: ReviewStore,
): Promise<{ review: { id: number; status: ReviewStatus } }> {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để gửi đánh giá.", 401);

  const productId = input.productId !== undefined ? integer(input.productId) : undefined;
  const productSlug = typeof input.productSlug === "string" && input.productSlug.trim() ? input.productSlug.trim() : undefined;
  if (!productId && !productSlug) {
    throw new ShopError("Thiếu thông tin sản phẩm cần đánh giá.", 400);
  }

  const product = await store.findActiveProduct({ productId, productSlug });
  if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);

  const { rating, comment } = validateReviewInput({ rating: input.rating, comment: input.comment });

  const created = await store.runLockedForUser(actor.id, async tx => {
    const existing = await tx.findExistingReview(actor.id, product.id);
    if (existing) {
      throw new ShopError("Bạn đã gửi đánh giá cho sản phẩm này rồi.", 409);
    }

    const orderItemId = await tx.findEligibleDeliveredOrderItem(actor.id, product.id);

    return tx.createReview({
      productId: product.id,
      userId: actor.id,
      orderItemId,
      rating,
      comment,
      status: "APPROVED",
    });
  });

  return { review: created };
}

export async function moderateReviewUseCase(
  actor: ReviewActor | null,
  input: Record<string, unknown>,
  store: ReviewStore,
  now = new Date(),
): Promise<{ review: AdminReviewItem }> {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để thực hiện thao tác.", 401);
  if (actor.role !== "ADMIN") {
    throw new ShopError("Chỉ quản trị viên mới có quyền duyệt đánh giá.", 403);
  }

  const validated = validateModerationInput(input);
  const existing = await store.findReviewById(validated.reviewId);
  if (!existing) throw new ShopError("Không tìm thấy đánh giá.", 404);

  const review = await store.updateReviewModeration({
    ...validated,
    moderatedById: actor.id,
    now,
  });

  return { review };
}

export async function getPublicReviewsUseCase(
  productId: number,
  viewerUserId: number | null,
  store: ReviewStore,
): Promise<PublicProductReviewsPayload> {
  const reviews = await store.listApprovedReviews(productId, viewerUserId);
  const summary = summarizeApprovedReviews(reviews.map(review => review.rating));

  if (!viewerUserId) {
    return {
      available: true,
      summary,
      reviews,
      viewer: { canSubmit: false, reason: "UNAUTHENTICATED", ownReview: null },
    };
  }

  const ownReview = await store.findExistingReview(viewerUserId, productId);
  if (ownReview) {
    return {
      available: true,
      summary,
      reviews,
      viewer: { canSubmit: false, reason: "ALREADY_REVIEWED", ownReview },
    };
  }

  return {
    available: true,
    summary,
    reviews,
    viewer: {
      canSubmit: true,
      reason: "ELIGIBLE",
      ownReview: null,
    },
  };
}

export async function listAdminReviewsUseCase(
  actor: ReviewActor | null,
  filterRaw: string | null | undefined,
  store: ReviewStore,
): Promise<AdminReviewsPage> {
  if (!actor) throw new ShopError("Vui lòng đăng nhập tài khoản quản trị.", 401);
  if (actor.role !== "ADMIN") {
    throw new ShopError("Chỉ quản trị viên mới có quyền quản lý đánh giá.", 403);
  }
  const filter = parseAdminReviewsFilter(filterRaw);
  const { counts, reviews } = await store.listAdminReviews(filter);
  return { available: true, filter, counts, reviews };
}

export async function editReviewUseCase(
  actor: ReviewActor | null,
  input: Record<string, unknown>,
  store: ReviewStore,
): Promise<{ review: ViewerOwnReview }> {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để chỉnh sửa bình luận.", 401);
  const reviewId = integer(input.reviewId);
  const { rating, comment } = validateReviewInput({ rating: input.rating, comment: input.comment });

  const existing = await store.findReviewById(reviewId);
  if (!existing) throw new ShopError("Không tìm thấy bình luận.", 404);
  if (existing.userId !== actor.id) {
    throw new ShopError("Bạn chỉ có thể chỉnh sửa bình luận của chính mình.", 403);
  }

  const review = await store.updateOwnReview({
    reviewId,
    rating,
    comment,
    status: existing.status === "HIDDEN" ? "HIDDEN" : "APPROVED",
  });
  return { review };
}

export async function deleteReviewUseCase(
  actor: ReviewActor | null,
  input: Record<string, unknown>,
  store: ReviewStore,
): Promise<{ deleted: true }> {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để xóa bình luận.", 401);
  const reviewId = integer(input.reviewId);

  const existing = await store.findReviewById(reviewId);
  if (!existing) throw new ShopError("Không tìm thấy bình luận.", 404);
  if (existing.userId !== actor.id && actor.role !== "ADMIN") {
    throw new ShopError("Bạn chỉ có thể xóa bình luận của chính mình.", 403);
  }

  await store.deleteOwnReview(reviewId);
  return { deleted: true };
}
