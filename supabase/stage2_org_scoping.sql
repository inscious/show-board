-- ============================================================================
-- Phase A / Stage 2 — org-scope every admin-facing RLS policy.
--
-- STAGING ONLY. Not yet applied to production. Stage 1 added organization_id
-- columns but deliberately left every "admin" RLS policy unscoped (is_admin_user()
-- alone) since there was only one tenant to test against — this is that
-- deferred work, now that a second real union (Local 510) exists on staging.
--
-- Without this, a Local 831 admin's "admin all"/"admin write" access would
-- reach Local 510's apprentices too — client-side filtering alone doesn't
-- close this, a raw REST call bypasses it entirely.
-- ============================================================================

create or replace function admin_organization_id()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid();
$$;

-- ========== profiles: admin read/write scoped to their own org ==========
drop policy if exists "admin read all" on profiles;
drop policy if exists "admin update all" on profiles;
create policy "admin read all" on profiles for select
  using (is_admin_user() and organization_id = admin_organization_id());
create policy "admin update all" on profiles for update
  using (is_admin_user() and organization_id = admin_organization_id())
  with check (is_admin_user() and organization_id = admin_organization_id());

-- ========== ojt_months, bookings, show_flags, work_entries: user_id -> profiles.organization_id ==========
drop policy if exists "admin all" on ojt_months;
create policy "admin all" on ojt_months for all
  using (is_admin_user() and exists (select 1 from profiles p where p.id = ojt_months.user_id and p.organization_id = admin_organization_id()))
  with check (is_admin_user() and exists (select 1 from profiles p where p.id = ojt_months.user_id and p.organization_id = admin_organization_id()));

drop policy if exists "admin read" on bookings;
create policy "admin read" on bookings for select
  using (is_admin_user() and exists (select 1 from profiles p where p.id = bookings.user_id and p.organization_id = admin_organization_id()));

drop policy if exists "admin read" on show_flags;
create policy "admin read" on show_flags for select
  using (is_admin_user() and exists (select 1 from profiles p where p.id = show_flags.user_id and p.organization_id = admin_organization_id()));

drop policy if exists "admin read" on work_entries;
create policy "admin read" on work_entries for select
  using (is_admin_user() and exists (select 1 from profiles p where p.id = work_entries.user_id and p.organization_id = admin_organization_id()));

-- ========== classes, certifications, completed_classes: same user_id -> org pattern ==========
drop policy if exists "admin write" on classes;
create policy "admin write" on classes for all
  using (is_admin_user() and exists (select 1 from profiles p where p.id = classes.user_id and p.organization_id = admin_organization_id()))
  with check (is_admin_user() and exists (select 1 from profiles p where p.id = classes.user_id and p.organization_id = admin_organization_id()));

drop policy if exists "admin write" on certifications;
create policy "admin write" on certifications for all
  using (is_admin_user() and exists (select 1 from profiles p where p.id = certifications.user_id and p.organization_id = admin_organization_id()))
  with check (is_admin_user() and exists (select 1 from profiles p where p.id = certifications.user_id and p.organization_id = admin_organization_id()));

drop policy if exists "admin write" on completed_classes;
create policy "admin write" on completed_classes for all
  using (is_admin_user() and exists (select 1 from profiles p where p.id = completed_classes.user_id and p.organization_id = admin_organization_id()))
  with check (is_admin_user() and exists (select 1 from profiles p where p.id = completed_classes.user_id and p.organization_id = admin_organization_id()));

-- notifications: admin can only create notifications for apprentices in their own org
drop policy if exists "admin insert" on notifications;
create policy "admin insert" on notifications for insert
  with check (is_admin_user() and exists (select 1 from profiles p where p.id = notifications.user_id and p.organization_id = admin_organization_id()));

-- ========== shows, jatc_contacts: direct organization_id column ==========
-- read stays "everyone can see everything" (shows/contacts are still
-- readable union-wide by any authenticated apprentice today — only the
-- ADMIN WRITE side needs scoping, so a Local 831 admin can't edit Local
-- 510's schedule). Read-side org-scoping (so an apprentice only sees their
-- own union's shows) is a separate, larger change to every apprentice-facing
-- query and is deliberately NOT part of this pass.
drop policy if exists "admin write" on shows;
drop policy if exists "admin update" on shows;
drop policy if exists "admin delete" on shows;
create policy "admin write" on shows for insert to authenticated
  with check (is_admin_user() and organization_id = admin_organization_id());
create policy "admin update" on shows for update to authenticated
  using (is_admin_user() and organization_id = admin_organization_id())
  with check (is_admin_user() and organization_id = admin_organization_id());
create policy "admin delete" on shows for delete to authenticated
  using (is_admin_user() and organization_id = admin_organization_id());

drop policy if exists "admin write" on jatc_contacts;
drop policy if exists "admin update" on jatc_contacts;
drop policy if exists "admin delete" on jatc_contacts;
create policy "admin write" on jatc_contacts for insert to authenticated
  with check (is_admin_user() and organization_id = admin_organization_id());
create policy "admin update" on jatc_contacts for update to authenticated
  using (is_admin_user() and organization_id = admin_organization_id())
  with check (is_admin_user() and organization_id = admin_organization_id());
create policy "admin delete" on jatc_contacts for delete to authenticated
  using (is_admin_user() and organization_id = admin_organization_id());

-- dc36_contacts is scoped to the DISTRICT COUNCIL row, not a union row —
-- admin_organization_id() returns the admin's own union id, which will
-- never equal dc36_contacts.organization_id (the DC36 row's id). Any union
-- admin editing DC36 contacts today would need a district-level check that
-- doesn't exist yet — leaving dc36_contacts writable by any admin
-- (unscoped, unchanged) rather than accidentally locking everyone out.
-- Flagged, not fixed, in this pass.

-- companies is deliberately NOT touched — marketplace/labor-provider data
-- stays platform-wide per the Stage 1 two-dimension tenant model, not
-- union-scoped. Any admin can still manage the shared company directory.
