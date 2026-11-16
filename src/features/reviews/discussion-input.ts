import { ShopError, integer } from "../shop/rules.ts";
import { normalizeReviewText, validateReviewInput } from "./rules.ts";

export function discussionInput(input: Record<string, unknown>) {
  if (typeof input.productSlug !== "string" || !input.productSlug.trim() || input.productSlug.length > 250) throw new ShopError("Sản phẩm không hợp lệ.", 400);
  const comment = normalizeReviewText(input.comment, "Bình luận", 1, 1000);
  const parentId = input.parentId == null ? null : integer(input.parentId);
  const rating = input.rating == null ? null : validateReviewInput({ rating: input.rating, comment }).rating;
  if (parentId && rating !== null) throw new ShopError("Phản hồi không được kèm điểm sao.", 400);
  return { productSlug: input.productSlug, comment, parentId, rating };
}
export function discussionQuery(params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ShopError("Trang không hợp lệ.", 400);
  return { slug: params.get("productSlug") ?? "", oldest: params.get("sort") === "oldest", images: params.get("images") === "1", five: params.get("five") === "1", verified: params.get("verified") === "1", page };
}
