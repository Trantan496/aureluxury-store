import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShopError } from "../src/features/shop/rules.ts";
import {
  deleteReviewUseCase,
  editReviewUseCase,
  getPublicReviewsUseCase,
  listAdminReviewsUseCase,
  moderateReviewUseCase,
  submitReviewUseCase,
  type ReviewStore,
} from "../src/features/reviews/use-cases.ts";
import type {
  AdminReviewItem,
  AdminReviewsFilter,
  PublicReviewItem,
  ReviewStatus,
  ViewerOwnReview,
} from "../src/features/reviews/types.ts";
import type { ProductDetail } from "../src/features/catalog/product-detail.ts";

const imageModule = new URL("../node_modules/next/image.js", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/image") return { url: `${imageModule}?node-interop`, shortCircuit: true };
    if (specifier.endsWith(".css")) {
      return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("?node-interop")) {
      return {
        format: "module",
        source: `import image from ${JSON.stringify(imageModule)}; export default image.default ?? image;`,
        shortCircuit: true,
      };
    }
    if (url.endsWith(".css")) {
      return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, prop) => String(prop) });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { ProductReviewsSection } = await import("../src/components/products/product-reviews-section.tsx");
const { ProductDetailView } = await import("../src/components/products/product-detail-view.tsx");
const { ProductRating } = await import("../src/components/products/product-rating.tsx");

interface StoredReview {
  id: number;
  productId: number;
  userId: number;
  orderItemId: number | null;
  rating: number;
  comment: string;
  status: ReviewStatus;
  adminReply: string | null;
  adminRepliedAt: Date | null;
  moderatedById: number | null;
  moderatedAt: Date | null;
  createdAt: Date;
}

function createMemoryReviewStore(seed?: {
  deliveredItems?: { id: number; userId: number; productId: number }[];
}) {
  const users = new Map<number, { fullName: string; email: string }>([
    [1, { fullName: "Nguyễn Minh Anh", email: "minhanh@example.com" }],
    [2, { fullName: "Trần Bảo Long", email: "baolong@example.com" }],
    [99, { fullName: "AUREL Admin", email: "admin@aurel.vn" }],
  ]);
  const products = new Map<number, { id: number; slug: string; name: string }>([
    [10, { id: 10, slug: "aurel-black-varsity", name: "AUREL - BLACK VARSITY" }],
  ]);
  const deliveredItems = seed?.deliveredItems ?? [
    { id: 501, userId: 1, productId: 10 },
    { id: 502, userId: 2, productId: 10 },
  ];
  const reviews: StoredReview[] = [];
  let nextId = 1;

  const toAdmin = (row: StoredReview): AdminReviewItem => {
    const product = products.get(row.productId)!;
    const user = users.get(row.userId)!;
    return {
      id: row.id,
      productId: row.productId,
      productName: product.name,
      productSlug: product.slug,
      userId: row.userId,
      customerName: user.fullName,
      customerEmail: user.email,
      orderItemId: row.orderItemId,
      rating: row.rating,
      comment: row.comment,
      status: row.status,
      adminReply: row.adminReply,
      adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null,
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  };

  const toOwn = (row: StoredReview): ViewerOwnReview => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    adminReply: row.adminReply,
    adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null,
  });

  const store: ReviewStore = {
    async findActiveProduct({ productId, productSlug }) {
      for (const product of products.values()) {
        if ((productId && product.id === productId) || (productSlug && product.slug === productSlug)) {
          return { id: product.id };
        }
      }
      return null;
    },
    async runLockedForUser(userId, work) {
      return work({
        findExistingReview: async (u, p) => {
          const found = reviews.find(r => r.userId === u && r.productId === p);
          return found ? toOwn(found) : null;
        },
        findEligibleDeliveredOrderItem: async (u, p) => {
          const found = deliveredItems.find(item => item.userId === u && item.productId === p);
          return found?.id ?? null;
        },
        createReview: async data => {
          const created: StoredReview = {
            id: nextId++,
            productId: data.productId,
            userId: data.userId,
            orderItemId: data.orderItemId,
            rating: data.rating,
            comment: data.comment,
            status: data.status,
            adminReply: null,
            adminRepliedAt: null,
            moderatedById: null,
            moderatedAt: null,
            createdAt: new Date("2026-11-13T10:00:00.000Z"),
          };
          reviews.push(created);
          return { id: created.id, status: created.status };
        },
      });
    },
    async listApprovedReviews(productId, viewerUserId) {
      return reviews
        .filter(r => r.productId === productId && r.status === "APPROVED")
        .map((r): PublicReviewItem => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          authorName: users.get(r.userId)?.fullName ?? "Khách hàng",
          createdAt: r.createdAt.toISOString(),
          adminReply: r.adminReply,
          adminRepliedAt: r.adminRepliedAt?.toISOString() ?? null,
          isOwn: viewerUserId != null && r.userId === viewerUserId,
        }));
    },
    async findExistingReview(userId, productId) {
      const found = reviews.find(r => r.userId === userId && r.productId === productId);
      return found ? toOwn(found) : null;
    },
    async findEligibleDeliveredOrderItem(userId, productId) {
      const found = deliveredItems.find(item => item.userId === userId && item.productId === productId);
      return found?.id ?? null;
    },
    async listAdminReviews(filter: AdminReviewsFilter) {
      const counts = {
        ALL: reviews.length,
        PENDING: reviews.filter(r => r.status === "PENDING").length,
        APPROVED: reviews.filter(r => r.status === "APPROVED").length,
        HIDDEN: reviews.filter(r => r.status === "HIDDEN").length,
      };
      const filtered = filter === "ALL" ? reviews : reviews.filter(r => r.status === filter);
      return { counts, reviews: filtered.map(toAdmin) };
    },
    async findReviewById(reviewId) {
      const found = reviews.find(r => r.id === reviewId);
      return found ? toAdmin(found) : null;
    },
    async updateOwnReview({ reviewId, rating, comment, status }) {
      const found = reviews.find(r => r.id === reviewId)!;
      found.rating = rating;
      found.comment = comment;
      found.status = status;
      return toOwn(found);
    },
    async deleteOwnReview(reviewId) {
      const index = reviews.findIndex(r => r.id === reviewId);
      if (index !== -1) reviews.splice(index, 1);
    },
    async updateReviewModeration({ reviewId, status, adminReply, moderatedById, now }) {
      const found = reviews.find(r => r.id === reviewId)!;
      if (status !== undefined) found.status = status;
      if (adminReply !== undefined) {
        found.adminReply = adminReply;
        found.adminRepliedAt = adminReply ? now : null;
      }
      found.moderatedById = moderatedById;
      found.moderatedAt = now;
      return toAdmin(found);
    },
  };

  return { store, reviews };
}

test("Case 1: eligible delivered customer submits, edits, and deletes own review (others blocked)", async () => {
  const { store, reviews } = createMemoryReviewStore();
  const res = await submitReviewUseCase(
    { id: 1, role: "CUSTOMER" },
    { productSlug: "aurel-black-varsity", rating: 5, comment: "Chất vải dày dặn, form varsity chuẩn." },
    store,
  );
  assert.equal(res.review.status, "APPROVED");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].orderItemId, 501);

  await assert.rejects(
    () => editReviewUseCase({ id: 2, role: "CUSTOMER" }, { reviewId: res.review.id, rating: 1, comment: "Sửa trộm" }, store),
    (err: unknown) => err instanceof ShopError && err.status === 403,
  );
  const edited = await editReviewUseCase(
    { id: 1, role: "CUSTOMER" },
    { reviewId: res.review.id, rating: 4, comment: "Đã sửa bình luận" },
    store,
  );
  assert.equal(edited.review.rating, 4);
  assert.equal(edited.review.comment, "Đã sửa bình luận");
  assert.equal(edited.review.status, "APPROVED");

  await assert.rejects(
    () => deleteReviewUseCase({ id: 2, role: "CUSTOMER" }, { reviewId: res.review.id }, store),
    (err: unknown) => err instanceof ShopError && err.status === 403,
  );
  await deleteReviewUseCase({ id: 1, role: "CUSTOMER" }, { reviewId: res.review.id }, store);
  assert.equal(reviews.length, 0);
});

test("Case 2: account without a purchase can submit a rating without inventing an order", async () => {
  const { store, reviews } = createMemoryReviewStore({ deliveredItems: [{ id: 501, userId: 1, productId: 999 }] });
  await submitReviewUseCase(
        { id: 1, role: "CUSTOMER" },
        { productId: 10, rating: 5, comment: "Chưa nhận hàng vẫn đánh giá" },
        store,
      );
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].orderItemId, null);
  assert.equal(reviews[0].status, "APPROVED");
});

test("Case 3: duplicate review submission for the same product is blocked", async () => {
  const { store, reviews } = createMemoryReviewStore();
  await submitReviewUseCase(
    { id: 1, role: "CUSTOMER" },
    { productId: 10, rating: 5, comment: "Lần đầu hợp lệ" },
    store,
  );
  await assert.rejects(
    () =>
      submitReviewUseCase(
        { id: 1, role: "CUSTOMER" },
        { productId: 10, rating: 4, comment: "Gửi trùng lần 2" },
        store,
      ),
    (err: unknown) => err instanceof ShopError && err.status === 409,
  );
  assert.equal(reviews.length, 1);
});

test("Case 4: invalid rating outside 1..5 or invalid comment length is rejected", async () => {
  const { store } = createMemoryReviewStore();
  for (const badInput of [
    { productId: 10, rating: 0, comment: "Sao bằng 0" },
    { productId: 10, rating: 6, comment: "Sao bằng 6" },
    { productId: 10, rating: 4.5, comment: "Số thập phân" },
    { productId: 10, rating: 5, comment: "   " },
    { productId: 10, rating: 5, comment: "a".repeat(1001) },
  ]) {
    await assert.rejects(
      () => submitReviewUseCase({ id: 1, role: "CUSTOMER" }, badInput, store),
      (err: unknown) => err instanceof ShopError && err.status === 400,
    );
  }
});

test("Case 5: CUSTOMER role cannot list or moderate reviews in admin", async () => {
  const { store } = createMemoryReviewStore();
  await submitReviewUseCase(
    { id: 1, role: "CUSTOMER" },
    { productId: 10, rating: 5, comment: "Đợi duyệt" },
    store,
  );
  await assert.rejects(
    () => listAdminReviewsUseCase({ id: 1, role: "CUSTOMER" }, "ALL", store),
    (err: unknown) => err instanceof ShopError && err.status === 403,
  );
  await assert.rejects(
    () => moderateReviewUseCase({ id: 1, role: "CUSTOMER" }, { reviewId: 1, status: "APPROVED" }, store),
    (err: unknown) => err instanceof ShopError && err.status === 403,
  );
});

test("Case 6: PENDING review never appears publicly or affects public rating summary", async () => {
  const { store, reviews } = createMemoryReviewStore();
  await submitReviewUseCase(
    { id: 1, role: "CUSTOMER" },
    { productId: 10, rating: 5, comment: "Chưa được admin duyệt" },
    store,
  );
  // Legacy pending records remain private; new submissions publish immediately.
  reviews[0].status = "PENDING";
  const publicView = await getPublicReviewsUseCase(10, 1, store);
  assert.equal(publicView.reviews.length, 0);
  assert.equal(publicView.summary, null);
  assert.equal(publicView.viewer.reason, "ALREADY_REVIEWED");
  assert.equal(publicView.viewer.ownReview?.status, "PENDING");
});

test("Case 7: Admin approve and hide recalculates count and average rating accurately", async () => {
  const { store } = createMemoryReviewStore();
  const r1 = await submitReviewUseCase({ id: 1, role: "CUSTOMER" }, { productId: 10, rating: 5, comment: "Rất ưng ý" }, store);
  const r2 = await submitReviewUseCase({ id: 2, role: "CUSTOMER" }, { productId: 10, rating: 4, comment: "Đường may đẹp" }, store);

  await moderateReviewUseCase(
    { id: 99, role: "ADMIN" },
    { reviewId: r1.review.id, status: "APPROVED", adminReply: "AUREL cảm ơn bạn!" },
    store,
  );
  await moderateReviewUseCase(
    { id: 99, role: "ADMIN" },
    { reviewId: r2.review.id, status: "APPROVED" },
    store,
  );

  let publicView = await getPublicReviewsUseCase(10, null, store);
  assert.deepEqual(publicView.summary, { average: 4.5, count: 2 });
  assert.equal(publicView.reviews.length, 2);
  assert.equal(publicView.reviews[0].adminReply, "AUREL cảm ơn bạn!");

  await moderateReviewUseCase({ id: 99, role: "ADMIN" }, { reviewId: r2.review.id, status: "HIDDEN" }, store);
  publicView = await getPublicReviewsUseCase(10, null, store);
  assert.deepEqual(publicView.summary, { average: 5, count: 1 });
  assert.equal(publicView.reviews.length, 1);

  await moderateReviewUseCase({ id: 99, role: "ADMIN" }, { reviewId: r1.review.id, status: "HIDDEN" }, store);
  publicView = await getPublicReviewsUseCase(10, null, store);
  assert.equal(publicView.summary, null);
  assert.equal(publicView.reviews.length, 0);
});

test("Case 8: HTML and script payloads in review and reply render safely as plain text", () => {
  const payload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(
    <ProductReviewsSection
      productSlug="aurel-black-varsity"
      productName="AUREL - BLACK VARSITY"
      initialData={{
        available: true,
        summary: { average: 5, count: 1 },
        reviews: [
          {
            id: 1,
            rating: 5,
            comment: payload,
            authorName: "Khách kiểm thử",
            createdAt: "2026-11-13T10:00:00.000Z",
            adminReply: "<b>Phản hồi</b>",
            adminRepliedAt: "2026-11-13T11:00:00.000Z",
          },
        ],
        viewer: { canSubmit: false, reason: "UNAUTHENTICATED", ownReview: null },
      }}
    />,
  );

  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /<img\s+src=x/i);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;b&gt;Phản hồi&lt;\/b&gt;/);
});

test("Case 9: ProductDetailView renders 5-star rating above price, sticky gallery wrapper, and reviewsSlot below You May Also Like", () => {
  const sampleProduct: ProductDetail = {
    slug: "aurel-black-varsity",
    name: "AUREL - BLACK VARSITY",
    brand: "AUREL",
    description: "Áo khoác varsity đen",
    category: { name: "Áo khoác", slug: "ao-khoac" },
    currency: "VND",
    variants: [
      { id: "1", sku: "AUR-VAR-M", color: "Đen", size: "M", stock: 50, price: { amount: "399000", currency: "VND" } },
    ],
    images: [],
    rating: { average: 5, count: 1 },
  };
  const html = renderToStaticMarkup(
    <ProductDetailView
      product={sampleProduct}
      mode="preview"
      related={{ look: [], similar: [] }}
      reviewsSlot={
        <ProductReviewsSection
          productSlug="aurel-black-varsity"
          productName="AUREL - BLACK VARSITY"
          initialData={{
            available: true,
            summary: { average: 5, count: 1 },
            reviews: [],
            viewer: { canSubmit: false, reason: "UNAUTHENTICATED", ownReview: null },
          }}
        />
      }
    />,
  );
  const ratingPos = html.indexOf("5 trên 5 sao");
  const pricePos = html.indexOf("399.000");
  const youMayLikePos = html.indexOf("You May Also Like");
  const reviewsPos = html.indexOf("Bình luận &amp; Đánh giá (AUREL - BLACK VARSITY)");
  const infoEndPos = html.indexOf("</section></div>", reviewsPos);
  assert.ok(html.includes("gallerySticky"), "Expected sticky gallery wrapper");
  assert.ok(ratingPos !== -1, "Expected star rating markup");
  assert.ok(pricePos !== -1, "Expected price markup");
  assert.ok(youMayLikePos !== -1, "Expected You May Also Like section");
  assert.ok(reviewsPos !== -1, "Expected ProductReviewsSection markup");
  assert.ok(infoEndPos !== -1, "Expected reviewsSlot inside right-hand information section");
  assert.ok(ratingPos < pricePos, "Expected star rating block to appear before price row");
  assert.ok(youMayLikePos < reviewsPos, "Expected reviews section to appear below You May Also Like");
});

test("Case 10: ProductRating never fabricates public ratings when absent and toggles DEMO in preview", () => {
  assert.equal(renderToStaticMarkup(<ProductRating rating={null} preview={false} />), "");
  const previewHtml = renderToStaticMarkup(<ProductRating rating={null} preview={true} />);
  assert.match(previewHtml, /DEMO · Chưa có đánh giá thực/);
  const realHtml = renderToStaticMarkup(<ProductRating rating={{ average: 4.5, count: 2 }} preview={true} />);
  assert.match(realHtml, /4\.5/);
  assert.match(realHtml, /\(2 reviews\)/);
  assert.doesNotMatch(realHtml, /DEMO/);
});
