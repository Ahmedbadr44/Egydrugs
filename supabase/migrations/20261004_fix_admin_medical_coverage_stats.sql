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
  central_drug_coverage as (
    select count(distinct d.id) as count
    from public.drugs d
    join lateral regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component on true
    join public.active_ingredient_medical_info m
      on m.ingredient_key = public.normalize_active_ingredient(component)
    where jsonb_array_length(coalesce(m.uses,'[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(m.side_effects,'[]'::jsonb)) > 0
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
    'drugs_with_medical', (select count from central_drug_coverage),
    'missing_arabic', (select count(*) from public.drugs where nullif(trim(commercial_name_ar),'') is null),
    'missing_scientific', (select count(*) from public.drugs where nullif(trim(scientific_name),'') is null),
    'missing_price', (select count(*) from public.drugs where price_egp is null)
  );
$$;
