-- Harden medical-info trigger functions against search_path changes.
alter function public.set_drug_medical_info_updated_at() set search_path = public;
alter function public.set_drug_medical_sync_updated_at() set search_path = public;
