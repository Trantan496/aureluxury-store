import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductRatingSummary } from "@/features/catalog/catalog";
import { resolveProductSession } from "@/lib/auth-session";
import { shopActor } from "@/features/shop/service";
import { ShopError } from "@/features/shop/rules";
import { prisma } from "@/lib/db/client";
import { defaultAutoRatingStore } from "./auto-rating";
import { summarizeApprovedReviews } from "./rules";
import {
  deleteReviewUseCase,
  editReviewUseCase,
  getPublicReviewsUseCase,
  listAdminReviewsUseCase,
  moderateReviewUseCase,
  submitReviewUseCase,
  type ReviewActor,
  type ReviewStore,
} from "./use-cases";
import type {
  AdminReviewItem,
  AdminReviewsPage,
  PublicProductReviewsPayload,
  PublicReviewItem,
  ReviewStatus,
  ViewerOwnReview,
} from "./types";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function reviewsAvailable() {
  const rows = await prisma.$queryRaw<{ available: boolean }[]>`SELECT to_regclass('public."ProductReview"') IS NOT NULL AS available`;
  return rows[0]?.available === true;
}

function mapAdminReviewRow(row: {
  id: number;
  productId: number;
  userId: number;
  orderItemId: number | null;
  rating: number;
  comment: string;
  status: ReviewStatus;
  adminReply: string | null;
  adminRepliedAt: Date | null;
  moderatedAt: Date | null;
  createdAt: Date;
  product: { name: string; slug: string };
  user: { fullName: string; email: string };
}): AdminReviewItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    userId: row.userId,
    customerName: row.user.fullName,
    customerEmail: row.user.email,
    orderItemId: row.orderItemId,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    adminReply: row.adminReply,
    adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapViewerOwnReview(row: {
  id: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: Date;
  adminReply: string | null;
  adminRepliedAt: Date | null;
}): ViewerOwnReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    adminReply: row.adminReply,
    adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null,
  };
}

async function findExistingReviewIn(db: DbClient, userId: number, productId: number): Promise<ViewerOwnReview | null> {
  const row = await db.productReview.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, rating: true, comment: true, status: true, createdAt: true, adminReply: true, adminRepliedAt: true },
  });
  return row ? mapViewerOwnReview(row) : null;
}

async function findEligibleDeliveredOrderItemIn(db: DbClient, userId: number, productId: number): Promise<number | null> {
  const item = await db.orderItem.findFirst({
    where: {
      order: { userId, status: "DELIVERED" },
      variant: { productId },
    },
    orderBy: [{ id: "desc" }],
    select: { id: true },
  });
  return item?.id ?? null;
}

async function withSerializableRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      if ((error as { code?: string }).code === "P2002") {
        throw new ShopError("Bạn đã gửi đánh giá cho sản phẩm này rồi.", 409);
      }
      throw error;
    }
  }
}

const prismaReviewStore: ReviewStore = {
  async findActiveProduct({ productId, productSlug }) {
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        ...(productId ? { id: productId } : { slug: productSlug }),
      },
      select: { id: true },
    });
    return product;
  },

  async runLockedForUser(userId, work) {
    return withSerializableRetry(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      return work({
        findExistingReview: (u, p) => findExistingReviewIn(tx, u, p),
        findEligibleDeliveredOrderItem: (u, p) => findEligibleDeliveredOrderItemIn(tx, u, p),
        async createReview(data) {
          const row = await tx.productReview.create({
            data,
            select: { id: true, status: true },
          });
          return { id: row.id, status: row.status };
        },
      });
    });
  },

  async listApprovedReviews(productId, viewerUserId) {
    const rows = await prisma.productReview.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        userId: true,
        rating: true,
        comment: true,
        createdAt: true,
        adminReply: true,
        adminRepliedAt: true,
        user: { select: { fullName: true } },
      },
    });
    return rows.map((row): PublicReviewItem => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: row.user.fullName.trim() || "Khách hàng",
      createdAt: row.createdAt.toISOString(),
      adminReply: row.adminReply,
      adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null,
      isOwn: viewerUserId != null && row.userId === viewerUserId,
    }));
  },

  findExistingReview: (userId, productId) => findExistingReviewIn(prisma, userId, productId),
  findEligibleDeliveredOrderItem: (userId, productId) => findEligibleDeliveredOrderItemIn(prisma, userId, productId),

  async listAdminReviews(filter) {
    const where = filter === "ALL" ? {} : { status: filter };
    const [totalAll, totalPending, totalApproved, totalHidden, rows] = await prisma.$transaction(async tx => {
      const all = await tx.productReview.count();
      const pending = await tx.productReview.count({ where: { status: "PENDING" } });
      const approved = await tx.productReview.count({ where: { status: "APPROVED" } });
      const hidden = await tx.productReview.count({ where: { status: "HIDDEN" } });
      const list = await tx.productReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          productId: true,
          userId: true,
          orderItemId: true,
          rating: true,
          comment: true,
          status: true,
          adminReply: true,
          adminRepliedAt: true,
          moderatedAt: true,
          createdAt: true,
          product: { select: { name: true, slug: true } },
          user: { select: { fullName: true, email: true } },
        },
      });
      return [all, pending, approved, hidden, list] as const;
    });
    return {
      counts: { ALL: totalAll, PENDING: totalPending, APPROVED: totalApproved, HIDDEN: totalHidden },
      reviews: rows.map(mapAdminReviewRow),
    };
  },

  async findReviewById(reviewId) {
    const row = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        productId: true,
        userId: true,
        orderItemId: true,
        rating: true,
        comment: true,
        status: true,
        adminReply: true,
        adminRepliedAt: true,
        moderatedAt: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
        user: { select: { fullName: true, email: true } },
      },
    });
    return row ? mapAdminReviewRow(row) : null;
  },

  async updateOwnReview({ reviewId, rating, comment, status }) {
    const row = await prisma.productReview.update({
      where: { id: reviewId },
      data: { rating, comment, status },
      select: { id: true, rating: true, comment: true, status: true, createdAt: true, adminReply: true, adminRepliedAt: true },
    });
    return mapViewerOwnReview(row);
  },

  async deleteOwnReview(reviewId) {
    await prisma.productReview.delete({ where: { id: reviewId } });
  },

  async updateReviewModeration({ reviewId, status, adminReply, moderatedById, now }) {
    const row = await prisma.productReview.update({
      where: { id: reviewId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(adminReply !== undefined ? { adminReply, adminRepliedAt: adminReply ? now : null } : {}),
        moderatedById,
        moderatedAt: now,
      },
      select: {
        id: true,
        productId: true,
        userId: true,
        orderItemId: true,
        rating: true,
        comment: true,
        status: true,
        adminReply: true,
        adminRepliedAt: true,
        moderatedAt: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
        user: { select: { fullName: true, email: true } },
      },
    });
    return mapAdminReviewRow(row);
  },
};

async function optionalViewerActor(): Promise<ReviewActor | null> {
  try {
    const session = await resolveProductSession();
    if (!session) return null;
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
    return user;
  } catch {
    return null;
  }
}

export async function getApprovedProductRatingSummary(productId: number): Promise<ProductRatingSummary | null> {
  if (!await reviewsAvailable()) {
    return null;
  }
  const rows = await prisma.productReview.findMany({
    where: { productId, status: "APPROVED" },
    select: { rating: true },
  });
  const realSummary = summarizeApprovedReviews(rows.map(row => row.rating));
  return realSummary;
}

export async function getPublicProductReviewsBySlugOrId(ref: {
  productId?: number;
  productSlug?: string;
}): Promise<PublicProductReviewsPayload> {
  if (!await reviewsAvailable()) {
    return {
      available: false,
      summary: null,
      reviews: [],
      viewer: { canSubmit: false, reason: "UNAVAILABLE", ownReview: null },
    };
  }
  const product = await prismaReviewStore.findActiveProduct(ref);
  if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
  const viewer = await optionalViewerActor();
  const payload = await getPublicReviewsUseCase(product.id, viewer?.id ?? null, prismaReviewStore);
  return payload;
}

export async function submitCustomerReview(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (!await reviewsAvailable()) {
    throw new ShopError("Hệ thống đánh giá đang được thiết lập. Vui lòng thử lại sau.", 503);
  }
  return submitReviewUseCase(actor, input, prismaReviewStore);
}

export async function editCustomerReview(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (!await reviewsAvailable()) {
    throw new ShopError("Hệ thống đánh giá đang được thiết lập. Vui lòng thử lại sau.", 503);
  }
  return editReviewUseCase(actor, input, prismaReviewStore);
}

export async function deleteCustomerReview(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (!await reviewsAvailable()) {
    throw new ShopError("Hệ thống đánh giá đang được thiết lập. Vui lòng thử lại sau.", 503);
  }
  return deleteReviewUseCase(actor, input, prismaReviewStore);
}

export async function adminListProductReviews(filterRaw: string | null): Promise<AdminReviewsPage> {
  const actor = await shopActor();
  if (actor.role !== "ADMIN") {
    throw new ShopError("Chỉ quản trị viên mới có quyền quản lý đánh giá.", 403);
  }
  const autoState = await defaultAutoRatingStore.get();
  const autoFiveStar = { enabled: autoState.enabled, updatedAt: autoState.updatedAt };
  if (!await reviewsAvailable()) {
    return {
      available: false,
      filter: "ALL",
      counts: { ALL: 0, PENDING: 0, APPROVED: 0, HIDDEN: 0 },
      reviews: [],
      autoFiveStar,
    };
  }
  const page = await listAdminReviewsUseCase(actor, filterRaw, prismaReviewStore);
  return { ...page, autoFiveStar };
}

export async function adminSetAutoFiveStar(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (actor.role !== "ADMIN") {
    throw new ShopError("Chỉ quản trị viên mới có quyền bật tự động đánh giá 5 sao.", 403);
  }
  if (typeof input.enabled !== "boolean") {
    throw new ShopError("Trạng thái tự động đánh giá 5 sao không hợp lệ.", 400);
  }
  const state = await defaultAutoRatingStore.set(input.enabled, actor.id);
  const totalActiveProducts = await prisma.product.count({ where: { isActive: true } });
  return {
    autoFiveStar: { enabled: state.enabled, updatedAt: state.updatedAt },
    totalActiveProducts,
  };
}

export async function adminModerateProductReview(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (!await reviewsAvailable()) {
    throw new ShopError("Hệ thống đánh giá chưa được kích hoạt trên cơ sở dữ liệu.", 503);
  }
  return moderateReviewUseCase(actor, input, prismaReviewStore);
}

export async function adminDeleteProductReview(input: Record<string, unknown>) {
  const actor = await shopActor();
  if (actor.role !== "ADMIN") throw new ShopError("Chỉ quản trị viên có quyền xóa đánh giá của khách.", 403);
  return deleteReviewUseCase(actor, input, prismaReviewStore);
}
