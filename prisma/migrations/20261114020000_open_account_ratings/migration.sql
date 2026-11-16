BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "ProductReview" ALTER COLUMN "orderItemId" DROP NOT NULL;
CREATE OR REPLACE VIEW "PublicProductDiscussion" AS
WITH RECURSIVE visible AS (
  SELECT d.*, d.id AS "rootId", 0 AS depth
  FROM "ProductDiscussion" d JOIN "Product" p ON p.id = d."productId"
  LEFT JOIN "ProductReview" r ON r.id = d."reviewId"
  WHERE d."parentId" IS NULL AND NOT d.hidden AND p."isActive"
    AND (d."commentId" IS NOT NULL OR r.status = 'APPROVED')
  UNION ALL
  SELECT d.*, v."rootId", v.depth + 1 FROM "ProductDiscussion" d JOIN visible v ON d."parentId" = v.id
  WHERE NOT d.hidden AND d."productId" = v."productId" AND v.depth < 4
)
SELECT * FROM visible;
COMMIT;
