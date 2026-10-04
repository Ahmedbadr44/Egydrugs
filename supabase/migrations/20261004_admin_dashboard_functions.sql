drop function if exists public.list_active_ingredients(text, integer, integer);
create or replace function public.list_active_ingredients(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(ingredient_key text, display_name text, product_count bigint, has_medical_info boolean)
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
      and (coalesce(trim(p_search), '') = ''
           or c.ingredient_key ilike '%' || public.normalize_active_ingredient(p_search) || '%')
    group by c.ingredient_key
  )
  select
    g.ingredient_key,
    coalesce(m.display_name, g.ingredient_key) as display_name,
    g.product_count,
    (m.ingredient_key is not null) as has_medical_info
  from grouped g
  left join public.active_ingredient_medical_info m on m.ingredient_key = g.ingredient_key
  order by g.product_count desc, display_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with ingredient_components as (
    select d.id, public.normalize_active_ingredient(component) as ingredient_key
    from public.drugs d
    cross join lateral regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') as component
  ),
  ingredients as (
    select ingredient_key, count(distinct id) as product_count
    from ingredient_components
    where length(ingredient_key) >= 2 and ingredient_key !~ '^[0-9 .-]+$'
    group by ingredient_key
  ),
  drug_medical as (
    select count(distinct drug_id) as count from public.drug_medical_info
    where jsonb_array_length(coalesce(uses,'[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(side_effects,'[]'::jsonb)) > 0
  ),
  covered_ingredients as (
    select count(*) as count
    from ingredients i
    join public.active_ingredient_medical_info m on m.ingredient_key=i.ingredient_key
    where jsonb_array_length(coalesce(m.uses,'[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(m.side_effects,'[]'::jsonb)) > 0
  )
  select jsonb_build_object(
    'total_drugs', (select count(*) from public.drugs),
    'total_ingredients', (select count(*) from ingredients),
    'ingredients_with_medical', (select count from covered_ingredients),
    'drugs_with_medical', (select count from drug_medical),
    'missing_arabic', (select count(*) from public.drugs where nullif(trim(commercial_name_ar),'') is null),
    'missing_scientific', (select count(*) from public.drugs where nullif(trim(scientific_name),'') is null),
    'missing_price', (select count(*) from public.drugs where price_egp is null)
  );
$$;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
