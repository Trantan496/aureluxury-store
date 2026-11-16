BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public."Order"
  ADD COLUMN "subtotalAmount" NUMERIC,
  ADD COLUMN "discountAmount" NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN "voucherCode" TEXT,
  ADD CONSTRAINT "Order_discount_check" CHECK (
    "discountAmount" >= 0 AND "discountAmount" < 10000000000000000000000
    AND scale("discountAmount") = 0
    AND (("subtotalAmount" IS NULL AND "discountAmount" = 0 AND "voucherCode" IS NULL)
      OR ("subtotalAmount" >= 0 AND "subtotalAmount" < 10000000000000000000000
        AND currency IS NOT DISTINCT FROM 'VND' AND scale("subtotalAmount") = 0
        AND "totalAmount" + "discountAmount" = "subtotalAmount"
        AND ("discountAmount" = 0 OR "voucherCode" IS NOT NULL)))
  );

CREATE TABLE public."Voucher" (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  value NUMERIC NOT NULL,
  "minSubtotal" NUMERIC NOT NULL DEFAULT 0,
  "maxDiscount" NUMERIC,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "usageLimit" INTEGER,
  "perUserLimit" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Voucher_rules_check" CHECK (
    code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
    AND kind IN ('FIXED','PERCENT')
    AND value > 0 AND value < 1000000000000000000 AND scale(value) = 0
    AND (kind <> 'PERCENT' OR value <= 100)
    AND "minSubtotal" >= 0 AND "minSubtotal" < 1000000000000000000 AND scale("minSubtotal") = 0
    AND ("maxDiscount" IS NULL OR ("maxDiscount" > 0 AND "maxDiscount" < 1000000000000000000 AND scale("maxDiscount") = 0))
    AND "startsAt" < "endsAt"
    AND ("usageLimit" IS NULL OR "usageLimit" > 0)
    AND "perUserLimit" > 0 AND version > 0
  )
);
CREATE TABLE public."VoucherRedemption" (
  id SERIAL PRIMARY KEY,
  "voucherId" INTEGER NOT NULL REFERENCES public."Voucher"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" INTEGER NOT NULL UNIQUE REFERENCES public."Order"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "codeSnapshot" TEXT NOT NULL,
  "discountAmount" NUMERIC NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "VoucherRedemption_discount_check" CHECK ("discountAmount" > 0 AND "discountAmount" < 10000000000000000000000 AND scale("discountAmount") = 0)
);
CREATE INDEX "VoucherRedemption_voucherId_userId_releasedAt_idx" ON public."VoucherRedemption"("voucherId","userId","releasedAt");

-- Keep original gross line price/quantity invariants; the header is the net payable.
CREATE OR REPLACE FUNCTION public.check_order_currency_snapshot(target_id INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE header public."Order"%ROWTYPE; item_count BIGINT; total NUMERIC; invalid_count BIGINT;
BEGIN
  SELECT * INTO header FROM public."Order" WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*), sum("lineTotal"), count(*) FILTER (WHERE "currency" IS DISTINCT FROM header.currency)
  INTO item_count, total, invalid_count FROM public."OrderItem" WHERE "orderId" = target_id;
  IF invalid_count > 0 OR (header.currency IS NOT NULL AND
    (item_count = 0 OR total - header."discountAmount" IS DISTINCT FROM header."totalAmount"
     OR (header."subtotalAmount" IS NOT NULL AND total IS DISTINCT FROM header."subtotalAmount"))) THEN
    RAISE EXCEPTION 'Inconsistent order currency snapshot' USING ERRCODE = '23514';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_order_currency_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE targets INTEGER[]; target_id INTEGER; header public."Order"%ROWTYPE;
        item_count BIGINT; total NUMERIC; invalid_count BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'Order' THEN targets := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN targets := ARRAY[NEW."orderId"];
  ELSIF TG_OP = 'DELETE' THEN targets := ARRAY[OLD."orderId"];
  ELSE targets := ARRAY[OLD."orderId", NEW."orderId"];
  END IF;
  FOR target_id IN SELECT DISTINCT id FROM pg_catalog.unnest(targets) AS u(id) ORDER BY id LOOP
    SELECT * INTO header FROM public."Order" WHERE id = target_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*), sum("lineTotal"), count(*) FILTER (WHERE "currency" IS DISTINCT FROM header.currency)
    INTO item_count, total, invalid_count FROM public."OrderItem" WHERE "orderId" = target_id;
    IF invalid_count > 0 OR (header.currency IS NOT NULL AND
      (item_count = 0 OR total - header."discountAmount" IS DISTINCT FROM header."totalAmount"
       OR (header."subtotalAmount" IS NOT NULL AND total IS DISTINCT FROM header."subtotalAmount"))) THEN
      RAISE EXCEPTION 'Inconsistent order currency snapshot' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_order_currency_snapshot(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_order_currency_snapshot() FROM PUBLIC;
COMMIT;
