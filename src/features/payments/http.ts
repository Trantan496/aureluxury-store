import "server-only";
import { ShopError } from "@/features/shop/rules";
import { assertAdminOrigin } from "@/features/products/admin-http";
export const paymentHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function paymentResponse(work: () => Promise<unknown>) {
  try { return Response.json({ data: await work() }, { headers: paymentHeaders }); }
  catch (error) { return Response.json({ error: error instanceof ShopError ? error.message : "Dịch vụ thanh toán tạm thời không khả dụng." }, { status: error instanceof ShopError ? error.status : 503, headers: paymentHeaders }); }
}
export async function paymentBody(request: Request, csrf = true): Promise<Record<string, unknown>> {
  if (csrf) {
    try { assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site")); }
    catch { throw new ShopError("Nguồn yêu cầu không hợp lệ.", 403); }
  }
  if (Number(request.headers.get("content-length") ?? 0) > 16384) throw new ShopError("Nội dung quá lớn.", 413);
  // Enforce a smaller streamed limit for public webhook input as well.
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ShopError("Yêu cầu JSON không hợp lệ.");
  const reader = request.body?.getReader();
  if (!reader) throw new ShopError("Thiếu nội dung.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16384) { await reader.cancel(); throw new ShopError("Nội dung quá lớn.", 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ShopError("JSON không hợp lệ.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ShopError("Nội dung không hợp lệ.");
  return body as Record<string, unknown>;
}
