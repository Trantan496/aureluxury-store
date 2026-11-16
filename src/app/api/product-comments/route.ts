import { paymentBody } from "@/features/payments/http";
import { reviewResponse } from "@/features/reviews/http";
import { createProductComment, deleteProductComment, listProductComments } from "@/features/reviews/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return reviewResponse(() => listProductComments(new URL(request.url).searchParams.get("productSlug") ?? ""));
}
export async function POST(request: Request) {
  return reviewResponse(async () => createProductComment(await paymentBody(request, true)));
}
export async function DELETE(request: Request) {
  return reviewResponse(async () => deleteProductComment(await paymentBody(request, true)));
}
