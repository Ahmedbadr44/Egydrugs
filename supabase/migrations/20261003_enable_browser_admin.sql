-- Run once in Supabase SQL Editor before using admin/index.html.
-- The Android app stays read-only; only signed-in users listed below can write.

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.drug_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.drug_admins enable row level security;

revoke all on public.drugs from public, anon, authenticated;
grant select on public.drugs to anon, authenticated;
grant insert, update, delete on public.drugs to authenticated;
grant usage, select on sequence public.drugs_id_seq to authenticated;

revoke all on public.drug_admins from public, anon, authenticated;
grant select on public.drug_admins to authenticated;

create or replace function private.is_drug_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.drug_admins
        where user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_drug_admin() from public, anon;
grant execute on function private.is_drug_admin() to authenticated;

drop policy if exists "Users can check their admin status" on public.drug_admins;
create policy "Users can check their admin status"
    on public.drug_admins for select
    to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Admins can insert drugs" on public.drugs;
create policy "Admins can insert drugs"
    on public.drugs for insert
    to authenticated
    with check ((select private.is_drug_admin()));

drop policy if exists "Admins can update drugs" on public.drugs;
create policy "Admins can update drugs"
    on public.drugs for update
    to authenticated
    using ((select private.is_drug_admin()))
    with check ((select private.is_drug_admin()));

drop policy if exists "Admins can delete drugs" on public.drugs;
create policy "Admins can delete drugs"
    on public.drugs for delete
    to authenticated
    using ((select private.is_drug_admin()));

-- Add each browser administrator after creating their Auth user:
-- insert into public.drug_admins (user_id) values ('AUTH_USER_UUID');
