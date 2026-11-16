import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { defaultAutoRatingStore } from "./auto-rating";
import { resolveProductSession } from "@/lib/auth-session";
import { shopActor } from "@/features/shop/service";
import { ShopError, integer } from "@/features/shop/rules";
import { discussionInput, discussionQuery } from "./discussion-input";
import type { DiscussionItem, DiscussionPayload } from "./discussion-types";

type Tx = Prisma.TransactionClient;
type Target = { id: number; userId: number; productId: number; reviewId: number | null; commentId: number | null; depth: number };
export type DiscussionImage = { data: Uint8Array; width: number; height: number };
async function viewer() {
  const session = await resolveProductSession();
  return session ? prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, fullName: true } }) : null;
}
async function eligible(db: Tx | typeof prisma, userId: number, productId: number) {
  return db.orderItem.findFirst({ where: { order: { userId, status: "DELIVERED" }, variant: { productId } }, select: { id: true }, orderBy: { id: "desc" } });
}
async function target(db: Tx, id: number, visible = true) {
  const rows = await db.$queryRaw<Target[]>`SELECT d.*, COALESCE(v.depth, 0) AS depth FROM "ProductDiscussion" d LEFT JOIN "PublicProductDiscussion" v ON v.id=d.id WHERE d.id=${id} AND (${!visible} OR v.id IS NOT NULL) FOR UPDATE OF d`;
  if (!rows[0]) throw new ShopError("Nội dung không còn hiển thị.", 404);
  return rows[0];
}
async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
      return work(tx);
    }, { isolationLevel: "Serializable", timeout: 20000 }); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue;
      if (code === "P2002") throw new ShopError("Bạn đã đánh giá sản phẩm này.", 409);
      throw error;
    }
  }
}

export async function getDiscussion(params: URLSearchParams): Promise<DiscussionPayload> {
  const query = discussionQuery(params);
  const product = await prisma.product.findFirst({ where: { slug: query.slug, isActive: true }, select: { id: true } });
  if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
  const [actor, autoState] = await Promise.all([viewer(), defaultAutoRatingStore.get()]);
  return prisma.$transaction(async tx => {
    const stats = await tx.$queryRaw<{ rating: number; count: number }[]>`SELECT r.rating, count(*)::int AS count FROM "PublicProductDiscussion" d JOIN "ProductReview" r ON r.id=d."reviewId" WHERE d."productId"=${product.id} GROUP BY r.rating`;
    const realDistribution = [1, 2, 3, 4, 5].map(score => stats.find(row => row.rating === score)?.count ?? 0);
    const realCount = realDistribution.reduce((a, b) => a + b, 0);
    const useAuto = realCount === 0 && autoState.enabled;
    const distribution = useAuto ? [0, 0, 0, 0, 1] : realDistribution;
    const count = useAuto ? 1 : realCount;
    const average = count ? Number((distribution.reduce((sum, n, index) => sum + n * (index + 1), 0) / count).toFixed(1)) : null;
    const filters = Prisma.sql`d."productId"=${product.id} AND d."parentId" IS NULL
      AND (${!query.five} OR r.rating=5)
      AND (${!query.images} OR EXISTS (SELECT 1 FROM "ProductDiscussionImage" i WHERE i."discussionId"=d.id))
      AND (${!query.verified} OR EXISTS (SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o.id=oi."orderId" JOIN "ProductVariant" v ON v.id=oi."variantId" WHERE o."userId"=d."userId" AND o.status='DELIVERED' AND v."productId"=d."productId"))`;
    const totals = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM "PublicProductDiscussion" d LEFT JOIN "ProductReview" r ON r.id=d."reviewId" WHERE ${filters}`);
    const roots = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT d.id FROM "PublicProductDiscussion" d LEFT JOIN "ProductReview" r ON r.id=d."reviewId" WHERE ${filters} ORDER BY d."createdAt" ${query.oldest ? Prisma.sql`ASC` : Prisma.sql`DESC`}, d.id ${query.oldest ? Prisma.sql`ASC` : Prisma.sql`DESC`} LIMIT 10 OFFSET ${(query.page - 1) * 10}`);
    const rows = roots.length ? await tx.$queryRaw<(Omit<DiscussionItem, "createdAt" | "adminRepliedAt"> & { createdAt: Date; adminRepliedAt: Date | null })[]>(Prisma.sql`
      SELECT d.id,d."parentId",d."rootId",d.depth,d."reviewId",u."fullName" AS "authorName",(u.role='ADMIN') AS official,
        EXISTS (SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o.id=oi."orderId" JOIN "ProductVariant" v ON v.id=oi."variantId" WHERE o."userId"=d."userId" AND o.status='DELIVERED' AND v."productId"=d."productId") AS verified,
        r.rating,COALESCE(r.comment,c.comment,d.body) AS comment,d."createdAt",r."adminReply",r."adminRepliedAt",
        (SELECT count(*)::int FROM "ProductDiscussionLike" l WHERE l."discussionId"=d.id) AS "likeCount",
        EXISTS (SELECT 1 FROM "ProductDiscussionLike" l WHERE l."discussionId"=d.id AND l."userId"=${actor?.id ?? 0}) AS liked,
        (${actor?.role === "ADMIN"} OR d."userId"=${actor?.id ?? 0}) AS "canDelete",
        COALESCE((SELECT json_agg(json_build_object('id',i.id,'width',i.width,'height',i.height) ORDER BY i.id) FROM "ProductDiscussionImage" i WHERE i."discussionId"=d.id),'[]'::json) AS images
      FROM "PublicProductDiscussion" d JOIN "User" u ON u.id=d."userId"
      LEFT JOIN "ProductReview" r ON r.id=d."reviewId" LEFT JOIN "ProductComment" c ON c.id=d."commentId"
      WHERE d."rootId" IN (${Prisma.join(roots.map(row => row.id))}) ORDER BY d."createdAt",d.id`) : [];
    const ownReview = actor ? await tx.productReview.findUnique({ where: { userId_productId: { userId: actor.id, productId: product.id } }, select: { id: true, rating: true, comment: true, status: true } }) : null;
    return { viewer: actor ? { name: actor.fullName, isAdmin: actor.role === "ADMIN" } : null, canRate: !!actor && !ownReview, ownReview, summary: { average, count, distribution }, items: rows.map(row => ({ ...row, authorName: row.authorName.trim() || "Khách hàng", createdAt: row.createdAt.toISOString(), adminRepliedAt: row.adminRepliedAt?.toISOString() ?? null })), total: totals[0].count, hasMore: query.page * 10 < totals[0].count };
  }, { isolationLevel: "RepeatableRead" });
}

export async function publishDiscussion(input: Record<string, unknown>, images: DiscussionImage[]) {
  const actor = await shopActor();
  const parsed = discussionInput(input);
  if (images.length > 3) throw new ShopError("Tối đa 3 ảnh mỗi bình luận.", 400);
  return transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
    const product = await tx.product.findFirst({ where: { slug: parsed.productSlug, isActive: true }, select: { id: true } });
    if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
    const recent = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "ProductDiscussion" WHERE "userId"=${actor.id} AND "createdAt">CURRENT_TIMESTAMP-INTERVAL '10 seconds' AND "createdAt"<=CURRENT_TIMESTAMP LIMIT 1`;
    if (recent.length) throw new ShopError("Bạn gửi quá nhanh. Vui lòng đợi 10 giây.", 429);
    let entryId: number;
    if (parsed.parentId) {
      const parent = await target(tx, parsed.parentId);
      if (parent.productId !== product.id) throw new ShopError("Phản hồi phải thuộc cùng sản phẩm.", 400);
      if (parent.depth >= 4) throw new ShopError("Đã đạt giới hạn 4 cấp trả lời. Hãy trả lời bình luận phía trên.", 400);
      const rows = await tx.$queryRaw<{ id: number }[]>`INSERT INTO "ProductDiscussion" ("productId","userId","parentId",body) VALUES (${product.id},${actor.id},${parent.id},${parsed.comment}) RETURNING id`;
      entryId = rows[0].id;
    } else if (parsed.rating !== null) {
      const orderItem = await eligible(tx, actor.id, product.id);
      const review = await tx.productReview.create({ data: { productId: product.id, userId: actor.id, orderItemId: orderItem?.id ?? null, rating: parsed.rating, comment: parsed.comment, status: "APPROVED" }, select: { id: true } });
      const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "ProductDiscussion" WHERE "reviewId"=${review.id}`;
      entryId = rows[0].id;
    } else {
      const rows = await tx.$queryRaw<{ id: number }[]>`INSERT INTO "ProductComment" ("productId","userId",comment) VALUES (${product.id},${actor.id},${parsed.comment}) RETURNING id`;
      const entries = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "ProductDiscussion" WHERE "commentId"=${rows[0].id}`;
      entryId = entries[0].id;
    }
    for (const image of images) await tx.$executeRaw`INSERT INTO "ProductDiscussionImage" (id,"discussionId",bytes,width,height) VALUES (${randomUUID()}::uuid,${entryId},${image.data},${image.width},${image.height})`;
    return { id: entryId };
  });
}

export async function changeDiscussion(input: Record<string, unknown>, remove = false) {
  const actor = await shopActor();
  const id = integer(input.id);
  return transaction(async tx => {
    const entry = await target(tx, id, !remove);
    if (remove) {
      if (entry.userId !== actor.id && actor.role !== "ADMIN") throw new ShopError("Bạn không có quyền xóa nội dung này.", 403);
      if (entry.reviewId) await tx.productReview.delete({ where: { id: entry.reviewId } });
      else if (entry.commentId) await tx.$executeRaw`DELETE FROM "ProductComment" WHERE id=${entry.commentId}`;
      else await tx.$executeRaw`DELETE FROM "ProductDiscussion" WHERE id=${id}`;
    } else if (input.action === "like") {
      if (typeof input.liked !== "boolean") throw new ShopError("Trạng thái thích không hợp lệ.", 400);
      if (input.liked) await tx.$executeRaw`INSERT INTO "ProductDiscussionLike" ("discussionId","userId") VALUES (${id},${actor.id}) ON CONFLICT DO NOTHING`;
      else await tx.$executeRaw`DELETE FROM "ProductDiscussionLike" WHERE "discussionId"=${id} AND "userId"=${actor.id}`;
    } else if (input.action === "hide") {
      if (actor.role !== "ADMIN") throw new ShopError("Chỉ shop có quyền ẩn nội dung.", 403);
      if (entry.reviewId) await tx.productReview.update({ where: { id: entry.reviewId }, data: { status: "HIDDEN", moderatedById: actor.id, moderatedAt: new Date() } });
      else await tx.$executeRaw`UPDATE "ProductDiscussion" SET hidden=true WHERE id=${id}`;
    } else throw new ShopError("Thao tác không hợp lệ.", 400);
    return { updated: true };
  });
}

export async function readDiscussionImage(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ShopError("Không tìm thấy ảnh.", 404);
  const rows = await prisma.$queryRaw<{ bytes: Uint8Array }[]>`SELECT i.bytes FROM "ProductDiscussionImage" i JOIN "PublicProductDiscussion" d ON d.id=i."discussionId" WHERE i.id=${id}::uuid`;
  if (!rows[0]) throw new ShopError("Không tìm thấy ảnh.", 404);
  return rows[0].bytes;
}
