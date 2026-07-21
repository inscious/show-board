-- ============================================================================
-- Phase A / Stage 1 — multi-tenant + Platform Admin foundation.
--
-- STAGING ONLY. Not yet applied to production. This is the reviewed artifact
-- that eventually becomes a production handoff (same pattern as every past
-- schema change — see supabase/schema.sql) once proven here. Do not fold
-- this into schema.sql until it's actually been run against production.
--
-- Run against show-board-staging via psql (session pooler — the direct
-- connection host is IPv6-only, see .env.staging.local for why).
-- ============================================================================

-- ========== organizations: one table, every org type ==========
create table organizations (
  id                   bigint generated always as identity primary key,
  type                 text not null check (type in ('union','labor_provider','district_council','general_contractor','training_center')),
  name                 text not null,
  slug                 text unique,
  district_council_id  bigint references organizations(id),
  org_profile          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  archived_at          timestamptz,
  constraint organizations_district_council_scope check (district_council_id is null or type = 'union')
);
create index on organizations (type);

insert into organizations (type, name, org_profile)
values ('district_council', 'District Council 36', '{}'::jsonb);

insert into organizations (type, name, district_council_id, org_profile)
select 'union', 'IUPAT Local 831', id,
       coalesce((select org_profile from app_settings where id = 1), '{}'::jsonb)
from organizations where type = 'district_council' and name = 'District Council 36';

-- ========== platform_admins: separate identity, no self-service writes ==========
create table platform_admins (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
create policy "own row" on platform_admins for select using (id = auth.uid());
-- deliberately no insert/update/delete policy for anyone, including the
-- row's own owner — platform-admin accounts are provisioned by hand only.

create or replace function is_platform_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;

alter table organizations enable row level security;
create policy "platform admin read"   on organizations for select to authenticated using (is_platform_admin());
create policy "platform admin write"  on organizations for insert to authenticated with check (is_platform_admin());
create policy "platform admin update" on organizations for update to authenticated using (is_platform_admin()) with check (is_platform_admin());

-- ========== handle_new_user(): skip profiles row for platform admins ==========
-- Every new auth.users row fires this trigger, which unconditionally
-- inserted a profiles row before this change — a platform-admin identity
-- would otherwise land as a stray, confusing apprentice-shaped row (visible
-- in PendingSignupsPanel, which filters is_admin=false + approved_at null).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'platform_admin', 'false') = 'true' then
    return new;
  end if;
  insert into public.profiles (id, email, is_admin, name)
  values (new.id, new.email, false, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

-- ========== organization_id: only where it means something today ==========
alter table profiles      add column organization_id bigint references organizations(id);
alter table shows         add column organization_id bigint references organizations(id);
alter table jatc_contacts add column organization_id bigint references organizations(id);
alter table dc36_contacts add column organization_id bigint references organizations(id);

-- Certified Journeyman status — bundled here since it touches the same
-- trigger update below anyway. No UI reads this yet (separate, later work).
alter table profiles add column graduated_at timestamptz;

update profiles      set organization_id = (select id from organizations where name = 'IUPAT Local 831') where organization_id is null;
update shows         set organization_id = (select id from organizations where name = 'IUPAT Local 831') where organization_id is null;
update jatc_contacts set organization_id = (select id from organizations where name = 'IUPAT Local 831') where organization_id is null;
update dc36_contacts set organization_id = (select id from organizations where name = 'District Council 36') where organization_id is null;

-- ========== protect_profile_privilege_columns(): guard the two new columns ==========
-- organization_id and graduated_at are new privilege-bearing columns sitting
-- behind the otherwise wide-open "own profile" RLS policy — same class of
-- column this trigger already exists to guard (is_admin/archived_at/
-- do_not_hire_at/do_not_hire_reason/approved_at). Non-negotiable: without
-- this, an apprentice could reassign their own union affiliation or
-- self-promote to CJ via a raw REST call.
create or replace function protect_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin_user() then
    new.is_admin := old.is_admin;
    new.archived_at := old.archived_at;
    new.do_not_hire_at := old.do_not_hire_at;
    new.do_not_hire_reason := old.do_not_hire_reason;
    new.approved_at := old.approved_at;
    new.organization_id := old.organization_id;
    new.graduated_at := old.graduated_at;
  end if;
  return new;
end;
$$;
