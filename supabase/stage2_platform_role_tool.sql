-- ============================================================================
-- Platform Admin role-assignment tool — named explicitly by the user
-- (2026-07-20 night, see platform_architecture_scoping memory): as Platform
-- Admin, he needs to directly set any account's role/capability across any
-- union, for his own testing and troubleshooting. This bypasses each
-- union's own admin-creation flow and crosses tenant boundaries, so it gets
-- its own audit log rather than sharing admin_audit_log (which is
-- union-admin-readable and has no organization_id to scope a cross-tenant
-- action against).
--
-- STAGING ONLY. Not yet applied to production.
-- ============================================================================

create table platform_audit_log (
  id           bigint generated always as identity primary key,
  actor_email  text not null,
  target_email text,
  action       text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);
alter table platform_audit_log enable row level security;
create policy "platform admin read" on platform_audit_log for select to authenticated using (is_platform_admin());
create policy "platform admin insert" on platform_audit_log for insert to authenticated with check (is_platform_admin());
