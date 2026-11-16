import "server-only";
import { prisma } from "@/lib/db/client";
import { resolveProductSession } from "@/lib/auth-session";
import { shopActor } from "@/features/shop/service";
import { ShopError } from "@/features/shop/rules";
import { postComment, removeComment, type CommentStore } from "./comment-use-cases";

export async function listProductComments(slug: string) {
  const product = await prisma.product.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
  const session = await resolveProductSession();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } }) : null;
  const rows = await prisma.$queryRaw<{ id: number; userId: number; comment: string; authorName: string; createdAt: Date }[]>`
    SELECT c.id, c."userId", c.comment, u."fullName" AS "authorName", c."createdAt"
    FROM "ProductComment" c JOIN "User" u ON u.id = c."userId"
    JOIN "PublicProductDiscussion" d ON d."commentId" = c.id
    WHERE c."productId" = ${product.id} ORDER BY c."createdAt" DESC, c.id DESC LIMIT 100`;
  return { signedIn: !!actor, comments: rows.map(row => ({ id: row.id, comment: row.comment, authorName: row.authorName.trim() || "Khách hàng", createdAt: row.createdAt.toISOString(), canDelete: actor?.role === "ADMIN" || actor?.id === row.userId })) };
}

const commentStore: CommentStore = {
 async create(userId, slug, comment) {
  const product = await prisma.product.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  if (!product) throw new ShopError("Không tìm thấy sản phẩm.", 404);
  // Serialize posting per account and cap rapid repeats, without requiring a purchase.
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const recent = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "ProductComment" WHERE "userId" = ${userId} AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '10 seconds' LIMIT 1`;
    if (recent.length) throw new ShopError("Bạn gửi quá nhanh. Vui lòng đợi 10 giây.", 429);
    await tx.$executeRaw`INSERT INTO "ProductComment" ("productId", "userId", comment) VALUES (${product.id}, ${userId}, ${comment})`;
  });
 },
 async delete(id, ownerId) {
  return ownerId === null
    ? await prisma.$executeRaw`DELETE FROM "ProductComment" WHERE id = ${id}`
    : await prisma.$executeRaw`DELETE FROM "ProductComment" WHERE id = ${id} AND "userId" = ${ownerId}`;
 }
};
export async function createProductComment(input: Record<string, unknown>) {
  return postComment(await shopActor(), input, commentStore);
}
export async function deleteProductComment(input: Record<string, unknown>) {
  return removeComment(await shopActor(), input, commentStore);
}
