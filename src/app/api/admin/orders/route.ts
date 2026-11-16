import { sellerOrders, sellerUpdateStatus } from "@/features/orders/seller-orders";
import { paymentBody, paymentResponse } from "@/features/payments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return paymentResponse(() => sellerOrders(new URL(request.url).searchParams)); }
export async function POST(request: Request) { return paymentResponse(async () => sellerUpdateStatus(await paymentBody(request))); }
