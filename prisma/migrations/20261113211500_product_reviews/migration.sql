BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TYPE public."ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');
CREATE TABLE public."ProductReview" (
  id SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES public."Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "orderItemId" INTEGER NOT NULL REFERENCES public."OrderItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1000),
  status public."ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "adminReply" TEXT,
  "adminRepliedAt" TIMESTAMP(3),
  "moderatedById" INTEGER,
  "moderatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProductReview_userId_productId_key" ON public."ProductReview"("userId", "productId");
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON public."ProductReview"("productId", status, "createdAt");
CREATE INDEX "ProductReview_status_createdAt_idx" ON public."ProductReview"(status, "createdAt");
COMMIT;
