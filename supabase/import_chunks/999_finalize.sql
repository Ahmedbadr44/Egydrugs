update public.drug_data_version set version = version + 1, updated_at = now() where id = 1;
analyze public.drugs;
select count(*) as imported_drugs from public.drugs;
