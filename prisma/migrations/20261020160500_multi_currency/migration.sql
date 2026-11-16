-- Staged migration: test deployment approved; production requires legacy currency review.
BEGIN;
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VND', 'USD', 'EUR');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" "Currency",
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "currency" "Currency",
ADD COLUMN     "lineTotal" DECIMAL,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "price" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPrice_currency_amount_idx" ON "ProductPrice"("currency", "amount");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_variantId_currency_key" ON "ProductPrice"("variantId", "currency");

-- CreateIndex
CREATE INDEX "Order_currency_createdAt_idx" ON "Order"("currency", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unconstrained NUMERIC deliberately prevents implicit rounding before validation.
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_amount_check" CHECK (
 "amount" >= 0 AND "amount" < 1000000000000000000 AND
 scale("amount") <= CASE WHEN "currency" = 'VND' THEN 0 ELSE 2 END);
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK (
 "currency" IS NULL OR ("totalAmount" >= 0 AND "totalAmount" < 10000000000000000000000 AND
 scale("totalAmount") <= CASE WHEN "currency" = 'VND' THEN 0 ELSE 2 END));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_money_check" CHECK (
 ("currency" IS NULL AND "lineTotal" IS NULL) OR
 ("currency" IS NOT NULL AND "lineTotal" IS NOT NULL AND "quantity" > 0 AND
 "unitPrice" >= 0 AND "unitPrice" < 1000000000000000000 AND
 "lineTotal" >= 0 AND "lineTotal" < 10000000000000000000000 AND
 scale("unitPrice") <= CASE WHEN "currency" = 'VND' THEN 0 ELSE 2 END AND
 scale("lineTotal") <= CASE WHEN "currency" = 'VND' THEN 0 ELSE 2 END AND
 "lineTotal" = "unitPrice" * "quantity"));

CREATE FUNCTION check_order_currency_snapshot(target_id INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE header "Order"%ROWTYPE; item_count INTEGER; total NUMERIC; invalid_count INTEGER;
BEGIN
 SELECT * INTO header FROM "Order" WHERE id = target_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*), sum("lineTotal"), count(*) FILTER (WHERE "currency" IS DISTINCT FROM header.currency)
 INTO item_count, total, invalid_count FROM "OrderItem" WHERE "orderId" = target_id;
 IF invalid_count > 0 OR (header.currency IS NOT NULL AND (item_count = 0 OR total IS DISTINCT FROM header."totalAmount")) THEN
   RAISE EXCEPTION 'Inconsistent order currency snapshot' USING ERRCODE = '23514';
 END IF;
END;
$$;
CREATE FUNCTION enforce_order_currency_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'Order' THEN
   IF TG_OP <> 'DELETE' THEN PERFORM check_order_currency_snapshot(NEW.id); END IF;
 ELSE
   IF TG_OP <> 'INSERT' THEN PERFORM check_order_currency_snapshot(OLD."orderId"); END IF;
   IF TG_OP <> 'DELETE' THEN PERFORM check_order_currency_snapshot(NEW."orderId"); END IF;
 END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Order_currency_snapshot" AFTER INSERT OR UPDATE ON "Order"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_order_currency_snapshot();
CREATE CONSTRAINT TRIGGER "OrderItem_currency_snapshot" AFTER INSERT OR UPDATE OR DELETE ON "OrderItem"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_order_currency_snapshot();
COMMIT;
