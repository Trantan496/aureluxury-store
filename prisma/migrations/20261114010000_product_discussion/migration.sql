BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "ProductDiscussion" (
  id SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES "ProductDiscussion"(id) ON DELETE CASCADE,
  "reviewId" INTEGER UNIQUE REFERENCES "ProductReview"(id) ON DELETE CASCADE,
  "commentId" INTEGER UNIQUE REFERENCES "ProductComment"(id) ON DELETE CASCADE,
  body TEXT CHECK (char_length(body) BETWEEN 1 AND 1000),
  hidden BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("parentId" IS NULL AND body IS NULL AND num_nonnulls("reviewId", "commentId") = 1)
    OR ("parentId" IS NOT NULL AND body IS NOT NULL AND num_nonnulls("reviewId", "commentId") = 0))
);
CREATE INDEX "ProductDiscussion_productId_createdAt_idx" ON "ProductDiscussion"("productId", "createdAt");
CREATE INDEX "ProductDiscussion_parentId_idx" ON "ProductDiscussion"("parentId");
CREATE TABLE "ProductDiscussionLike" (
  "discussionId" INTEGER NOT NULL REFERENCES "ProductDiscussion"(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  PRIMARY KEY ("discussionId", "userId")
);
CREATE TABLE "ProductDiscussionImage" (
  id UUID PRIMARY KEY,
  "discussionId" INTEGER NOT NULL REFERENCES "ProductDiscussion"(id) ON DELETE CASCADE,
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 1920),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 1920)
);
CREATE INDEX "ProductDiscussionImage_discussionId_idx" ON "ProductDiscussionImage"("discussionId");
INSERT INTO "ProductDiscussion" ("productId", "userId", "reviewId", "createdAt")
  SELECT "productId", "userId", id, "createdAt" FROM "ProductReview";
INSERT INTO "ProductDiscussion" ("productId", "userId", "commentId", "createdAt")
  SELECT "productId", "userId", id, "createdAt" FROM "ProductComment";
CREATE FUNCTION public.link_product_discussion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'ProductReview' THEN
    INSERT INTO "ProductDiscussion" ("productId", "userId", "reviewId", "createdAt") VALUES (NEW."productId", NEW."userId", NEW.id, NEW."createdAt");
  ELSE
    INSERT INTO "ProductDiscussion" ("productId", "userId", "commentId", "createdAt") VALUES (NEW."productId", NEW."userId", NEW.id, NEW."createdAt");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_review_discussion AFTER INSERT ON "ProductReview" FOR EACH ROW EXECUTE FUNCTION public.link_product_discussion();
CREATE TRIGGER product_comment_discussion AFTER INSERT ON "ProductComment" FOR EACH ROW EXECUTE FUNCTION public.link_product_discussion();
-- The recursive view is the shared visibility boundary for feed, replies, likes and image delivery.
CREATE VIEW "PublicProductDiscussion" AS
WITH RECURSIVE visible AS (
  SELECT d.*, d.id AS "rootId", 0 AS depth
  FROM "ProductDiscussion" d JOIN "Product" p ON p.id = d."productId"
  LEFT JOIN "ProductReview" r ON r.id = d."reviewId"
  WHERE d."parentId" IS NULL AND NOT d.hidden AND p."isActive"
    AND (d."commentId" IS NOT NULL OR (r.status = 'APPROVED' AND EXISTS (
      SELECT 1 FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      JOIN "ProductVariant" v ON v.id = oi."variantId"
      WHERE oi.id = r."orderItemId" AND o."userId" = r."userId" AND o.status = 'DELIVERED' AND v."productId" = r."productId"
    )))
  UNION ALL
  SELECT d.*, v."rootId", v.depth + 1 FROM "ProductDiscussion" d JOIN visible v ON d."parentId" = v.id
  WHERE NOT d.hidden AND d."productId" = v."productId" AND v.depth < 4
)
SELECT * FROM visible;
COMMIT;
