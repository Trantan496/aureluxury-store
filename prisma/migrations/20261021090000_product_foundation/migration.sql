-- STAGED ONLY. Depends on multi_currency and order_revision; main remains NO-GO.
-- Nullable legacy metadata, no inferred codes/options/rights or legacy rewrites.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "Product" ADD COLUMN "productCode" TEXT,
  ADD COLUMN "collection" TEXT, ADD COLUMN "updatedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");
ALTER TABLE "Product" ADD CONSTRAINT "Product_code_format" CHECK ("productCode" ~ '^AUR-[0-9]{4,12}$'),
  ADD CONSTRAINT "Product_collection_format" CHECK (length("collection") <= 100 AND "collection" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
CREATE FUNCTION public.aurel_product_updated_at() RETURNS trigger LANGUAGE plpgsql
  SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
BEGIN NEW."updatedAt" := CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.aurel_product_updated_at() FROM PUBLIC;
CREATE TRIGGER aurel_product_updated_at BEFORE INSERT OR UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION public.aurel_product_updated_at();

CREATE TABLE "ProductProfile" (
  "productId" INTEGER NOT NULL PRIMARY KEY REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "collar" TEXT, "fabric" TEXT, "gender" TEXT, "fit" TEXT, "garmentType" TEXT,
  "styleTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seasonTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "occasionTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "layerRole" TEXT, "pattern" TEXT, "silhouette" TEXT,
  "taxonomyVersion" TEXT NOT NULL DEFAULT 'aurel-fashion-v1', "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ProductProfile_gender_garmentType_idx" ON "ProductProfile"("gender", "garmentType");
CREATE INDEX "ProductProfile_fabric_fit_idx" ON "ProductProfile"("fabric", "fit");

-- Existing two-dimensional SKU identity is deliberately retained. No SKU Cartesian expansion.
CREATE UNIQUE INDEX "ProductVariant_id_productId_key" ON "ProductVariant"("id", "productId");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonnegative" CHECK ("stock" >= 0) NOT VALID;
-- NOT VALID protects existing unreviewed legacy rows but enforces all new writes.
ALTER TABLE "ProductImage" ADD COLUMN "variantId" INTEGER,
  ADD COLUMN "imageType" TEXT, ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceReference" TEXT, ADD COLUMN "rightsReference" TEXT,
  ADD COLUMN "websitePermission" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "embeddingPermission" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "trainingPermission" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_productId_fkey"
  FOREIGN KEY ("variantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ProductImage_type" CHECK ("imageType" IN ('front','back','detail','lifestyle','other')),
  ADD CONSTRAINT "ProductImage_website_permission" CHECK ("websitePermission" IN ('unknown','granted','denied')),
  ADD CONSTRAINT "ProductImage_embedding_permission" CHECK ("embeddingPermission" IN ('unknown','granted','denied')),
  ADD CONSTRAINT "ProductImage_training_permission" CHECK ("trainingPermission" IN ('unknown','granted','denied')),
  ADD CONSTRAINT "ProductImage_rights_evidence" CHECK (
    ("websitePermission" <> 'granted' AND "embeddingPermission" <> 'granted' AND "trainingPermission" <> 'granted')
    OR (length(trim("rightsReference")) > 0 AND "rightsReference" IS NOT NULL)),
  ADD CONSTRAINT "ProductImage_sort_nonnegative" CHECK ("sortOrder" >= 0) NOT VALID;
CREATE INDEX "ProductImage_variantId_productId_idx" ON "ProductImage"("variantId", "productId");
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product" ON "ProductImage"("productId") WHERE "isPrimary";
ALTER TABLE "ProductProfile" ADD CONSTRAINT "ProductProfile_collar_taxonomy" CHECK ("collar" IN ('round-neck','v-neck','polo','high-neck','shirt-collar')),
ADD CONSTRAINT "ProductProfile_fabric_taxonomy" CHECK ("fabric" IN ('cotton','linen','denim','polyester','wool','silk','viscose','nylon','leather')),
ADD CONSTRAINT "ProductProfile_gender_taxonomy" CHECK ("gender" IN ('men','women','unisex')),
ADD CONSTRAINT "ProductProfile_fit_taxonomy" CHECK ("fit" IN ('slim-fit','regular-fit','relaxed-fit','oversized')),
ADD CONSTRAINT "ProductProfile_garmentType_taxonomy" CHECK ("garmentType" IN ('t-shirt','shirt','polo','trousers','jeans','shorts','skirt','dress','jacket','coat','knitwear')),
ADD CONSTRAINT "ProductProfile_styleTags_taxonomy" CHECK ("styleTags" <@ ARRAY['minimal','classic','casual','formal','streetwear','sporty']::TEXT[] AND array_position("styleTags", NULL) IS NULL),
ADD CONSTRAINT "ProductProfile_seasonTags_taxonomy" CHECK ("seasonTags" <@ ARRAY['spring','summer','autumn','winter','all-season']::TEXT[] AND array_position("seasonTags", NULL) IS NULL),
ADD CONSTRAINT "ProductProfile_occasionTags_taxonomy" CHECK ("occasionTags" <@ ARRAY['everyday','work','evening','travel','sport','ceremony']::TEXT[] AND array_position("occasionTags", NULL) IS NULL),
ADD CONSTRAINT "ProductProfile_layerRole_taxonomy" CHECK ("layerRole" IN ('base','mid','outer','standalone')),
ADD CONSTRAINT "ProductProfile_pattern_taxonomy" CHECK ("pattern" IN ('solid','striped','checked','floral','graphic','textured')),
ADD CONSTRAINT "ProductProfile_silhouette_taxonomy" CHECK ("silhouette" IN ('straight','a-line','tapered','wide','fitted','boxy'));
ALTER TABLE "ProductProfile" ADD CONSTRAINT "ProductProfile_taxonomy_version" CHECK ("taxonomyVersion" = 'aurel-fashion-v1');
CREATE UNIQUE INDEX "ProductVariant_normalized_sku" ON "ProductVariant" (upper(trim("sku")));
CREATE UNIQUE INDEX "ProductVariant_normalized_combination" ON "ProductVariant" ("productId", lower(regexp_replace(trim("color"), '[[:space:]]+', '-', 'g')), upper(trim("size")));
COMMIT;
