BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public."ProductProfile" ADD COLUMN "dynamicAttributes" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public."ProductProfile" ADD CONSTRAINT "ProductProfile_dynamicAttributes_object" CHECK (jsonb_typeof("dynamicAttributes") = 'object');
COMMIT;
