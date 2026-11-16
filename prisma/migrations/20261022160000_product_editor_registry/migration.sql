-- Phase2.9.3 STAGED: approved for isolated test only, NOT main.
-- Additive registry, no invented products/options, no role/grant/ownership changes.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public."TaxonomyOption" (
 "key" TEXT NOT NULL, "token" TEXT NOT NULL, "label" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TaxonomyOption_pkey" PRIMARY KEY ("key","token"),
 CONSTRAINT "TaxonomyOption_label" CHECK (length(trim("label")) BETWEEN 2 AND 80 AND "label" !~ '[[:cntrl:]<>]'),
 CONSTRAINT "TaxonomyOption_token" CHECK (length("token") <= 60 AND CASE WHEN "key"='size' THEN "token" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' ELSE "token" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' END AND "token" <> 'not-applicable'),
 CONSTRAINT "TaxonomyOption_key" CHECK ("key" IN ('collar','fabric','gender','fit','color','size','garmentType','styleTags','seasonTags','occasionTags','layerRole','pattern','silhouette'))
);
ALTER TABLE public."Product" DROP CONSTRAINT "Product_code_format";
ALTER TABLE public."Product" ADD CONSTRAINT "Product_code_format" CHECK (length("productCode")<=60 AND "productCode" ~ '^AUR-([0-9]{4,12}|[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-[0-9]{3,6})$');
CREATE FUNCTION public.aurel_option_valid(option_key TEXT, option_token TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT option_token IS NULL OR CASE option_key
 WHEN 'collar' THEN option_token=ANY(ARRAY['round-neck','v-neck','polo','high-neck','shirt-collar']::text[])
 WHEN 'fabric' THEN option_token=ANY(ARRAY['cotton','linen','denim','polyester','wool','silk','viscose','nylon','leather']::text[])
 WHEN 'gender' THEN option_token=ANY(ARRAY['men','women','unisex']::text[])
 WHEN 'fit' THEN option_token=ANY(ARRAY['slim-fit','regular-fit','relaxed-fit','oversized']::text[])
 WHEN 'color' THEN option_token=ANY(ARRAY['black','white','beige','brown','navy','blue','red','green','grey','pink','yellow','purple','orange']::text[])
 WHEN 'size' THEN option_token=ANY(ARRAY['XS','S','M','L','XL','XXL']::text[])
 WHEN 'garmentType' THEN option_token=ANY(ARRAY['t-shirt','shirt','polo','trousers','jeans','shorts','skirt','dress','jacket','coat','knitwear']::text[])
 WHEN 'styleTags' THEN option_token=ANY(ARRAY['minimal','classic','casual','formal','streetwear','sporty']::text[])
 WHEN 'seasonTags' THEN option_token=ANY(ARRAY['spring','summer','autumn','winter','all-season']::text[])
 WHEN 'occasionTags' THEN option_token=ANY(ARRAY['everyday','work','evening','travel','sport','ceremony']::text[])
 WHEN 'layerRole' THEN option_token=ANY(ARRAY['base','mid','outer','standalone']::text[])
 WHEN 'pattern' THEN option_token=ANY(ARRAY['solid','striped','checked','floral','graphic','textured']::text[])
 WHEN 'silhouette' THEN option_token=ANY(ARRAY['straight','a-line','tapered','wide','fitted','boxy']::text[])
 ELSE false END OR (option_key IN ('collar','fabric','gender','fit','garmentType','styleTags','seasonTags','occasionTags','layerRole','pattern','silhouette') AND option_token='not-applicable')
 OR EXISTS (SELECT 1 FROM public."TaxonomyOption" WHERE "key"=option_key AND "token"=option_token);
$$;
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_collar_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_fabric_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_gender_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_fit_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_garmentType_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_styleTags_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_seasonTags_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_occasionTags_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_layerRole_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_pattern_taxonomy";
ALTER TABLE public."ProductProfile" DROP CONSTRAINT "ProductProfile_silhouette_taxonomy";
CREATE FUNCTION public.aurel_validate_profile_options() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE k TEXT; value JSONB; item TEXT;
BEGIN
 FOREACH k IN ARRAY ARRAY['collar','fabric','gender','fit','garmentType','styleTags','seasonTags','occasionTags','layerRole','pattern','silhouette'] LOOP
  value:=to_jsonb(NEW)->k;
  IF jsonb_typeof(value)='array' THEN
   IF value ? 'not-applicable' AND jsonb_array_length(value)<>1 THEN RAISE EXCEPTION 'Invalid taxonomy state' USING ERRCODE='23514'; END IF;
   FOR item IN SELECT jsonb_array_elements_text(value) LOOP
    IF item IS NULL OR NOT public.aurel_option_valid(k,item) THEN RAISE EXCEPTION 'Invalid taxonomy token' USING ERRCODE='23514'; END IF;
   END LOOP;
  ELSIF NOT public.aurel_option_valid(k,to_jsonb(NEW)->>k) THEN RAISE EXCEPTION 'Invalid taxonomy token' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductProfile_registry_validation" BEFORE INSERT OR UPDATE ON public."ProductProfile" FOR EACH ROW EXECUTE FUNCTION public.aurel_validate_profile_options();
CREATE FUNCTION public.aurel_validate_variant_options() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NOT public.aurel_option_valid('color',NEW.color) OR NOT public.aurel_option_valid('size',NEW.size) THEN RAISE EXCEPTION 'Invalid variant taxonomy' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "ProductVariant_registry_validation" BEFORE INSERT OR UPDATE OF color,size ON public."ProductVariant" FOR EACH ROW EXECUTE FUNCTION public.aurel_validate_variant_options();
CREATE FUNCTION public.aurel_registry_append_only() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Taxonomy registry is append-only' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER "TaxonomyOption_append_only" BEFORE UPDATE OR DELETE ON public."TaxonomyOption" FOR EACH ROW EXECUTE FUNCTION public.aurel_registry_append_only();
REVOKE ALL ON FUNCTION public.aurel_validate_profile_options() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aurel_validate_variant_options() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aurel_registry_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aurel_option_valid(TEXT,TEXT) FROM PUBLIC;
COMMIT;
