BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "PendingProduct" (
 "id" SERIAL PRIMARY KEY,
 "requestKey" TEXT NOT NULL UNIQUE CHECK ("requestKey" ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
 "createdById" INTEGER NOT NULL CHECK ("createdById" > 0),
 "sourceProductId" INTEGER REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "productId" INTEGER UNIQUE REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending','converted')),
 "name" TEXT CHECK ("name" IS NULL OR (length(trim("name")) BETWEEN 1 AND 200)),
 "proposedPrice" NUMERIC CHECK ("proposedPrice" IS NULL OR ("proposedPrice" >= 0 AND "proposedPrice" < 1000000000000000000 AND scale("proposedPrice") = 0)),
 "imageAssetId" TEXT REFERENCES "ImageAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("sourceProductId" IS NULL OR "sourceProductId" IS DISTINCT FROM "productId"),
 CHECK ("state" = 'converted' OR "productId" IS NULL)
);
CREATE INDEX "PendingProduct_sourceProductId_id_idx" ON "PendingProduct"("sourceProductId","id");
CREATE INDEX "PendingProduct_state_id_idx" ON "PendingProduct"("state","id");
COMMIT;
