import { readDiscussionImage } from "@/features/reviews/discussion-service";
import { ShopError } from "@/features/shop/rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return new Response(new Uint8Array(await readDiscussionImage((await params).id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return new Response(null, { status: error instanceof ShopError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } }); }
}
