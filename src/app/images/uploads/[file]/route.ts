import { prisma } from "@/lib/db/client";
import { createProductDataService } from "@/lib/products";
import { imageAssetId, readPublishedImage } from "@/features/products/image-storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Content-Type": "image/webp" };
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params, key = `/images/uploads/${file}`, id = imageAssetId(key);
  if (!id) return new Response(null, { status: 404, headers });
  try {
    // Re-evaluate permissions on every request; uploads are private until explicitly published.
    const published = await readPublishedImage(prisma, key);
    if (published) return new Response(published, { headers });
    const result = await createProductDataService().imageStored(id);
    if (result.ok) return new Response(result.data, { headers });
  } catch { /* No raw storage/session/database errors. */ }
  return new Response(null, { status: 404, headers });
}
