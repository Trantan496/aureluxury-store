BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public."ProductDraftRequest" (
  "key" TEXT NOT NULL,
  "actorId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDraftRequest_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "ProductDraftRequest_valid" CHECK ("key" ~ '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$' AND "actorId" > 0),
  CONSTRAINT "ProductDraftRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductDraftRequest_productId_key" ON public."ProductDraftRequest"("productId");
COMMIT;
