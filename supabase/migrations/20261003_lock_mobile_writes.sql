-- Run once in the Supabase SQL Editor for projects created with the old schema.
-- It keeps legacy administrator records intact but prevents all mobile clients,
-- including older app releases, from adding, editing, or deleting drug data.

revoke insert, update, delete on public.drugs from anon, authenticated;
revoke usage, select on sequence public.drugs_id_seq from anon, authenticated;
