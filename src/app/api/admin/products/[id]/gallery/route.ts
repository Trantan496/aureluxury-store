import { NextResponse } from "next/server";
import { createProductDataService } from "@/lib/products";
import { assertAdminOrigin, readAdminJson } from "@/features/products/admin-http";
import { readImageBody } from "@/features/products/image-upload";
import { object } from "@/features/products/validation";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site"));
    const { id } = await params, service = createProductDataService();
    const json = request.headers.get("content-type")?.startsWith("application/json");
    const value = json ? object(await readAdminJson(request), ["version", "input"]) : null;
    const imageId = request.headers.get("x-image-id");
    const result = await service.managementGallery(Number(id), value?.version ?? request.headers.get("x-product-version"), value?.input ?? { operation: "upload", role: request.headers.get("x-image-role"), ...(imageId ? { imageId: Number(imageId) } : {}) }, json ? undefined : () => readImageBody(request));
    if (result.ok) { revalidatePath(`/products/${result.data.slug}`); revalidatePath("/products"); revalidatePath("/"); }
    return NextResponse.json(result, { headers, status: result.ok ? 200 : ({ UNAUTHENTICATED: 401, FORBIDDEN: 403, INVALID_INPUT: 400, NOT_FOUND: 404, CONFLICT: 409 } as Record<string, number>)[result.error.code] ?? 503 });
  } catch { return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Không thể cập nhật ảnh." } }, { status: 400, headers }); }
}
