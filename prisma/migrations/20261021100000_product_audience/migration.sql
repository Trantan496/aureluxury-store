-- Independent of the two pending taxonomy registry migrations. No data inference/backfill.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public."ProductProfile" ADD COLUMN "ageGroup" TEXT;
ALTER TABLE public."ProductProfile" ADD CONSTRAINT "ProductProfile_age_group"
  CHECK ("ageGroup" IN ('gen-alpha','gen-z','gen-y','gen-x','middle-aged','older-adults','children','teenagers','all-ages'));
COMMIT;
