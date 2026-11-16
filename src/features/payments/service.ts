import "server-only";
import QRCode from "qrcode";
import type { Prisma } from "@/generated/prisma/client";
import type { Webhook, WebhookData } from "@payos/node/lib/resources/webhooks/webhook";
import { prisma } from "@/lib/db/client";
import { ShopError, integer } from "@/features/shop/rules";
import { shopActor } from "@/features/shop/service";
import { assertOwnedOrder, assertPaymentMatch, hostedCheckout, payableAmount, paymentConfig, pendingPayment, type PaymentView } from "./rules";
import { payosClient } from "./provider";

type Tx = Prisma.TransactionClient;
// Optional table reads keep COD functional before the additive migration deploys.
export async function paymentsAvailable() {
  const rows = await prisma.$queryRaw<{ available: boolean }[]>`SELECT to_regclass('public."OnlinePayment"') IS NOT NULL AND to_regclass('public."PaymentAttempt"') IS NOT NULL AND to_regclass('public."PaymentReceipt"') IS NOT NULL AS available`;
  return rows[0]?.available === true;
}
export async function requirePayments() {
  paymentConfig(process.env);
  if (!await paymentsAvailable()) throw new ShopError("Thanh toán trực tuyến đang được thiết lập. Vui lòng thử lại sau.", 503);
}
async function locked<T>(orderId: number, work: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
        return work(tx);
      }, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}
async function owned(orderId: number, userId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { onlinePayment: true } });
  assertOwnedOrder(order, userId);
  if (!order?.onlinePayment) throw new ShopError("Đơn này không sử dụng payOS.", 409);
  return order;
}
export async function paymentView(orderId: number, userId: number): Promise<PaymentView> {
  await owned(orderId, userId);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, onlinePayment: { include: { attempts: { orderBy: { orderCode: "desc" }, take: 1 } } } } });
  const payment = order.onlinePayment!, attempt = payment.attempts[0];
  return {
    orderId, orderNumber: order.orderNumber, orderStatus: order.status,
    status: payment.paidAt ? "PAID" : attempt?.status ?? "PROCESSING",
    amount: order.totalAmount.toString(), paidAt: payment.paidAt?.toISOString() ?? null, reconciliationRequired: payment.reconciliationRequired,
    checkoutUrl: attempt?.checkoutUrl ?? null,
    qrImage: attempt?.qrCode && pendingPayment(attempt.status) && !payment.paidAt ? await QRCode.toDataURL(attempt.qrCode, { width: 320, margin: 4, errorCorrectionLevel: "M" }) : null,
    bankBin: attempt?.bankBin ?? null, accountName: attempt?.accountName ?? null, accountNumber: attempt?.accountNumber ?? null,
    description: attempt?.description ?? null, expiresAt: attempt?.expiresAt.toISOString() ?? null,
    items: order.items.map(({ productName, quantity, color, size }) => ({ productName, quantity, color, size })), shippingName: order.shippingName, shippingAddress: order.shippingAddress,
  };
}

// Called only with data returned by SDK signature verification, or signed API GET.
export async function recordPayment(data: WebhookData, transactions?: { reference: string; amount: number }[], confirmed = true) {
  if (!Number.isSafeInteger(data.orderCode) || data.orderCode < 1) throw new ShopError("Mã thanh toán không hợp lệ.");
  const attempt = await prisma.paymentAttempt.findUnique({ where: { orderCode: BigInt(data.orderCode) } });
  // Includes payOS registration probes: acknowledge, never create an order.
  if (!attempt) return { ignored: true };
  return locked(attempt.orderId, async tx => {
    const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { orderCode: attempt.orderCode } });
    // Identity/currency must match even when the received amount needs reconciliation.
    assertPaymentMatch(current, { ...data, amount: payableAmount(current.expectedAmount.toString(), "VND") });
    if (data.code !== "00") return { ignored: true };
    if (!data.reference || data.reference.length > 200) throw new ShopError("Tham chiếu thanh toán không hợp lệ.");
    if (!Number.isSafeInteger(data.amount) || data.amount <= 0) throw new ShopError("Số tiền nhận không hợp lệ.");
    for (const receipt of transactions ?? [{ reference: data.reference, amount: data.amount }]) {
      if (!receipt.reference || receipt.reference.length > 200 || !Number.isSafeInteger(receipt.amount) || receipt.amount <= 0) throw new ShopError("Giao dịch không hợp lệ.");
      const prior = await tx.paymentReceipt.findUnique({ where: { reference: receipt.reference } });
      if (prior && (prior.orderCode !== current.orderCode || prior.amount.toString() !== String(receipt.amount))) throw new ShopError("Tham chiếu giao dịch không khớp.", 409);
      if (!prior) await tx.paymentReceipt.create({ data: { ...receipt, orderCode: current.orderCode, currency: "VND" } });
    }
    if (!confirmed || data.amount !== payableAmount(current.expectedAmount.toString(), "VND")) {
      await tx.onlinePayment.update({ where: { orderId: current.orderId }, data: { reconciliationRequired: true } });
      return { received: true, reconciliationRequired: true };
    }
    if (current.status === "PAID") {
      if (current.reference !== data.reference && !current.transactionReferences.includes(data.reference)) {
        await tx.paymentAttempt.update({ where: { orderCode: current.orderCode }, data: { transactionReferences: { push: data.reference } } });
        await tx.onlinePayment.update({ where: { orderId: current.orderId }, data: { reconciliationRequired: true } });
      }
      return { duplicate: true };
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: current.orderId }, include: { onlinePayment: true } });
    const late = order.status === "CANCELLED" || current.status === "EXPIRED" || current.status === "CANCELLED" || !!order.onlinePayment?.paidAt;
    const paidAt = new Date();
    await tx.paymentAttempt.update({ where: { orderCode: current.orderCode }, data: { status: "PAID", paidAmount: data.amount, reference: data.reference, transactionReferences: [data.reference], paidAt, paymentLinkId: data.paymentLinkId, leaseUntil: null } });
    await tx.onlinePayment.update({ where: { orderId: order.id }, data: { paidAt: order.onlinePayment?.paidAt ?? paidAt, ...(late ? { reconciliationRequired: true } : {}) } });
    // Inventory was reserved exactly once at checkout. Fulfillment remains manual.
    return { received: true, reconciliationRequired: late };
  });
}

async function synchronize(orderCode: bigint, cancel = false) {
  const client = payosClient();
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderCode } });
  const remote = cancel ? await client.paymentRequests.cancel(Number(orderCode), "Khach huy thanh toan") : await client.paymentRequests.get(Number(orderCode));
  assertPaymentMatch(attempt, { orderCode: remote.orderCode, amount: remote.amount, currency: "VND", paymentLinkId: remote.id });
  if (remote.amountPaid > 0 && remote.status !== "PAID") {
    if (remote.transactions.length) await recordPayment({ orderCode: remote.orderCode, amount: remote.amountPaid, paymentLinkId: remote.id, reference: remote.transactions[0].reference, currency: "VND", code: "00", desc: "", accountNumber: "", description: "", transactionDateTime: "" }, remote.transactions, false);
    else await prisma.onlinePayment.update({ where: { orderId: attempt.orderId }, data: { reconciliationRequired: true } });
  }
  if (remote.status === "PAID") {
    if (!remote.transactions.length) {
      await prisma.onlinePayment.update({ where: { orderId: attempt.orderId }, data: { reconciliationRequired: true } });
      throw new ShopError("Số tiền nhận cần đối soát.", 409);
    }
    const reference = remote.transactions[0].reference;
    await recordPayment({ orderCode: remote.orderCode, amount: remote.amountPaid, paymentLinkId: remote.id, reference: attempt.reference ?? reference, currency: "VND", code: "00", desc: "", accountNumber: "", description: "", transactionDateTime: "" }, remote.transactions, remote.amountPaid === remote.amount && remote.amountRemaining === 0);
    await locked(attempt.orderId, async tx => {
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { orderCode } });
      await tx.paymentAttempt.update({ where: { orderCode }, data: { transactionReferences: [...new Set([...current.transactionReferences, ...remote.transactions.map(item => item.reference)])] } });
    });
  } else {
    await locked(attempt.orderId, async tx => {
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { orderCode } });
      if (current.status === "PAID") return;
      const status = remote.status === "UNDERPAID" ? "PROCESSING" : remote.status;
      await tx.paymentAttempt.update({ where: { orderCode }, data: { status, paymentLinkId: remote.id, lastCheckedAt: new Date(), leaseUntil: null } });
    });
  }
  return remote;
}

export async function createPayment(orderId: number, userId: number) {
  await requirePayments();
  await owned(orderId, userId);
  const claim = await locked(orderId, async tx => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { onlinePayment: true, items: true } });
    assertOwnedOrder(order, userId);
    if (order.onlinePayment?.paidAt || order.onlinePayment?.reconciliationRequired || order.status !== "PENDING") throw new ShopError("Đơn đã thanh toán, cần đối soát hoặc không còn chờ thanh toán.", 409);
    const amount = payableAmount(order.totalAmount.toString(), order.currency);
    if (order.items.reduce((sum, item) => sum + BigInt(item.lineTotal?.toString() ?? "0"), BigInt(0)) - BigInt(order.discountAmount.toString()) !== BigInt(amount)) throw new ShopError("Tổng tiền đơn không khớp.", 409);
    const latest = await tx.paymentAttempt.findFirst({ where: { orderId }, orderBy: { orderCode: "desc" } });
    if (latest && pendingPayment(latest.status) && latest.checkoutUrl && latest.expiresAt.getTime() > Date.now()) return { attempt: latest, work: false, fresh: false };
    if (latest?.leaseUntil && latest.leaseUntil.getTime() > Date.now()) return { attempt: latest, work: false, fresh: false };
    const leaseUntil = new Date(Date.now() + 30000);
    if (latest && pendingPayment(latest.status)) {
      await tx.paymentAttempt.update({ where: { orderCode: latest.orderCode }, data: { leaseUntil } });
      return { attempt: latest, work: true, fresh: false };
    }
    const attempt = await tx.paymentAttempt.create({ data: { orderId, expectedAmount: amount, description: `A${orderId.toString(36).toUpperCase()}`.slice(0, 9), expiresAt: new Date(Date.now() + 15 * 60000), leaseUntil } });
    return { attempt, work: true, fresh: true };
  });
  if (!claim.work) return paymentView(orderId, userId);
  const { attempt } = claim;
  try {
    if (!claim.fresh) {
      try {
        const remote = await synchronize(attempt.orderCode);
        if (remote.status !== "PENDING" || attempt.checkoutUrl || remote.amountPaid > 0) return paymentView(orderId, userId);
        // Existing provider session after a lost create response: official hosted fallback.
        await prisma.paymentAttempt.updateMany({ where: { orderCode: attempt.orderCode, status: { not: "PAID" } }, data: { checkoutUrl: hostedCheckout(`https://pay.payos.vn/web/${remote.id}`) } });
        return paymentView(orderId, userId);
      } catch (error) {
        const providerError = error as { code?: string; status?: number; desc?: string };
        const missing = providerError.code === "231" || providerError.status === 404 || (providerError.code === "101" && providerError.desc === "Mã thanh toán không tồn tại");
        if (!missing) throw error;
      }
    }
    if (attempt.expiresAt.getTime() <= Date.now()) {
      await prisma.paymentAttempt.updateMany({ where: { orderCode: attempt.orderCode, status: { not: "PAID" } }, data: { status: "EXPIRED", leaseUntil: null } });
      return paymentView(orderId, userId);
    }
    const { origin } = paymentConfig(process.env);
    const remote = await payosClient().paymentRequests.create({ orderCode: Number(attempt.orderCode), amount: payableAmount(attempt.expectedAmount.toString(), "VND"), description: attempt.description, expiredAt: Math.floor(attempt.expiresAt.getTime() / 1000), returnUrl: `${origin}/checkout/success?order=${orderId}`, cancelUrl: `${origin}/checkout/cancel?order=${orderId}` });
    assertPaymentMatch(attempt, remote);
    const checkoutUrl = hostedCheckout(remote.checkoutUrl);
    await locked(orderId, async tx => {
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { orderCode: attempt.orderCode } });
      await tx.paymentAttempt.update({ where: { orderCode: attempt.orderCode }, data: { checkoutUrl, qrCode: remote.qrCode, bankBin: remote.bin, accountName: remote.accountName, accountNumber: remote.accountNumber, description: remote.description, paymentLinkId: remote.paymentLinkId, status: current.status === "PAID" ? "PAID" : "PENDING", leaseUntil: null } });
    });
    return paymentView(orderId, userId);
  } catch {
    // Uncertain network outcome MUST keep the same code, including a lost success response.
    await prisma.paymentAttempt.updateMany({ where: { orderCode: attempt.orderCode, status: { in: ["PROCESSING", "PENDING"] } }, data: { leaseUntil: null } });
    throw new ShopError("Chưa thể tải phiên payOS. Đơn hàng đã được giữ; bấm Thử lại để tiếp tục cùng đơn.", 502);
  }
}

export async function paymentStatus(orderId: number, userId: number, action?: "reconcile" | "cancel") {
  await owned(orderId, userId);
  if (action) {
    const attempt = await locked(orderId, async tx => {
      const row = await tx.paymentAttempt.findFirst({ where: { orderId }, orderBy: { orderCode: "desc" } });
      if (!row || row.status === "PAID" || (row.leaseUntil && row.leaseUntil.getTime() > Date.now()) || (action === "reconcile" && row.lastCheckedAt && row.lastCheckedAt.getTime() > Date.now() - 30000)) return null;
      await tx.paymentAttempt.update({ where: { orderCode: row.orderCode }, data: { leaseUntil: new Date(Date.now() + 30000), lastCheckedAt: new Date() } });
      return row;
    });
    if (attempt) {
      try { await synchronize(attempt.orderCode, action === "cancel"); }
      catch { throw new ShopError("Chưa thể đối chiếu với payOS. Vui lòng thử lại sau.", 502); }
    }
  }
  return paymentView(orderId, userId);
}
export async function verifiedWebhook(payload: unknown) {
  let data: WebhookData;
  try { data = await payosClient().webhooks.verify(payload as Webhook); }
  catch { throw new ShopError("Chữ ký webhook không hợp lệ.", 400); }
  // Only the signed inner code is authoritative; outer success is not signed.
  return recordPayment(data);
}
export async function paymentOrderId(value: unknown) {
  const actor = await shopActor();
  const orderId = integer(value);
  return { orderId, userId: actor.id };
}
