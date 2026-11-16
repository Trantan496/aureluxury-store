BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public."TaxonomyOption" ADD COLUMN "hex" TEXT;
ALTER TABLE public."TaxonomyOption" ADD CONSTRAINT "TaxonomyOption_hex" CHECK ("hex" IS NULL OR ("key"='color' AND "hex" ~ '^#[0-9A-F]{6}$'));
ALTER TABLE public."TaxonomyOption" DROP CONSTRAINT "TaxonomyOption_label";
ALTER TABLE public."TaxonomyOption" ADD CONSTRAINT "TaxonomyOption_label" CHECK (length(trim("label")) BETWEEN CASE WHEN "key"='size' THEN 1 ELSE 2 END AND 80 AND "label" !~ '[[:cntrl:]<>]');
COMMIT;
