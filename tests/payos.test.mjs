import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { PayOS } from '@payos/node';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// No real DB, provider HTTP, credentials, QR payment or bank transfer in these tests.
const sdk = new PayOS({ clientId: 'fixture', apiKey: 'fixture', checksumKey: 'fixture-only-not-real', maxRetries: 0, logLevel: 'off', fetch: async () => { throw new Error('Unexpected network'); } });
let order, payment, attempts, calls, remote, failure, tail, receipts, getFailure;
const orderFixture = () => ({ id: 1, userId: 10, orderNumber: 'DEMO-10-fixture', status: 'PENDING', totalAmount: '500000', discountAmount: '0', currency: 'VND', items: [{ productName: 'Fixture', quantity: 1, color: 'black', size: 'M', lineTotal: '500000' }], shippingName: 'Fixture', shippingAddress: 'Fixture address' });
function find(where) { return attempts.find(a => a.orderCode === where.orderCode); }
function matches(a, where) { return (!where.orderCode || where.orderCode === a.orderCode) && (!where.status || (where.status.in ? where.status.in.includes(a.status) : where.status.not ? where.status.not !== a.status : where.status === a.status)); }
const db = {
  $queryRaw: async () => [{ available: true }],
  $transaction: async work => {
    const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
    try { return await work(db); } finally { release(); }
  },
  order: { findUnique: async () => order ? { ...order, onlinePayment: payment } : null, findUniqueOrThrow: async () => ({ ...order, onlinePayment: { ...payment, attempts: [...attempts].reverse() } }) },
  onlinePayment: { update: async ({ data }) => Object.assign(payment, data) },
  paymentReceipt: { findUnique: async ({ where }) => receipts.find(receipt => receipt.reference === where.reference), create: async ({ data }) => { receipts.push(data); return data; } },
  paymentAttempt: {
    findUnique: async ({ where }) => find(where), findUniqueOrThrow: async ({ where }) => find(where),
    findFirst: async () => attempts.at(-1) ?? null,
    create: async ({ data }) => { const a = { ...data, orderCode: BigInt(attempts.length + 100), status: 'PROCESSING', paymentLinkId: null, checkoutUrl: null, qrCode: null, reference: null, transactionReferences: [], paidAt: null, lastCheckedAt: null }; attempts.push(a); return a; },
    update: async ({ where, data }) => Object.assign(find(where), data),
    updateMany: async ({ where, data }) => { let count = 0; for (const a of attempts) if (matches(a, where)) { Object.assign(a, data); count++; } return { count }; },
  },
};
const provider = {
  webhooks: sdk.webhooks,
  paymentRequests: {
    create: async input => { calls++; if (failure) throw failure; return { ...input, currency: 'VND', paymentLinkId: 'link1', status: 'PENDING', bin: '970422', accountName: 'FIXTURE', accountNumber: 'FIXTURE', checkoutUrl: 'https://pay.payos.vn/web/link1', qrCode: 'fixture payload, never a live bank QR' }; },
    get: async () => { if (getFailure) throw getFailure; if (failure) throw failure; return remote; },
    cancel: async () => ({ ...remote, status: 'CANCELLED' }),
  },
};
globalThis.__payosTest = { db, provider };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (specifier === '@/lib/db/client') return { url: 'data:text/javascript,export const prisma=globalThis.__payosTest.db', shortCircuit: true };
  if (specifier === '@/features/shop/service') return { url: 'data:text/javascript,export async function shopActor(){return {id:10,role:"CUSTOMER"}}', shortCircuit: true };
  if (specifier === './provider' && context.parentURL?.includes('/payments/')) return { url: 'data:text/javascript,export function payosClient(){return globalThis.__payosTest.provider}', shortCircuit: true };
  return next(specifier, context);
}, load(url, context, next) {
  if (url.endsWith('.module.css')) return { format: 'module', source: 'export default new Proxy({}, {get:(_,key)=>String(key)})', shortCircuit: true };
  return next(url, context);
} });
const service = await import('../src/features/payments/service.ts');
const rules = await import('../src/features/payments/rules.ts');
const { checkoutInput } = await import('../src/features/shop/rules.ts');
const { paymentBody } = await import('../src/features/payments/http.ts');
const { PayosPayment } = await import('../src/components/shop/payos-payment.tsx');
beforeEach(() => {
  order = orderFixture(); payment = { orderId: 1, paidAt: null, reconciliationRequired: false }; attempts = []; receipts = []; calls = 0; failure = null; getFailure = null; tail = Promise.resolve();
  remote = { id: 'link1', orderCode: 100, amount: 500000, amountPaid: 0, amountRemaining: 500000, status: 'PENDING', transactions: [] };
  process.env.PAYOS_ENABLED = 'true'; process.env.PAYOS_CLIENT_ID = 'fixture'; process.env.PAYOS_API_KEY = 'fixture'; process.env.PAYOS_CHECKSUM_KEY = 'fixture'; process.env.BETTER_AUTH_URL = 'https://aureluxury.store';
});
async function prepare() { return service.createPayment(1, 10); }
function event(changes = {}) { return { orderCode: 100, amount: 500000, description: 'A1', accountNumber: 'FIXTURE', reference: 'fixture-ref', transactionDateTime: '', currency: 'VND', paymentLinkId: 'link1', code: '00', desc: '', ...changes }; }
async function signed(data) { return { data, code: '00', success: true, desc: '', signature: await sdk.crypto.createSignatureFromObj(data, sdk.checksumKey) }; }

test('missing configuration fails before order/payment provider work', () => { assert.throws(() => rules.paymentConfig({ PAYOS_ENABLED: 'true' }), /chưa sẵn sàng/); assert.equal(calls, 0); });
test('invalid checkout recipient is rejected', () => { assert.throws(() => checkoutInput({ key: 'invalid', name: '', phone: '', address: '' })); });
test('ownership cannot be forged', async () => { await assert.rejects(service.createPayment(1, 11), /Không tìm thấy/); assert.equal(calls, 0); });
test('wrong provider amount never marks an order paid and retains a reconciliation receipt', async () => { await prepare(); await service.recordPayment(event({ amount: 1 })); assert.equal(payment.paidAt, null); assert.equal(payment.reconciliationRequired, true); assert.equal(receipts[0].amount, 1); });
test('concurrent payment creation reuses one database attempt and one provider call', async () => { await Promise.all([prepare(), prepare()]); assert.equal(attempts.length, 1); assert.equal(calls, 1); });
test('already paid order cannot create another link', async () => { payment.paidAt = new Date(); await assert.rejects(prepare(), /đã thanh toán/); assert.equal(calls, 0); });
test('provider failure preserves the saved attempt and order', async () => { failure = new Error('provider failure'); await assert.rejects(prepare(), /Đơn hàng đã được giữ/); assert.equal(attempts.length, 1); assert.equal(order.status, 'PENDING'); });
test('real SDK verifies a signed webhook before committing PAID', async () => { await prepare(); await service.verifiedWebhook(await signed(event())); assert.equal(attempts[0].status, 'PAID'); assert.ok(payment.paidAt); });
test('invalid SDK signature cannot update financial state', async () => { await prepare(); await assert.rejects(service.verifiedWebhook({ data: event(), signature: 'forged' }), /Chữ ký/); assert.equal(payment.paidAt, null); });
test('duplicate signed webhook is idempotent', async () => { await prepare(); const payload = await signed(event()); await service.verifiedWebhook(payload); const paidAt = payment.paidAt; await service.verifiedWebhook(payload); assert.equal(payment.paidAt, paidAt); assert.equal(payment.reconciliationRequired, false); });
test('concurrent webhook delivery records one paid transition', async () => { await prepare(); const payload = await signed(event()); await Promise.all([service.verifiedWebhook(payload), service.verifiedWebhook(payload)]); assert.equal(attempts.filter(a => a.status === 'PAID').length, 1); assert.equal(payment.reconciliationRequired, false); });
test('provider cancellation preserves the reserved order for a retry', async () => { await prepare(); const view = await service.paymentStatus(1, 10, 'cancel'); assert.equal(view.status, 'CANCELLED'); assert.equal(order.status, 'PENDING'); });
test('pending reconciliation does not claim payment success', async () => { await prepare(); const view = await service.paymentStatus(1, 10, 'reconcile'); assert.equal(view.status, 'PENDING'); assert.equal(payment.paidAt, null); });
test('provider-confirmed expiry transitions payment without silently releasing stock', async () => { await prepare(); remote.status = 'EXPIRED'; const view = await service.paymentStatus(1, 10, 'reconcile'); assert.equal(view.status, 'EXPIRED'); assert.equal(order.status, 'PENDING'); });
test('untrusted redirect origin cannot replace configured return URLs', () => { assert.equal(rules.paymentOrigin(process.env), 'https://aureluxury.store'); assert.throws(() => rules.hostedCheckout('https://evil.invalid/payment')); });
test('network timeout retry looks up and reuses the same payment code', async () => { failure = new Error('timeout'); await assert.rejects(prepare()); failure = null; await prepare(); assert.equal(attempts.length, 1); assert.equal(calls, 1); assert.equal(attempts[0].checkoutUrl, 'https://pay.payos.vn/web/link1'); });
test('mobile payment card SSR has accessible state and return links', () => { const html = renderToStaticMarkup(createElement(PayosPayment, { orderId: 1 })); assert.match(html, /aria-label="Thanh toán payOS"/); assert.match(html, /Đang tải/); assert.match(html, /Tiếp tục mua sắm/); });
test('late verified payment retains financial record and flags cancelled order', async () => { await prepare(); order.status = 'CANCELLED'; await service.verifiedWebhook(await signed(event())); assert.equal(order.status, 'CANCELLED'); assert.equal(attempts[0].status, 'PAID'); assert.equal(payment.reconciliationRequired, true); });
test('valid registration probe does not create a customer order', async () => { const response = await service.verifiedWebhook(await signed(event({ orderCode: 123 }))); assert.equal(response.ignored, true); assert.equal(attempts.length, 0); });
test('cross-origin payment mutation is rejected before provider work', async () => { const request = new Request('https://aureluxury.store/api/payos/create', { method: 'POST', headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' }, body: '{"orderId":1}' }); await assert.rejects(paymentBody(request), /Nguồn/); assert.equal(calls, 0); });
test('signed provider GET confirms a paid link and preserves transaction references', async () => { await prepare(); remote.status = 'PAID'; remote.amountPaid = 500000; remote.amountRemaining = 0; remote.transactions = [{ reference: 'fixture-ref', amount: 500000 }]; const view = await service.paymentStatus(1, 10, 'reconcile'); assert.equal(view.status, 'PAID'); assert.deepEqual(attempts[0].transactionReferences, ['fixture-ref']); await service.verifiedWebhook(await signed(event())); assert.equal(payment.reconciliationRequired, false); });
test('partially paid cancelled provider link retains money and blocks a full-price retry', async () => { await prepare(); remote.status = 'CANCELLED'; remote.amountPaid = 100000; remote.amountRemaining = 400000; remote.transactions = [{ reference: 'partial-ref', amount: 100000 }]; const view = await service.paymentStatus(1, 10, 'reconcile'); assert.equal(view.status, 'CANCELLED'); assert.equal(view.reconciliationRequired, true); assert.equal(receipts[0].amount, 100000); await assert.rejects(prepare(), /cần đối soát/); assert.equal(calls, 1); });
test('provider code101 missing payment permits retry with the original saved code', async () => { failure = new Error('timeout'); await assert.rejects(prepare()); failure = null; getFailure = { code: '101', status: 200, desc: 'Mã thanh toán không tồn tại' }; const view = await prepare(); assert.equal(view.status, 'PENDING'); assert.equal(attempts.length, 1); assert.equal(attempts[0].orderCode, BigInt(100)); assert.equal(calls, 2); });
