import { NextResponse } from "next/server";
import { assertAdminOrigin } from "@/features/products/admin-http";
import { readImageBody } from "@/features/products/image-upload";
import { createProductDataService } from "@/lib/products";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function response(result: { ok: boolean; error?: { code: string } }) {
  const status = result.ok ? 200 : ({ UNAUTHENTICATED: 401, FORBIDDEN: 403, INVALID_INPUT: 400, CONFLICT: 409 } as Record<string, number>)[result.error?.code ?? ""] ?? 503;
  return NextResponse.json(result, { status, headers });
}
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return response(await createProductDataService().imageLibrary(Number(query.get("page") ?? 1), query.get("q") ?? ""));
}
export async function POST(request: Request) {
  try {
    assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site"));
    return response(await createProductDataService().imageUpload(() => readImageBody(request)));
  } catch { return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Ảnh không hợp lệ." } }, { status: 400, headers }); }
}
