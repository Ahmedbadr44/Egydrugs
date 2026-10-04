begin;
truncate table public.drugs restart identity;
update public.drug_data_version set version = version + 1, updated_at = now() where id = 1;
commit;
