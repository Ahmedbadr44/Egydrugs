-- Retire the admin dashboard and unused medical/dosage data.
-- Canonical application data remains in public.drugs.

DROP VIEW IF EXISTS public.drug_medical_effective;

DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS public.list_active_ingredients(text, integer, integer);
DROP FUNCTION IF EXISTS public.get_active_ingredient_medical_info(text);
DROP FUNCTION IF EXISTS public.find_drug_ids_by_active_ingredient(text);
DROP FUNCTION IF EXISTS public.normalize_active_ingredient(text);

DROP TRIGGER IF EXISTS sync_drugs_use_route ON public.drugs;
DROP FUNCTION IF EXISTS public.sync_drugs_use_route();
DROP TRIGGER IF EXISTS bump_drug_data_version ON public.drugs;
DROP TRIGGER IF EXISTS set_drug_updated_at ON public.drugs;
DROP FUNCTION IF EXISTS public.bump_drug_data_version();
DROP FUNCTION IF EXISTS public.set_drug_updated_at();

DROP TABLE IF EXISTS public.drug_medical_info;
DROP TABLE IF EXISTS public.active_ingredient_medical_info;
DROP TABLE IF EXISTS public.drug_combination_medical_info;
DROP TABLE IF EXISTS public.dosage_reference;
DROP TABLE IF EXISTS public.drug_admins;
DROP TABLE IF EXISTS public.drug_data_version;
DROP TABLE IF EXISTS public.eg_drugs_source_20261006;

DROP FUNCTION IF EXISTS public.set_active_ingredient_medical_info_updated_at();
DROP FUNCTION IF EXISTS public.set_drug_medical_info_updated_at();
DROP FUNCTION IF EXISTS public.set_drug_medical_sync_updated_at();

ALTER TABLE public.drugs
    ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;

ALTER TABLE public.drugs
    DROP COLUMN IF EXISTS drug_class,
    DROP COLUMN IF EXISTS route,
    DROP COLUMN IF EXISTS uses_summary_en,
    DROP COLUMN IF EXISTS dosage,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS price_source,
    DROP COLUMN IF EXISTS source_record_id,
    DROP COLUMN IF EXISTS source_name;

DROP POLICY IF EXISTS "Admins can insert drugs" ON public.drugs;
DROP POLICY IF EXISTS "Admins can update drugs" ON public.drugs;
DROP POLICY IF EXISTS "Admins can delete drugs" ON public.drugs;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.drugs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.drugs TO anon, authenticated;
DROP POLICY IF EXISTS "Anyone can read drugs" ON public.drugs;
CREATE POLICY "Anyone can read drugs"
    ON public.drugs FOR SELECT TO anon, authenticated USING (true);

DO $cleanup$
BEGIN
    IF to_regnamespace('private') IS NOT NULL THEN
        EXECUTE 'DROP FUNCTION IF EXISTS private.is_drug_admin()';
    END IF;
END
$cleanup$;

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

REVOKE ALL ON FUNCTION public.set_drug_price_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS set_drug_price_updated_at ON public.drugs;
CREATE TRIGGER set_drug_price_updated_at
    BEFORE INSERT OR UPDATE OF price_egp ON public.drugs
    FOR EACH ROW EXECUTE FUNCTION public.set_drug_price_updated_at();
