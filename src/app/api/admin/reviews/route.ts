import { paymentBody } from "@/features/payments/http";
import { reviewResponse } from "@/features/reviews/http";
import {
  adminListProductReviews,
  adminModerateProductReview,
  adminDeleteProductReview,
  adminSetAutoFiveStar,
} from "@/features/reviews/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return reviewResponse(async () => {
    const filter = new URL(request.url).searchParams.get("filter");
    return adminListProductReviews(filter);
  });
}

export async function POST(request: Request) {
  return reviewResponse(async () => {
    const body = await paymentBody(request, true);
    if (body.action === "auto_five_star") {
      return adminSetAutoFiveStar(body);
    }
    return adminModerateProductReview(body);
  });
}

export async function DELETE(request: Request) {
  return reviewResponse(async () => adminDeleteProductReview(await paymentBody(request, true)));
}
