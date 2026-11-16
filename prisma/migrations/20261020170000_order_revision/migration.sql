-- Remediation only. Main deployment remains subject to separate approval.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public."Order" ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Order_revision_nonnegative" CHECK ("revision" >= 0);

-- Real header writes, rather than locks alone, invalidate stale MVCC snapshots.
CREATE FUNCTION public.guard_order_revision() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."revision" := 0;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Order identity is immutable' USING ERRCODE = '23514';
    END IF;
    NEW."revision" := OLD."revision" + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Order_revision_guard" BEFORE INSERT OR UPDATE ON public."Order"
FOR EACH ROW EXECUTE FUNCTION public.guard_order_revision();

CREATE FUNCTION public.touch_order_item_headers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE targets INTEGER[]; target_id INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN targets := ARRAY[NEW."orderId"];
  ELSIF TG_OP = 'DELETE' THEN targets := ARRAY[OLD."orderId"];
  ELSE targets := ARRAY[OLD."orderId", NEW."orderId"];
  END IF;
  -- A move writes both parents in a deterministic order. Multi-statement
  -- transactions can still deadlock; PostgreSQL must abort one, never skip it.
  FOR target_id IN SELECT DISTINCT id FROM pg_catalog.unnest(targets) AS u(id) ORDER BY id LOOP
    UPDATE public."Order" SET "revision" = "revision" + 1 WHERE id = target_id;
    -- A missing new parent is rejected by the existing FK. A deleted header
    -- needs no validation; no surviving priced order is exempted.
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "OrderItem_header_revision" BEFORE INSERT OR UPDATE OR DELETE ON public."OrderItem"
FOR EACH ROW EXECUTE FUNCTION public.touch_order_item_headers();

-- Replace the checker with schema-qualified SQL. Kept for compatibility with
-- the old object name, but trigger validation below does not need EXECUTE grants
-- on helper functions for ordinary table writers.
CREATE OR REPLACE FUNCTION public.check_order_currency_snapshot(target_id INTEGER) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE header public."Order"%ROWTYPE; item_count BIGINT; total NUMERIC; invalid_count BIGINT;
BEGIN
  SELECT * INTO header FROM public."Order" WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*), sum("lineTotal"), count(*) FILTER (WHERE "currency" IS DISTINCT FROM header.currency)
  INTO item_count, total, invalid_count FROM public."OrderItem" WHERE "orderId" = target_id;
  IF invalid_count > 0 OR (header.currency IS NOT NULL AND (item_count = 0 OR total IS DISTINCT FROM header."totalAmount")) THEN
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
    IF invalid_count > 0 OR (header.currency IS NOT NULL AND (item_count = 0 OR total IS DISTINCT FROM header."totalAmount")) THEN
      RAISE EXCEPTION 'Inconsistent order currency snapshot' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Trigger invocation is not a public RPC. No SECURITY DEFINER or privilege
-- escalation: writers still need ordinary SELECT/UPDATE rights on the header.
REVOKE ALL ON FUNCTION public.guard_order_revision() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_order_item_headers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_order_currency_snapshot(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_order_currency_snapshot() FROM PUBLIC;
COMMIT;
