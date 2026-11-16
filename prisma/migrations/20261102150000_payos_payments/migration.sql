BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public."OnlinePayment" (
  "orderId" INTEGER PRIMARY KEY REFERENCES public."Order"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  provider TEXT NOT NULL DEFAULT 'PAYOS' CHECK (provider = 'PAYOS'),
  "paidAt" TIMESTAMP(3),
  "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE public."PaymentAttempt" (
  "orderCode" BIGSERIAL PRIMARY KEY CHECK ("orderCode" BETWEEN 1 AND 9007199254740991),
  "orderId" INTEGER NOT NULL REFERENCES public."OnlinePayment"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "expectedAmount" NUMERIC(16,0) NOT NULL CHECK ("expectedAmount" BETWEEN 1 AND 9007199254740991),
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PENDING','PROCESSING','PAID','CANCELLED','FAILED','EXPIRED')),
  "paymentLinkId" TEXT UNIQUE,
  "checkoutUrl" TEXT, "qrCode" TEXT, "bankBin" TEXT, "accountName" TEXT, "accountNumber" TEXT,
  description TEXT NOT NULL,
  reference TEXT UNIQUE, "transactionReferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "paidAmount" NUMERIC(16,0), "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL, "leaseUntil" TIMESTAMP(3), "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON public."PaymentAttempt"("orderId","createdAt");
-- A dedicated high namespace avoids internal order IDs and the registration probe code.
ALTER SEQUENCE public."PaymentAttempt_orderCode_seq" RESTART WITH 1000000000000;
CREATE UNIQUE INDEX "PaymentAttempt_one_active" ON public."PaymentAttempt"("orderId") WHERE status IN ('PENDING','PROCESSING');
CREATE TABLE public."PaymentReceipt" (
  reference TEXT PRIMARY KEY,
  "orderCode" BIGINT NOT NULL REFERENCES public."PaymentAttempt"("orderCode") ON DELETE RESTRICT ON UPDATE CASCADE,
  amount NUMERIC(16,0) NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
  currency TEXT NOT NULL CHECK (currency = 'VND'),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PaymentReceipt_orderCode_idx" ON public."PaymentReceipt"("orderCode");
-- Existing Order/OrderItem constraints, inventory and rows are untouched.
-- Runtime role grants must follow the reviewed deployment policy.
COMMIT;
