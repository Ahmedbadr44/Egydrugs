create or replace function public.find_drug_ids_by_active_ingredient(p_ingredient text)
returns table(id bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select upper(regexp_replace(trim(coalesce(p_ingredient, '')), '[^A-Z0-9]+', ' ', 'g')) as ingredient
  )
  select d.id
  from public.drugs d
  cross join requested r
  where r.ingredient <> ''
    and exists (
      select 1
      from regexp_split_to_table(
        upper(regexp_replace(coalesce(d.scientific_name, ''), '\([^)]*\)', ' ', 'g')),
        '[^A-Z0-9]+'
      ) token
      where trim(token) <> ''
        and trim(token) = r.ingredient
    );
$$;

grant execute on function public.find_drug_ids_by_active_ingredient(text) to authenticated;
