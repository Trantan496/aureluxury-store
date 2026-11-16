import "server-only";
import { ShopError } from "@/features/shop/rules";
import { paymentHeaders } from "@/features/payments/http";

export async function reviewResponse(work: () => Promise<unknown>) {
  try {
    return Response.json({ data: await work() }, { headers: paymentHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof ShopError ? error.message : "Dịch vụ đánh giá tạm thời không khả dụng." },
      { status: error instanceof ShopError ? error.status : 503, headers: paymentHeaders },
    );
  }
}
