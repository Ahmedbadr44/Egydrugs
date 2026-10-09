-- Ensure the canonical product-uses field exists. Copy legacy values only
-- when the legacy route column is present (older project states).
ALTER TABLE public.drugs
  ADD COLUMN IF NOT EXISTS "use" text;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drugs'
      AND column_name = 'route'
  ) THEN
    EXECUTE 'UPDATE public.drugs SET "use" = route WHERE "use" IS NULL';
  END IF;
END
$migration$;
