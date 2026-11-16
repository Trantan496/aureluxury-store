import { ShopError, integer } from "../shop/rules.ts";
import { normalizeReviewText } from "./rules.ts";
import type { ReviewActor } from "./use-cases.ts";

export interface CommentStore {
  create(userId: number, slug: string, comment: string): Promise<void>;
  delete(id: number, ownerId: number | null): Promise<number>;
}
export async function postComment(actor: ReviewActor | null, input: Record<string, unknown>, store: CommentStore) {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để bình luận.", 401);
  const comment = normalizeReviewText(input.comment, "Bình luận", 1, 1000);
  if (typeof input.productSlug !== "string" || !input.productSlug.trim()) throw new ShopError("Thiếu sản phẩm.", 400);
  await store.create(actor.id, input.productSlug, comment);
  return { created: true };
}
export async function removeComment(actor: ReviewActor | null, input: Record<string, unknown>, store: CommentStore) {
  if (!actor) throw new ShopError("Vui lòng đăng nhập để xóa bình luận.", 401);
  const deleted = await store.delete(integer(input.commentId), actor.role === "ADMIN" ? null : actor.id);
  if (!deleted) throw new ShopError("Không tìm thấy bình luận hoặc bạn không có quyền xóa.", 404);
  return { deleted: true };
}
