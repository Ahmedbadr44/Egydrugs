create table if not exists public.active_ingredient_medical_info (
  ingredient_key text primary key,
  display_name text not null,
  uses jsonb not null default '[]'::jsonb,
  side_effects jsonb not null default '[]'::jsonb,
  source_url text,
  source_name text,
  updated_at timestamptz not null default now(),
  constraint active_ingredient_medical_info_ingredient_key_nonempty check (length(trim(ingredient_key)) >= 2),
  constraint active_ingredient_medical_info_uses_array check (jsonb_typeof(uses) = 'array'),
  constraint active_ingredient_medical_info_side_effects_array check (jsonb_typeof(side_effects) = 'array')
);

alter table public.active_ingredient_medical_info enable row level security;

drop policy if exists "Anyone can read active ingredient medical info" on public.active_ingredient_medical_info;
create policy "Anyone can read active ingredient medical info"
on public.active_ingredient_medical_info for select to anon, authenticated using (true);

drop policy if exists "Admins can insert active ingredient medical info" on public.active_ingredient_medical_info;
create policy "Admins can insert active ingredient medical info"
on public.active_ingredient_medical_info for insert to authenticated
with check ((select private.is_drug_admin()));

drop policy if exists "Admins can update active ingredient medical info" on public.active_ingredient_medical_info;
create policy "Admins can update active ingredient medical info"
on public.active_ingredient_medical_info for update to authenticated
using ((select private.is_drug_admin()))
with check ((select private.is_drug_admin()));

drop policy if exists "Admins can delete active ingredient medical info" on public.active_ingredient_medical_info;
create policy "Admins can delete active ingredient medical info"
on public.active_ingredient_medical_info for delete to authenticated
using ((select private.is_drug_admin()));

create or replace function public.normalize_active_ingredient(p_value text)
returns text language sql immutable set search_path = public
as $$
  select trim(
    regexp_replace(
      upper(regexp_replace(coalesce(p_value, ''), '\\([^)]*\\)', ' ', 'g')),
      '\\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.list_active_ingredients(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(ingredient_key text, product_count bigint, has_medical_info boolean)
language sql stable security invoker set search_path = public
as $$
  with components as (
    select d.id, public.normalize_active_ingredient(component) as ingredient_key
    from public.drugs d
    cross join lateral regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') as component
  ),
  grouped as (
    select c.ingredient_key, count(distinct c.id) as product_count
    from components c
    where length(c.ingredient_key) >= 2
      and c.ingredient_key !~ '^[0-9 .-]+$'
      and (
        coalesce(trim(p_search), '') = ''
        or c.ingredient_key ilike '%' || public.normalize_active_ingredient(p_search) || '%'
      )
    group by c.ingredient_key
  )
  select g.ingredient_key, g.product_count,
    exists (select 1 from public.active_ingredient_medical_info m where m.ingredient_key = g.ingredient_key)
  from grouped g
  order by g.product_count desc, g.ingredient_key asc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.normalize_active_ingredient(text) to anon, authenticated;
grant execute on function public.list_active_ingredients(text, integer, integer) to anon, authenticated;

create or replace function public.get_active_ingredient_medical_info(p_scientific_name text)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with keys as (
    select distinct public.normalize_active_ingredient(component) as ingredient_key
    from regexp_split_to_table(coalesce(p_scientific_name, ''), '[+;,/]+') as component
  ),
  matched as (
    select m.*
    from public.active_ingredient_medical_info m
    join keys k on k.ingredient_key = m.ingredient_key
  ),
  merged as (
    select
      coalesce((
        select jsonb_agg(value order by value::text)
        from (
          select distinct value
          from matched, jsonb_array_elements(matched.uses) value
          where jsonb_typeof(matched.uses) = 'array'
        ) x
      ), '[]'::jsonb) as uses,
      coalesce((
        select jsonb_agg(value order by value::text)
        from (
          select distinct value
          from matched, jsonb_array_elements(matched.side_effects) value
          where jsonb_typeof(matched.side_effects) = 'array'
        ) x
      ), '[]'::jsonb) as side_effects,
      (select source_url from matched where source_url is not null order by updated_at desc limit 1) as source_url,
      (select source_name from matched where source_name is not null order by updated_at desc limit 1) as source_name,
      (select max(updated_at) from matched) as updated_at
  )
  select jsonb_build_object(
    'uses', merged.uses,
    'side_effects', merged.side_effects,
    'source_url', merged.source_url,
    'source_name', merged.source_name,
    'updated_at', merged.updated_at
  )
  from merged;
$$;

grant execute on function public.get_active_ingredient_medical_info(text) to anon, authenticated;

create or replace function public.set_active_ingredient_medical_info_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists active_ingredient_medical_info_updated_at on public.active_ingredient_medical_info;
create trigger active_ingredient_medical_info_updated_at
before update on public.active_ingredient_medical_info
for each row execute function public.set_active_ingredient_medical_info_updated_at();
