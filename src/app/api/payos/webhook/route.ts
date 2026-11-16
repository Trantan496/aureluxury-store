import { verifiedWebhook } from "@/features/payments/service";
import { paymentBody, paymentResponse } from "@/features/payments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return paymentResponse(async () => verifiedWebhook(await paymentBody(request, false)));
}
