import { shopRead, shopWrite } from "@/features/shop/service";
import { ShopError } from "@/features/shop/rules";
import { assertAdminOrigin, readAdminJson } from "@/features/products/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function respond(run: () => Promise<unknown>) {
  try { return Response.json({ data: await run() }, { headers }); }
  catch (error) {
    const known = error instanceof ShopError;
    return Response.json({ error: known ? error.message : "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại." }, { status: known ? error.status : 503, headers });
  }
}
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawVariantId = searchParams.get("variantId");
  const input = rawVariantId === null ? {} : { buyNowVariantId: Number(rawVariantId) };
  return respond(() => shopRead(searchParams.get("view") ?? "cart", input));
}
export async function POST(request: Request) {
  return respond(async () => {
    try { assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site")); }
    catch { throw new ShopError("Nguồn yêu cầu không hợp lệ. Mở website bằng địa chỉ đã cấu hình.", 403); }
    let body: unknown;
    try { body = await readAdminJson(request); } catch { throw new ShopError("Nội dung yêu cầu không hợp lệ."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ShopError("Nội dung yêu cầu không hợp lệ.");
    return shopWrite(body as Record<string, unknown>);
  });
}
