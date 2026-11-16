import { paymentOrderId, paymentStatus } from "@/features/payments/service";
import { paymentBody, paymentResponse } from "@/features/payments/http";
import { ShopError } from "@/features/shop/rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return paymentResponse(async () => {
    const values = new URL(request.url).searchParams.getAll("order");
    if (values.length !== 1 || !/^[1-9]\d{0,9}$/.test(values[0])) throw new ShopError("Mã đơn không hợp lệ.");
    const { orderId, userId } = await paymentOrderId(Number(values[0])); return paymentStatus(orderId, userId);
  });
}
export async function POST(request: Request) {
  return paymentResponse(async () => {
    const body = await paymentBody(request);
    if (body.action !== "reconcile" && body.action !== "cancel") throw new ShopError("Thao tác không hợp lệ.");
    const { orderId, userId } = await paymentOrderId(body.orderId); return paymentStatus(orderId, userId, body.action);
  });
}
