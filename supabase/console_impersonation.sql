-- ============================================================================
-- Impersonation ("view as") — a platform admin gets a real, time-boxed
-- session as a target account, not a read-only shadow render. Matches how
-- this app already works (per-user data cached in localStorage via
-- lib/store.ts, which a shadow render could not faithfully reproduce
-- without forking most of the UI) and gives an accurate "see exactly what
-- they see" troubleshooting view.
--
-- This table is what makes the session enforceable (our own shorter expiry,
-- independent of Supabase's own magic-link/session expiry) and auditable —
-- both /console/audit and the in-app banner query it. platform_admins rows
-- are excluded as valid targets at the application layer (no impersonating
-- a fellow platform admin), not by a DB constraint, since target_user_id
-- just references auth.users like every other user-scoped table here.
-- ============================================================================

create table impersonation_sessions (
  id                  bigint generated always as identity primary key,
  platform_admin_id   uuid not null references auth.users on delete cascade,
  platform_admin_email text not null,
  target_user_id      uuid not null references auth.users on delete cascade,
  target_email        text not null,
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  ended_at            timestamptz
);
create index on impersonation_sessions (target_user_id, expires_at);

alter table impersonation_sessions enable row level security;
create policy "platform admin read" on impersonation_sessions for select to authenticated using (is_platform_admin());
-- no insert/update/delete policy for anyone — every write goes through the
-- service-role client inside the impersonate/impersonate-end routes, same
-- as platform_audit_log's own append-only-by-RLS-design shape. The banner
-- check (the target's own session, reading their own row) also needs read
-- access — added as a second, narrower policy rather than loosening the
-- platform-admin one:
create policy "target can read own active session" on impersonation_sessions for select to authenticated
  using (target_user_id = auth.uid());
