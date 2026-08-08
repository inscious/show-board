-- ============================================================================
-- union_notices organization-scoping (Sprint 1 Task 4, approved backlog item).
--
-- union_notices had no organization boundary at all — no organization_id
-- column, admin write/update/delete policies checked only is_admin_user(),
-- and the read policy was `using (true)`, unscoped for every authenticated
-- user. Unlike shows/jatc_contacts (where cross-union apprentice reads are
-- an acknowledged, deliberately deferred gap — see stage2_org_scoping.sql's
-- own comment), union_notices was never meant to be shared: it's one
-- union's own printed monthly meeting/dues/holiday sheet, closer in spirit
-- to app_settings than to the shared marketplace tables (companies,
-- labor_calls). Nothing in the app references this table from the platform
-- console, so no cross-union platform-admin read policy is added here
-- either — that would be a real feature to design later if ever wanted,
-- not something to assume now.
-- ============================================================================

-- ========== 1. add the column, backfill to Local 831 before any constraint changes ==========
alter table union_notices add column organization_id bigint references organizations(id);

update union_notices
  set organization_id = (select id from organizations where name = 'IUPAT Local 831')
  where organization_id is null;

-- ========== 2. every future row needs a real owner ==========
alter table union_notices alter column organization_id set not null;

-- ========== 3. index for the actual query shape — every read/write is scoped by org first ==========
create index union_notices_org_sheet_month_idx on union_notices (organization_id, sheet_month);

-- ========== 4. RLS — replace all four unscoped policies with org-scoped ones ==========
drop policy if exists "read" on union_notices;
drop policy if exists "admin write" on union_notices;
drop policy if exists "admin update" on union_notices;
drop policy if exists "admin delete" on union_notices;

-- any authenticated member (apprentice, pending, or admin) reads only their
-- own org's notices — admin_organization_id() resolves for any signed-in
-- user despite its name (see stage2_org_scoping.sql), not just admins.
create policy "read own org" on union_notices for select to authenticated
  using (organization_id = admin_organization_id());

create policy "admin write own org" on union_notices for insert to authenticated
  with check (is_admin_user() and organization_id = admin_organization_id());

create policy "admin update own org" on union_notices for update to authenticated
  using (is_admin_user() and organization_id = admin_organization_id())
  with check (is_admin_user() and organization_id = admin_organization_id());

create policy "admin delete own org" on union_notices for delete to authenticated
  using (is_admin_user() and organization_id = admin_organization_id());
