import { paymentBody } from "@/features/payments/http";
import { reviewResponse } from "@/features/reviews/http";
import {
  deleteCustomerReview,
  editCustomerReview,
  getPublicProductReviewsBySlugOrId,
  submitCustomerReview,
} from "@/features/reviews/service";
import { ShopError } from "@/features/shop/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return reviewResponse(async () => {
    const searchParams = new URL(request.url).searchParams;
    const rawProductId = searchParams.get("productId")?.trim();
    const productSlug = searchParams.get("productSlug")?.trim();

    if (rawProductId) {
      if (!/^[1-9]\d*$/.test(rawProductId)) {
        throw new ShopError("Mã sản phẩm không hợp lệ.", 400);
      }
      return getPublicProductReviewsBySlugOrId({ productId: Number(rawProductId) });
    }
    if (productSlug) {
      return getPublicProductReviewsBySlugOrId({ productSlug });
    }
    throw new ShopError("Thiếu thông tin sản phẩm cần xem đánh giá.", 400);
  });
}

export async function POST(request: Request) {
  return reviewResponse(async () => {
    const body = await paymentBody(request, true);
    return submitCustomerReview(body);
  });
}

export async function PATCH(request: Request) {
  return reviewResponse(async () => {
    const body = await paymentBody(request, true);
    return editCustomerReview(body);
  });
}

export async function DELETE(request: Request) {
  return reviewResponse(async () => {
    const body = await paymentBody(request, true);
    return deleteCustomerReview(body);
  });
}
