-- Canonical field for product uses/indications.
-- Keep route in sync temporarily because the original Kotlin app still selects it.
ALTER TABLE public.drugs
  ADD COLUMN IF NOT EXISTS "use" text;

UPDATE public.drugs
SET "use" = route
WHERE "use" IS NULL;

CREATE OR REPLACE FUNCTION public.sync_drugs_use_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."use" IS NULL OR btrim(NEW."use") = '' THEN
      NEW."use" := NEW.route;
    ELSIF NEW.route IS NULL OR btrim(NEW.route) = '' THEN
      NEW.route := NEW."use";
    ELSIF NEW."use" IS DISTINCT FROM NEW.route THEN
      NEW.route := NEW."use";
    END IF;
  ELSE
    IF NEW."use" IS DISTINCT FROM OLD."use"
       AND NEW.route IS NOT DISTINCT FROM OLD.route THEN
      NEW.route := NEW."use";
    ELSIF NEW.route IS DISTINCT FROM OLD.route
       AND NEW."use" IS NOT DISTINCT FROM OLD."use" THEN
      NEW."use" := NEW.route;
    ELSIF NEW."use" IS DISTINCT FROM NEW.route THEN
      NEW.route := NEW."use";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_drugs_use_route ON public.drugs;
CREATE TRIGGER sync_drugs_use_route
BEFORE INSERT OR UPDATE ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.sync_drugs_use_route();
