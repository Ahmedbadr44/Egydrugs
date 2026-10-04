-- Prioritize common self-care / OTC candidates for the first OpenFDA enrichment pass.
-- Note: US OTC status from openFDA is not used as proof of Egyptian dispensing status.
alter table public.drug_medical_sync
    add column if not exists scope text not null default 'general';

alter table public.drug_medical_sync
    add column if not exists priority integer not null default 100;

alter table public.drug_medical_sync
    drop constraint if exists drug_medical_sync_scope_check;

alter table public.drug_medical_sync
    add constraint drug_medical_sync_scope_check
    check (scope in ('common_otc_candidate', 'topical_candidate', 'general'));

alter table public.drug_medical_sync
    drop constraint if exists drug_medical_sync_priority_check;

alter table public.drug_medical_sync
    add constraint drug_medical_sync_priority_check
    check (priority between 1 and 1000);

create index if not exists idx_drug_medical_sync_priority
    on public.drug_medical_sync(provider, priority asc, updated_at asc);

-- Reset only not-yet-processed rows so the first pass starts with the intended scope.
update public.drug_medical_sync s
set scope = case
        when (
            d.commercial_name_en ~* '\\y(CREAM|OINTMENT)\\y'
            or d.commercial_name_ar ~* '(كريم|مرهم)'
        ) then 'topical_candidate'
        when (
            d.scientific_name ilike '%PARACETAMOL%'
            or d.scientific_name ilike '%ACETAMINOPHEN%'
            or d.scientific_name ilike '%IBUPROFEN%'
            or d.scientific_name ilike '%CETIRIZINE%'
            or d.scientific_name ilike '%LORATADINE%'
            or d.scientific_name ilike '%FEXOFENADINE%'
            or d.scientific_name ilike '%ALUMINIUM HYDROXIDE%'
            or d.scientific_name ilike '%MAGNESIUM HYDROXIDE%'
            or d.scientific_name ilike '%CALCIUM CARBONATE%'
            or d.scientific_name ilike '%GUAIFENESIN%'
            or d.scientific_name ilike '%DEXTROMETHORPHAN%'
            or d.scientific_name ilike '%SIMETHICONE%'
        ) then 'common_otc_candidate'
        else 'general'
    end,
    priority = case
        when (
            d.scientific_name ilike '%PARACETAMOL%'
            or d.scientific_name ilike '%ACETAMINOPHEN%'
            or d.scientific_name ilike '%IBUPROFEN%'
            or d.scientific_name ilike '%CETIRIZINE%'
            or d.scientific_name ilike '%LORATADINE%'
            or d.scientific_name ilike '%FEXOFENADINE%'
            or d.scientific_name ilike '%ALUMINIUM HYDROXIDE%'
            or d.scientific_name ilike '%MAGNESIUM HYDROXIDE%'
            or d.scientific_name ilike '%CALCIUM CARBONATE%'
            or d.scientific_name ilike '%GUAIFENESIN%'
            or d.scientific_name ilike '%DEXTROMETHORPHAN%'
            or d.scientific_name ilike '%SIMETHICONE%'
        ) then 10
        when (
            d.commercial_name_en ~* '\\y(CREAM|OINTMENT)\\y'
            or d.commercial_name_ar ~* '(كريم|مرهم)'
        ) then 20
        else 100
    end
from public.drugs d
where d.id = s.drug_id
  and s.provider = 'openFDA'
  and s.status = 'pending';

-- Ensure newly added drugs inherit the default general queue state.
