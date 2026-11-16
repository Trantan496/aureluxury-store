BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public."ImageAsset" (
  "id" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImageAsset_valid" CHECK (
    "id" ~ '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
    AND "mimeType" = 'image/webp' AND "width" BETWEEN 1 AND 1920 AND "height" BETWEEN 1 AND 1920
    AND "byteSize" BETWEEN 1 AND 8388608 AND "byteSize" = octet_length("data")
  )
);
CREATE INDEX "ImageAsset_createdAt_id_idx" ON public."ImageAsset" ("createdAt", "id");
COMMIT;
