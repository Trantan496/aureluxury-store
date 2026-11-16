BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public."ProductComment" (
  id SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES public."Product"(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProductComment_productId_createdAt_idx" ON public."ProductComment"("productId", "createdAt");
COMMIT;
