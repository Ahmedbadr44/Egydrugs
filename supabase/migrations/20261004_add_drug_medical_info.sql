-- Medical information and product image metadata for Egydrugs.
-- Content is stored separately from the product catalog so it can be updated
-- without rewriting the main drug table.

create table if not exists public.drug_medical_info (
    drug_id bigint primary key references public.drugs(id) on delete cascade,
    uses jsonb not null default '[]'::jsonb,
    dosages jsonb not null default '[]'::jsonb,
    side_effects jsonb not null default '[]'::jsonb,
    warnings jsonb not null default '[]'::jsonb,
    image_url text,
    image_source_url text,
    image_source_name text,
    source_url text,
    source_name text,
    confidence numeric(4,3),
    updated_at timestamptz not null default now(),
    constraint drug_medical_info_uses_array check (jsonb_typeof(uses) = 'array'),
    constraint drug_medical_info_dosages_array check (jsonb_typeof(dosages) = 'array'),
    constraint drug_medical_info_side_effects_array check (jsonb_typeof(side_effects) = 'array'),
    constraint drug_medical_info_warnings_array check (jsonb_typeof(warnings) = 'array'),
    constraint drug_medical_info_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists idx_drug_medical_info_updated_at
    on public.drug_medical_info(updated_at desc);

alter table public.drug_medical_info enable row level security;

revoke all on public.drug_medical_info from public, anon, authenticated;
grant select on public.drug_medical_info to anon, authenticated;
grant insert, update, delete on public.drug_medical_info to authenticated;

drop policy if exists "Anyone can read drug medical info" on public.drug_medical_info;
create policy "Anyone can read drug medical info"
    on public.drug_medical_info for select
    to anon, authenticated
    using (true);

drop policy if exists "Admins can insert drug medical info" on public.drug_medical_info;
create policy "Admins can insert drug medical info"
    on public.drug_medical_info for insert
    to authenticated
    with check ((select private.is_drug_admin()));

drop policy if exists "Admins can update drug medical info" on public.drug_medical_info;
create policy "Admins can update drug medical info"
    on public.drug_medical_info for update
    to authenticated
    using ((select private.is_drug_admin()))
    with check ((select private.is_drug_admin()));

drop policy if exists "Admins can delete drug medical info" on public.drug_medical_info;
create policy "Admins can delete drug medical info"
    on public.drug_medical_info for delete
    to authenticated
    using ((select private.is_drug_admin()));

create or replace function public.set_drug_medical_info_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists drug_medical_info_updated_at on public.drug_medical_info;
create trigger drug_medical_info_updated_at
before update on public.drug_medical_info
for each row execute function public.set_drug_medical_info_updated_at();
