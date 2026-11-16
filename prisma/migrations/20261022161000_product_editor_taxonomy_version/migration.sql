-- Phase2.9.3 STAGED, isolated test only. Main requires separate approval.
-- Preserve v1 rows and permit the explicitly versioned shared vocabulary.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_taxonomy_version";
ALTER TABLE public."ProductProfile" ADD CONSTRAINT "ProductProfile_taxonomy_version"
  CHECK ("taxonomyVersion" IN ('aurel-fashion-v1','aurel-fashion-v2'));
COMMIT;
