create or replace function public.normalize_active_ingredient(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        upper(regexp_replace(coalesce(p_value, ''), '[(][^)]*[)]', ' ', 'g')),
        '[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(MG|G|MCG|UG|GRAM|GM|KG|ML|L|IU|I[.]U[.])([[:space:]]*)$',
        '',
        'i'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;
