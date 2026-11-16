import { createPayment, paymentOrderId } from "@/features/payments/service";
import { paymentBody, paymentResponse } from "@/features/payments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return paymentResponse(async () => { const body = await paymentBody(request); const { orderId, userId } = await paymentOrderId(body.orderId); return createPayment(orderId, userId); });
}
