create or replace view public.drug_medical_effective as
select
  d.id as drug_id,
  coalesce(
    (
      select jsonb_agg(value order by value::text)
      from (
        select distinct u.value
        from regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component
        join public.active_ingredient_medical_info m
          on m.ingredient_key = public.normalize_active_ingredient(component)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(m.uses)='array' then m.uses else '[]'::jsonb end
        ) u(value)
      ) u
    ),
    '[]'::jsonb
  ) as uses,
  coalesce(
    (
      select jsonb_agg(value order by value::text)
      from (
        select distinct s.value
        from regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component
        join public.active_ingredient_medical_info m
          on m.ingredient_key = public.normalize_active_ingredient(component)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(m.side_effects)='array' then m.side_effects else '[]'::jsonb end
        ) s(value)
      ) s
    ),
    '[]'::jsonb
  ) as side_effects,
  (
    select m.source_url
    from regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component
    join public.active_ingredient_medical_info m
      on m.ingredient_key = public.normalize_active_ingredient(component)
    where m.source_url is not null
    order by m.updated_at desc
    limit 1
  ) as source_url,
  (
    select m.source_name
    from regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component
    join public.active_ingredient_medical_info m
      on m.ingredient_key = public.normalize_active_ingredient(component)
    where m.source_name is not null
    order by m.updated_at desc
    limit 1
  ) as source_name,
  (
    select max(m.updated_at)
    from regexp_split_to_table(coalesce(d.scientific_name, ''), '[+;,/]+') component
    join public.active_ingredient_medical_info m
      on m.ingredient_key = public.normalize_active_ingredient(component)
  ) as updated_at
from public.drugs d;

grant select on public.drug_medical_effective to anon, authenticated;
