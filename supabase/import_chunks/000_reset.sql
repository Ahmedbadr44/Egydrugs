-- SAFETY GUARD:
-- These legacy import chunks target a retired schema (drug_class, route, dosage,
-- drug_data_version). Do not use them against the current production database.
DO $guard$
BEGIN
  RAISE EXCEPTION 'Legacy import cancelled: import_chunks files do not match the minimal live schema. Production data was not truncated.';
END
$guard$;
