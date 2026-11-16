import "server-only";
import { assertAdminOrigin } from "@/features/products/admin-http";
import { prepareImage } from "@/features/products/image-upload";
import { shopActor } from "@/features/shop/service";
import { ShopError } from "@/features/shop/rules";
import type { DiscussionImage } from "./discussion-service";

export async function discussionBody(request: Request) {
  try { assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site")); }
  catch { throw new ShopError("Nguồn yêu cầu không hợp lệ.", 403); }
  await shopActor();
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new ShopError("Yêu cầu không hợp lệ.", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new ShopError("Thiếu nội dung.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 13 * 1024 * 1024) { await reader.cancel(); throw new ShopError("Tối đa 3 ảnh, mỗi ảnh 4 MB.", 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
  catch { throw new ShopError("Nội dung không hợp lệ.", 400); }
  const files = form.getAll("images");
  if (files.length > 3) throw new ShopError("Tối đa 3 ảnh mỗi bình luận.", 400);
  const images: DiscussionImage[] = [];
  for (const file of files) {
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024 || !file.size) throw new ShopError("Chỉ nhận ảnh JPG, PNG, WebP tối đa 4 MB.", 400);
    try {
      const image = await prepareImage(new Uint8Array(await file.arrayBuffer()));
      if (image.data.length > 2 * 1024 * 1024) throw new Error();
      images.push(image);
    } catch { throw new ShopError("Không thể xử lý ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP khác.", 400); }
  }
  return { input: { productSlug: form.get("productSlug"), comment: form.get("comment"), parentId: form.get("parentId") ? Number(form.get("parentId")) : null, rating: form.get("rating") ? Number(form.get("rating")) : null }, images };
}
