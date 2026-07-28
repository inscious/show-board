-- ============================================================================
-- Union dates & dues — the handful of holiday/meeting/dues-deadline lines
-- printed on the same monthly union sheet as the show schedule, previously
-- hardcoded as JULY_NOTES in lib/core.ts (meaning updating them each month
-- required a code change and a deploy). Same shape/RLS as `shows`: shared,
-- everyone reads, only admin writes — deliberately NOT org-scoped, matching
-- what's actually live on production for `shows`/`companies` today
-- (stage2_org_scoping.sql's org-scoped admin-write policies are staging-only,
-- not yet applied to production, and there's no mechanism yet that
-- auto-populates organization_id on insert — scoping this table ahead of
-- that landing app-wide would just make it silently unwritable).
-- ============================================================================

create table union_notices (
  id          text primary key,
  sheet_month text,                     -- '2026-08' — which sheet this came off, same convention as shows.sheet_month
  date_label  text not null,            -- printed exactly as on the sheet: "WED AUG 19" or "AUG 31"
  notice_date date,                     -- actual calendar date, so the Calendar tab can dot the right day. Nullable: older/typed-only rows may not have one.
  body        text not null,            -- "Monthly meeting · 6:00 PM · 14930 Marquardt Ave, Santa Fe Springs"
  kind        text not null default 'notice' check (kind in ('holiday', 'meeting', 'dues', 'notice')),
  sort_order  bigint not null default 0,  -- client-assigned via Date.now(), same id-generation convention as elsewhere in this app — needs bigint, not a 32-bit int
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now()
);
create index on union_notices (sheet_month);

-- migration note: if union_notices already exists in a deployed environment, run:
--   alter table union_notices add column notice_date date;

alter table union_notices enable row level security;

create policy "read" on union_notices for select to authenticated using (true);

create policy "admin write" on union_notices for insert to authenticated
  with check (is_admin_user());
create policy "admin update" on union_notices for update to authenticated
  using (is_admin_user())
  with check (is_admin_user());
create policy "admin delete" on union_notices for delete to authenticated
  using (is_admin_user());
