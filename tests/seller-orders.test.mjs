import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { PayOS } from '@payos/node';

// Isolated DB/session/provider fixtures. Never connect to a real bank or database.
let actorRole, orders, payments, attempts, receipts, writes, stockWrites, tail;
const sdk = new PayOS({ clientId: 'fixture', apiKey: 'fixture', checksumKey: 'fixture-checksum', logLevel: 'off', fetch: async () => { throw new Error('Network is forbidden'); } });
const fixtureOrder = id => ({ id, userId: 20, orderNumber: `DEMO-20-fixture-${id}`, status: 'PENDING', totalAmount: '500000', subtotalAmount: '500000', discountAmount: '0', currency: 'VND', voucherCode: null, createdAt: new Date(1700000000000 + id), shippingName: 'Fixture', shippingPhone: '0000000000', shippingAddress: 'Fixture only', items: [{ productName: 'Fixture item', sku: `FIX-${id}`, color: 'black', size: 'M', quantity: 1, unitPrice: '500000', lineTotal: '500000' }] });
function withPayment(order) { return { ...order, onlinePayment: payments.get(order.id) ?? null }; }
function matches(order, where = {}) {
  if (where.OR && !where.OR.some(condition => matches(order, condition))) return false;
  if (where.id !== undefined && order.id !== where.id) return false;
  if (where.userId !== undefined && order.userId !== where.userId) return false;
  if (where.status && (typeof where.status === 'string' ? order.status !== where.status : !where.status.in.includes(order.status))) return false;
  if (where.orderNumber?.startsWith && !order.orderNumber.startsWith(where.orderNumber.startsWith)) return false;
  if (where.onlinePayment) {
    const p = payments.get(order.id), condition = where.onlinePayment.is;
    if (condition === null) { if (p) return false; }
    else {
      if (!p) return false;
      if (condition.reconciliationRequired !== undefined && p.reconciliationRequired !== condition.reconciliationRequired) return false;
      if (condition.paidAt === null && p.paidAt !== null) return false;
      if (condition.paidAt?.not === null && p.paidAt === null) return false;
    }
  }
  return true;
}
const db = {
  $queryRaw: async () => [{ available: true }],
  $transaction: async work => { const before = tail; let release; tail = new Promise(resolve => { release = resolve; }); await before; try { return await work(db); } finally { release(); } },
  user: { findUnique: async () => ({ id: 10, role: actorRole }) },
  order: {
    count: async ({ where }) => orders.filter(order => matches(order, where)).length,
    findMany: async ({ where, skip = 0, take }) => orders.filter(order => matches(order, where)).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id).slice(skip, take === undefined ? undefined : skip + take),
    findFirst: async ({ where }) => orders.find(order => matches(order, where)) ?? null,
    findUniqueOrThrow: async ({ where }) => withPayment(orders.find(order => order.id === where.id)),
    update: async ({ where, data }) => { writes++; return Object.assign(orders.find(order => order.id === where.id), data); },
  },
  onlinePayment: {
    findMany: async ({ where }) => [...payments.values()].filter(payment => where.orderId.in.includes(payment.orderId)).map(payment => ({ ...payment, attempts: attempts.filter(attempt => attempt.orderId === payment.orderId).reverse() })),
    findUnique: async ({ where }) => { const payment = payments.get(where.orderId); return payment ? { ...payment, attempts: attempts.filter(attempt => attempt.orderId === payment.orderId && ['PENDING', 'PROCESSING'].includes(attempt.status)) } : null; },
    update: async ({ where, data }) => Object.assign(payments.get(where.orderId), data),
  },
  paymentAttempt: {
    findUnique: async ({ where }) => attempts.find(attempt => attempt.orderCode === where.orderCode),
    findUniqueOrThrow: async ({ where }) => attempts.find(attempt => attempt.orderCode === where.orderCode),
    update: async ({ where, data }) => Object.assign(attempts.find(attempt => attempt.orderCode === where.orderCode), data),
  },
  paymentReceipt: { findUnique: async ({ where }) => receipts.find(receipt => receipt.reference === where.reference), create: async ({ data }) => { receipts.push(data); return data; } },
  productVariant: { update: async () => { stockWrites++; }, updateMany: async () => { stockWrites++; return { count: 1 }; } },
};
globalThis.__sellerTest = { db, sdk };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (specifier === '@/lib/db/client') return { url: 'data:text/javascript,export const prisma=globalThis.__sellerTest.db', shortCircuit: true };
  if (specifier === '@/lib/auth-session') return { url: 'data:text/javascript,export async function resolveProductSession(){return {userId:10}}', shortCircuit: true };
  if (specifier === '@/features/vouchers/service') return { url: 'data:text/javascript,export function voucherQuote(){throw Error("unexpected voucher mutation")}; export const voucherList=voucherQuote; export const voucherSave=voucherQuote;', shortCircuit: true };
  if (specifier === './provider' && context.parentURL?.includes('/payments/')) return { url: 'data:text/javascript,export function payosClient(){return {webhooks:globalThis.__sellerTest.sdk.webhooks}}', shortCircuit: true };
  return next(specifier, context);
} });
const { sellerOrders, sellerUpdateStatus } = await import('../src/features/orders/seller-orders.ts');
const { verifiedWebhook } = await import('../src/features/payments/service.ts');
beforeEach(() => {
  actorRole = 'ADMIN'; orders = [fixtureOrder(1)]; payments = new Map([[1, { orderId: 1, provider: 'PAYOS', paidAt: null, reconciliationRequired: false }]]);
  attempts = [{ orderCode: BigInt(100), orderId: 1, expectedAmount: '500000', status: 'PENDING', paymentLinkId: 'fixture-link', reference: null, transactionReferences: [], paidAmount: null, paidAt: null, expiresAt: new Date(Date.now() + 600000) }]; receipts = []; writes = 0; stockWrites = 0; tail = Promise.resolve();
});
async function notifyPaid() {
  const data = { orderCode: 100, amount: 500000, description: 'A1', accountNumber: 'FIXTURE', reference: 'fixture-reference', transactionDateTime: '', currency: 'VND', paymentLinkId: 'fixture-link', code: '00', desc: '' };
  return verifiedWebhook({ data, signature: await sdk.crypto.createSignatureFromObj(data, sdk.checksumKey), success: true, code: '00', desc: '' });
}
test('verified payment makes the original order visible in seller processing queue', async () => {
  assert.equal((await sellerOrders(new URLSearchParams())).orders.length, 0);
  await notifyPaid();
  const dashboard = await sellerOrders(new URLSearchParams());
  assert.equal(dashboard.orders[0].id, 1); assert.equal(dashboard.orders[0].payment.status, 'PAID'); assert.equal(dashboard.counts.READY, 1); assert.equal(orders.length, 1); assert.equal(stockWrites, 0);
});
test('duplicate paid notification leaves exactly one seller order and receipt', async () => {
  await notifyPaid(); await notifyPaid();
  const dashboard = await sellerOrders(new URLSearchParams());
  assert.equal(dashboard.orders.length, 1); assert.equal(receipts.length, 1); assert.equal(stockWrites, 0);
});
test('customer cannot read seller dashboard', async () => {
  actorRole = 'CUSTOMER'; await assert.rejects(sellerOrders(new URLSearchParams()), error => error.status === 403);
});
test('customer cannot update seller order status', async () => {
  actorRole = 'CUSTOMER'; await assert.rejects(sellerUpdateStatus({ id: 1, expected: 'PENDING', status: 'CONFIRMED' }), error => error.status === 403); assert.equal(writes, 0);
});
test('unpaid online order cannot be confirmed by seller', async () => {
  await assert.rejects(sellerUpdateStatus({ id: 1, expected: 'PENDING', status: 'CONFIRMED' }), /chưa thanh toán/); assert.equal(writes, 0);
});
test('paid order flagged for reconciliation cannot be shipped', async () => {
  await notifyPaid(); payments.get(1).reconciliationRequired = true; orders[0].status = 'CONFIRMED';
  await assert.rejects(sellerUpdateStatus({ id: 1, expected: 'CONFIRMED', status: 'SHIPPED' }), /cần đối soát/); assert.equal(writes, 0);
});
test('stale seller status cannot overwrite a newer state', async () => {
  await notifyPaid(); orders[0].status = 'CONFIRMED';
  await assert.rejects(sellerUpdateStatus({ id: 1, expected: 'PENDING', status: 'CONFIRMED' }), /Trạng thái đã thay đổi/); assert.equal(writes, 0);
});
test('seller can confirm tracked paid order without DEMO prefix or another stock decrement', async () => {
  await notifyPaid(); orders[0].orderNumber = 'AUREL-REAL-FIXTURE';
  await sellerUpdateStatus({ id: 1, expected: 'PENDING', status: 'CONFIRMED' });
  assert.equal(orders[0].status, 'CONFIRMED'); assert.equal(writes, 1); assert.equal(stockWrites, 0);
});
test('paid queue filters before pagination so newer unpaid orders cannot hide an older paid order', async () => {
  await notifyPaid();
  for (let id = 2; id <= 122; id++) { orders.push(fixtureOrder(id)); payments.set(id, { orderId: id, paidAt: null, reconciliationRequired: false }); }
  const dashboard = await sellerOrders(new URLSearchParams('filter=READY&page=1'));
  assert.equal(dashboard.total, 1); assert.equal(dashboard.orders[0].id, 1); assert.equal(dashboard.counts.WAITING, 121);
});
