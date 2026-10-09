-- Simplify the live React Native product model.
-- The product row keeps only the canonical uses field and description field.
-- Existing price history is not reliable, so historic price_updated_at values
-- stay NULL and are populated by the trigger on future confirmed price changes.

DROP TRIGGER IF EXISTS sync_drugs_use_route ON public.drugs;
DROP FUNCTION IF EXISTS public.sync_drugs_use_route();
DROP VIEW IF EXISTS public.drug_medical_effective;

CREATE OR REPLACE FUNCTION public.get_active_ingredient_medical_info(p_scientific_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH keys AS (
    SELECT DISTINCT public.normalize_active_ingredient(component) AS ingredient_key
    FROM regexp_split_to_table(coalesce(p_scientific_name, ''), '[+;,/]+') AS component
  ),
  matched AS (
    SELECT m.*
    FROM public.active_ingredient_medical_info m
    JOIN keys k ON k.ingredient_key = m.ingredient_key
  ),
  merged AS (
    SELECT
      coalesce((SELECT jsonb_agg(value ORDER BY value::text)
        FROM (SELECT DISTINCT value FROM matched, jsonb_array_elements(matched.uses) value
              WHERE jsonb_typeof(matched.uses) = 'array') x), '[]'::jsonb) AS uses,
      coalesce((SELECT jsonb_agg(value ORDER BY value::text)
        FROM (SELECT DISTINCT value FROM matched, jsonb_array_elements(matched.side_effects) value
              WHERE jsonb_typeof(matched.side_effects) = 'array') x), '[]'::jsonb) AS side_effects,
      coalesce((SELECT jsonb_agg(value ORDER BY value::text)
        FROM (SELECT DISTINCT value FROM matched, jsonb_array_elements(matched.contraindications) value
              WHERE jsonb_typeof(matched.contraindications) = 'array') x), '[]'::jsonb) AS contraindications,
      (SELECT source_url FROM matched WHERE source_url IS NOT NULL ORDER BY updated_at DESC LIMIT 1) AS source_url,
      (SELECT source_name FROM matched WHERE source_name IS NOT NULL ORDER BY updated_at DESC LIMIT 1) AS source_name,
      (SELECT max(updated_at) FROM matched) AS updated_at
  )
  SELECT jsonb_build_object(
    'uses', merged.uses,
    'side_effects', merged.side_effects,
    'contraindications', merged.contraindications,
    'source_url', merged.source_url,
    'source_name', merged.source_name,
    'updated_at', merged.updated_at
  )
  FROM merged;
$function$;

ALTER TABLE public.drugs
  ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_drug_price_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.price_egp IS NOT NULL AND NEW.price_updated_at IS NULL THEN
      NEW.price_updated_at := now();
    END IF;
  ELSIF NEW.price_egp IS DISTINCT FROM OLD.price_egp THEN
    NEW.price_updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_drug_price_updated_at() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS set_drug_price_updated_at ON public.drugs;
CREATE TRIGGER set_drug_price_updated_at
  BEFORE INSERT OR UPDATE OF price_egp ON public.drugs
  FOR EACH ROW EXECUTE FUNCTION public.set_drug_price_updated_at();

ALTER TABLE public.drugs
  DROP COLUMN IF EXISTS route,
  DROP COLUMN IF EXISTS uses_summary_en,
  DROP COLUMN IF EXISTS drug_class,
  DROP COLUMN IF EXISTS dosage;

ALTER TABLE public.drug_medical_info
  DROP COLUMN IF EXISTS dosages;

ALTER TABLE public.active_ingredient_medical_info
  DROP COLUMN IF EXISTS dosage;

ALTER TABLE public.drug_combination_medical_info
  DROP COLUMN IF EXISTS dosages;

DROP TABLE IF EXISTS public.dosage_reference;

CREATE VIEW public.drug_medical_effective AS
WITH components AS (
  SELECT d.id AS drug_id,
         public.normalize_active_ingredient(component.component) AS ingredient_key
  FROM public.drugs d
  CROSS JOIN LATERAL regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+' ) AS component(component)
),
grouped AS (
  SELECT components.drug_id,
         array_agg(DISTINCT components.ingredient_key ORDER BY components.ingredient_key)
           FILTER (WHERE length(components.ingredient_key) >= 2) AS ingredient_keys
  FROM components
  GROUP BY components.drug_id
),
prepared AS (
  SELECT grouped.drug_id,
         grouped.ingredient_keys,
         coalesce(array_length(grouped.ingredient_keys, 1), 0) AS ingredient_count,
         CASE WHEN coalesce(array_length(grouped.ingredient_keys, 1), 0) > 1
              THEN array_to_string(grouped.ingredient_keys, '+')
              ELSE NULL END AS combination_key
  FROM grouped
),
single_info AS (
  SELECT p.drug_id, m.medical_uses, m.cosmetic_uses, m.side_effects,
         m.contraindications, m.source_url, m.source_name, m.updated_at
  FROM prepared p
  JOIN public.active_ingredient_medical_info m ON m.ingredient_key = p.ingredient_keys[1]
  WHERE p.ingredient_count = 1
),
combo_info AS (
  SELECT p.drug_id, c.medical_uses, c.cosmetic_uses, c.side_effects,
         c.contraindications, c.source_url, c.source_name, c.updated_at
  FROM prepared p
  JOIN public.drug_combination_medical_info c ON c.combination_key = p.combination_key
  WHERE p.ingredient_count > 1
)
SELECT d.id AS drug_id,
       CASE
         WHEN p.ingredient_count > 1 THEN
           CASE WHEN upper(coalesce(d.product_type, '')) = 'COSMETIC'
                THEN coalesce(ci.cosmetic_uses, '[]'::jsonb)
                ELSE coalesce(ci.medical_uses, '[]'::jsonb) END
         WHEN upper(coalesce(d.product_type, '')) = 'MEDICINE'
           THEN coalesce(si.medical_uses, '[]'::jsonb)
         WHEN upper(coalesce(d.product_type, '')) = 'COSMETIC'
           THEN coalesce(si.cosmetic_uses, '[]'::jsonb)
         ELSE '[]'::jsonb
       END AS uses,
       CASE WHEN p.ingredient_count > 1
            THEN coalesce(ci.side_effects, '[]'::jsonb)
            ELSE coalesce(si.side_effects, '[]'::jsonb) END AS side_effects,
       CASE WHEN p.ingredient_count > 1
            THEN coalesce(ci.contraindications, '[]'::jsonb)
            ELSE coalesce(si.contraindications, '[]'::jsonb) END AS contraindications,
       CASE WHEN p.ingredient_count > 1 THEN ci.source_url ELSE si.source_url END AS source_url,
       CASE WHEN p.ingredient_count > 1 THEN ci.source_name ELSE si.source_name END AS source_name,
       CASE WHEN p.ingredient_count > 1 THEN ci.updated_at ELSE si.updated_at END AS updated_at
FROM public.drugs d
LEFT JOIN prepared p ON p.drug_id = d.id
LEFT JOIN single_info si ON si.drug_id = d.id
LEFT JOIN combo_info ci ON ci.drug_id = d.id;
