-- ============================================================================
-- app_settings organization-scoping (Phase 2 hardening, approved 2026-08-06).
--
-- app_settings was a true singleton (id=1, checked by app_settings_singleton)
-- with an admin-write RLS policy that only checked is_admin_user() — no
-- organization check at all. Harmless while Local 831 is the only tenant;
-- becomes a real cross-tenant write the moment a second union's admin
-- exists (any admin could flip another union's self-signup/OJT-auto-approve
-- toggles or overwrite their org profile). This closes that gap.
--
-- Deliberately NOT touching organizations.org_profile (a dead, one-time
-- snapshot copied here at Stage 1 seed time, never read by anything) — that
-- cleanup is unrelated and left for its own pass.
-- ============================================================================

-- ========== 1. add the column, backfill, before any constraint changes ==========
alter table app_settings add column organization_id bigint references organizations(id);

update app_settings
  set organization_id = (select id from organizations where name = 'IUPAT Local 831')
  where id = 1;

-- ========== 2. id was a hardcoded constant (default 1), not a sequence — fine
-- for a true singleton, but every second insert would collide on the same PK
-- once more than one row can exist. Convert to a real identity column. ==========
alter table app_settings alter column id drop default;
alter table app_settings alter column id add generated always as identity;
select setval(pg_get_serial_sequence('app_settings', 'id'), (select max(id) from app_settings));

-- ========== 3. replace the singleton constraint with an org-uniqueness one ==========
alter table app_settings drop constraint app_settings_singleton;
alter table app_settings add constraint app_settings_org_unique unique (organization_id);

-- ========== 4. seed a settings row automatically for every new UNION org only —
-- these fields (self-signup, OJT auto-approve, JATC office address) are
-- meaningless for a labor_provider/general_contractor/training_center org. ==========
create or replace function seed_org_app_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'union' then
    insert into app_settings (organization_id) values (new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_organization_created_seed_settings on organizations;
create trigger on_organization_created_seed_settings
after insert on organizations
for each row execute function seed_org_app_settings();

-- ========== 5. RLS — replace the two unscoped policies with four scoped ones ==========
-- Production's actual policy names ("admin writes" / "anyone reads") differ
-- from what schema.sql documents ("admin can update" / "anyone can read") —
-- real drift, caught by actually running this against production (rolled
-- back cleanly, transaction-wrapped) rather than by reviewing schema.sql.
-- if exists guards against a re-run, not against guessing the wrong name.
drop policy if exists "admin writes" on app_settings;
drop policy if exists "anyone reads" on app_settings;

-- any authenticated user (apprentice, pending, or admin) reads their own org's
-- row — admin_organization_id() resolves for any signed-in user despite its
-- name (see supabase/stage2_org_scoping.sql), not just admins.
create policy "read own org" on app_settings for select to authenticated
  using (organization_id = admin_organization_id());

-- platform admins have no profiles row (handle_new_user() skips creating one
-- for them), so admin_organization_id() returns NULL for them — without this,
-- the platform console would lose read access entirely, a real regression.
create policy "platform admin read all" on app_settings for select to authenticated
  using (is_platform_admin());

-- pre-auth (login/signup pages, no session yet) — intentional temporary
-- limitation, NOT a redesign of login/signup routing. There is currently no
-- way for an unauthenticated visitor to indicate which union they belong to
-- (no subdomain, no org-picker), so /login and /signup keep showing Local
-- 831's settings specifically until organization-aware public entry points
-- are designed as their own separate piece of work.
--
-- Looked up by name via a SECURITY DEFINER helper, not a bare subquery —
-- organizations' own RLS is platform-admin-only ("platform admin read",
-- stage1_staging.sql), so a plain subquery here would run as the querying
-- role (anon) and see zero rows, silently denying every pre-auth read
-- (caught by actually testing this against staging, not just by reviewing
-- the policy — an anon curl request came back empty until this fix).
create or replace function interim_preauth_organization_id()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select id from organizations where name = 'IUPAT Local 831';
$$;

create policy "public read pilot org" on app_settings for select to anon
  using (organization_id = interim_preauth_organization_id());

-- the actual fix: admin write scoped to the admin's own organization.
create policy "admin update own org" on app_settings for update to authenticated
  using (is_admin_user() and organization_id = admin_organization_id())
  with check (is_admin_user() and organization_id = admin_organization_id());
