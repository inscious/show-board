-- ============================================================================
-- Show Board — multi-user schema.
-- Paste into the Supabase SQL editor once, on a fresh project.
--
-- The idea: the schedule and the company directory are SHARED (same Local 831
-- sheet for everyone). Hours, OJT, bookings, classes and pay rates are YOURS.
-- Row Level Security means nobody can read anybody else's rows — that's
-- Postgres saying no, not the app remembering to.
--
-- Only the admin (you) can write to the shared schedule. Everyone else reads
-- it and can flag their own status/note against a show via show_flags.
-- ============================================================================

-- ========== shared: one copy for the whole local ==========
create table companies (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  city       text,
  state      text,
  labor_line text,
  foreman    text
);

-- JATC office staff — same "shared, everyone reads, only admin writes" shape
-- as companies. Kept out of lib/core.js on purpose: real names and a
-- personal cell number have no business being in a public git repo.
create table jatc_contacts (
  id    text primary key,
  name  text not null,
  tel   text,
  ext   text,
  email text,
  sms   text
);

-- ids are assigned client-side (e.g. "u"+timestamp / "i"+timestamp+idx) so the
-- app can create a row optimistically with no bars and no round trip.
-- move_in/starts_on/ends_on are "M/D" strings straight off the union sheet,
-- same as the app's local shape — the whole app is a single fixed YEAR
-- (lib/core.js), so these were never real dates to begin with.
create table shows (
  id          text primary key,
  name        text not null,
  move_in     text,
  starts_on   text,
  ends_on     text,
  location    text,
  booth       text,
  gc          text,           -- the general contractor, as printed on the sheet
  region      text,
  source      text default 'union',
  sheet_month text,           -- '2026-07' — which PDF it came from
  created_by  uuid references auth.users,
  unique (name, starts_on, location)   -- overlapping monthly sheets dedupe for free
);

-- ========== per-user ==========
create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  email             text not null,
  is_admin          boolean not null default false,
  has_password      boolean not null default false, -- flips true once they set one; drives the "set a password" nudge
  name              text,
  member_id         text,
  ssn_last4         text,
  local             text default 'IUPAT 831',
  joined_on         date,
  rsi_credits       numeric default 0,
  city              text,  -- home city — admin-only info, not shown to the apprentice themselves
  custom_companies  text[] not null default '{}',  -- ad-hoc company names typed in, not in `companies`
  archived_at       timestamptz,  -- set = off the active roster, kept for record; null = active. Permanent delete requires this set first.
  do_not_hire_at    timestamptz,  -- set = on the union's do-not-hire list (late OJT, missed mandatory class, etc); null = clear
  do_not_hire_reason text,
  avatar_url        text,  -- ID photo, admin-uploaded to the public `avatars` storage bucket below
  -- set = a real, admin-vetted account; null = exists but not yet allowed
  -- past the pending-review holding page. Admin-created accounts (the
  -- existing "Add apprentice" flow) get this stamped at creation time,
  -- since admin already vetted them by creating the account directly.
  -- Self-signup (when SELF_SIGNUP_ENABLED) is the only path that leaves
  -- it null on arrival. Same nullable-timestamp shape as archived_at /
  -- do_not_hire_at above, not a boolean, so "when" is on file for free.
  approved_at       timestamptz
);

-- one row per (user, show): "my status/note on this show" — never touches the
-- shared shows table, so a non-admin can flag a show without write access to it.
create table show_flags (
  user_id uuid references auth.users on delete cascade,
  show_id text references shows      on delete cascade,
  status  text check (status in ('working','target','passed')),
  note    text,
  primary key (user_id, show_id)
);

-- what each shop pays YOU. store a LEVEL, not a dollar amount, so an override
-- rides the scale up as you advance. anything not listed pays your actual level.
-- this is exactly why the two of you can have different rates for the same shop.
create table company_rates (
  user_id   uuid references auth.users on delete cascade,
  company   text not null,
  pay_level text not null check (pay_level in ('L1','L2','L3','L4','L5','L6','EJ','CJ')),
  primary key (user_id, company)
);

-- days you've been asked to work, before any hours exist.
-- one show can have several rows: Eagle for four days, Freeman for two.
create table bookings (
  id        text primary key,
  user_id   uuid not null references auth.users on delete cascade,
  company   text not null,          -- who called YOU, not the general on the floor
  show      text,
  note      text,                   -- applies to every date in `dates`
  dates     date[] not null,
  day_notes jsonb not null default '{}'::jsonb  -- { "YYYY-MM-DD": "start time, gate, booth..." }, overrides `note` for one date
);

-- union classes: mandatory, unpaid, scheduled per apprentice. Admin-assigned
-- only — apprentices can view but not add/edit/delete (see RLS below).
create table classes (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  start_min    int,               -- minutes from midnight, matches TIME_SLOTS granularity
  location     text,
  note         text,
  dates        date[] not null,
  missed_dates date[] not null default '{}'  -- subset of `dates` the admin marked absent; revert by removing
);

-- one row per company per day. two shops in a day = two rows.
-- hours split between categories, they never stack.
create table work_entries (
  id         text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  worked_on  date not null,
  company    text not null,
  in_min     int,                       -- minutes from midnight; null = untimed (hrs mode)
  out_min    int,                       -- may exceed 1440 — an overnight call rolls into the next day
  break_min  int default 0,
  hours      numeric(5,2) not null check (hours >= 0),  -- CLOCK hours — what the union gets
  st_hours   numeric(5,2) default 0,     -- straight
  ot_hours   numeric(5,2) default 0,     -- x1.5
  dt_hours   numeric(5,2) default 0,     -- x2
  pay_rate   numeric(6,2),               -- SNAPSHOT: the rate in force for this shop on this day.
                                         -- never join to company_rates at read time — the day you
                                         -- level up, every shift you ever worked would re-price itself.
  category   char(1) check (category in ('A','B','C','D')),
  note       text,
  show_id    text references shows on delete set null,
  created_at timestamptz default now()
);
create index on work_entries (user_id, worked_on);

-- what you actually turned in. NEVER derived from work_entries — you want to see the gap.
-- status: an apprentice submitting a month lands here as 'pending' until an
-- admin reviews it; only 'approved' rows count toward the running OJT total.
-- Historical backfill (scripts/seed.mjs) writes 'approved' directly — there's
-- no admin to review hours that were already really submitted to the union
-- before this app existed.
create table ojt_months (
  user_id      uuid references auth.users on delete cascade,
  month        text not null,          -- '2026-06'
  cat_a        numeric default 0,
  cat_b        numeric default 0,
  cat_c        numeric default 0,
  cat_d        numeric default 0,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_on date default now(),
  primary key (user_id, month)
);

-- company names pinned to the top of the directory picker — by name, not id,
-- since the app lets you pin ad-hoc companies that aren't in `companies` too.
create table pinned_companies (
  user_id      uuid references auth.users on delete cascade,
  company_name text not null,
  primary key (user_id, company_name)
);

-- admin-entered, per-apprentice — CPR/OSHA-10/lift certs and their expiry.
-- Admin writes (the training center is the record-of-truth here, same
-- reasoning as ojt_months); apprentice only reads their own.
create table certifications (
  id      text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name    text not null,
  exp     date not null
);

-- one row per recipient per event (not a broadcast + read-join) — simplest
-- correct thing for a handful of apprentices. Clearing = deleting your own row.
create table notifications (
  id         text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  type       text not null, -- 'class' | 'schedule'
  message    text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Rate limiting. One table, one function, used by every mutating API route.
-- Fixed-window counter — correct across Vercel's stateless serverless
-- functions, which in-memory counters would not be.
-- ============================================================================
create table rate_limits (
  key          text primary key,     -- e.g. 'auth:request-link:jane@example.com'
  window_start timestamptz not null,
  count        int not null default 0
);

-- No policies on purpose: the only legitimate access is check_rate_limit()
-- below, a security definer function that runs as its owner and so bypasses
-- RLS regardless. Enabling RLS with zero policies makes every other role
-- (including a signed-in apprentice hitting the REST API directly) get a
-- flat deny — otherwise anyone could read or delete rate-limit counters
-- (their own or anyone else's) and bypass throttling entirely.
alter table rate_limits enable row level security;

create or replace function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_row rate_limits;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rate_limits.window_start
        end
  returning * into v_row;

  return v_row.count <= p_max;
end;
$$;

-- ============================================================================
-- New-user provisioning. Creates the matching profile row the moment someone
-- signs in for the first time. Everyone starts as a non-admin apprentice;
-- promote an account by hand afterward with:
--   update public.profiles set is_admin = true where email = '...';
--
-- name comes from auth.users' own metadata when present — self-signup
-- (app/api/auth/sign-up) passes { data: { name } } to supabase.auth.signUp(),
-- which lands in raw_user_meta_data. That's deliberate: with email
-- confirmation required, signUp() returns no active session until the user
-- confirms, so there's no RLS-scoped moment to update profiles.name from the
-- route itself — the security-definer trigger is the only place that can
-- set it at row-creation time regardless of confirmation state. Admin-created
-- accounts pass no metadata, so this is null for them (unchanged from
-- before — that route already sets name itself right after, via the
-- service-role client it's already gated to use).
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin, name)
  values (new.id, new.email, false, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Authorization. Physically unreadable/unwritable by anyone else — Postgres
-- enforces this, not app code.
-- ============================================================================
alter table profiles         enable row level security;
alter table company_rates    enable row level security;
alter table show_flags       enable row level security;
alter table bookings         enable row level security;
alter table classes          enable row level security;
alter table work_entries     enable row level security;
alter table ojt_months       enable row level security;
alter table pinned_companies enable row level security;

create policy "own rows" on work_entries     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on ojt_months       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on bookings         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows read-only" on classes for select using (user_id = auth.uid());
create policy "own rows" on show_flags       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on company_rates    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on pinned_companies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile" on profiles      for all using (id = auth.uid())      with check (id = auth.uid());

-- the schedule and the directory: everyone signed in reads; only the admin writes.
alter table shows     enable row level security;
alter table companies enable row level security;

create policy "read" on shows     for select to authenticated using (true);
create policy "read" on companies for select to authenticated using (true);

create policy "admin write" on shows for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin update" on shows for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin delete" on shows for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "admin write" on companies for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin update" on companies for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin delete" on companies for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

alter table jatc_contacts enable row level security;
create policy "read" on jatc_contacts for select to authenticated using (true);
create policy "admin write" on jatc_contacts for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin update" on jatc_contacts for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "admin delete" on jatc_contacts for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- ============================================================================
-- Admin roster access. A policy on `profiles` can't subquery `profiles`
-- itself (Postgres reports infinite recursion) — this SECURITY DEFINER
-- function reads is_admin bypassing RLS, so policies can call it instead.
-- ============================================================================
create or replace function is_admin_user()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- append-only trail for the handful of admin actions that are destructive or
-- privilege-related (archive, permanent delete, do-not-hire, new admin
-- accounts). actor/target are stored as plain email text, not foreign keys —
-- the account on either side can later be deleted (see work_entries.pay_rate
-- for the same "snapshot, don't join" reasoning), and the log should still
-- read fine after that happens.
create table admin_audit_log (
  id           bigint generated always as identity primary key,
  actor_email  text,
  target_email text,
  action       text not null,  -- 'archive' | 'restore' | 'delete' | 'dnh_add' | 'dnh_remove' | 'admin_create' | 'admin_revoke'
  message      text not null,
  created_at   timestamptz not null default now()
);
alter table admin_audit_log enable row level security;
create policy "admin read" on admin_audit_log for select to authenticated using (is_admin_user());
create policy "admin insert" on admin_audit_log for insert to authenticated with check (is_admin_user());
-- no update/delete policy at all — the log is append-only by design.

-- ============================================================================
-- Column-level guards. RLS's `with check` only sees whether id/user_id
-- matches the caller — it can't say "this column, but not that one" — so
-- "own profile" / "own rows" above are wide enough that an apprentice could
-- otherwise UPDATE their own is_admin, archived_at, do_not_hire_at, or
-- ojt_months.status directly (bypassing the app entirely, e.g. from the
-- browser console) and grant themselves admin, un-archive themselves, clear
-- their own do-not-hire status, or self-approve hours.
-- These triggers close that: any writer who isn't
-- already admin gets the privileged column silently reset to what it was
-- (or forced to 'pending'), same as the app-layer logic already does.
-- auth.uid() is null for service-role calls (scripts/seed.mjs's trusted
-- historical backfill, already-approved by definition) — those pass through.
-- ============================================================================
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
  end if;
  return new;
end;
$$;

create trigger protect_profiles_is_admin
before update on profiles
for each row execute function protect_profile_privilege_columns();

create or replace function protect_ojt_months_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin_user() then
    if TG_OP = 'INSERT' then
      new.status := 'pending';
    elsif (new.cat_a, new.cat_b, new.cat_c, new.cat_d) is distinct from (old.cat_a, old.cat_b, old.cat_c, old.cat_d) then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_ojt_months_status
before insert or update on ojt_months
for each row execute function protect_ojt_months_status();

-- admin can see and correct every apprentice's profile + OJT-months-on-file.
create policy "admin read all" on profiles for select using (is_admin_user());
create policy "admin update all" on profiles for update using (is_admin_user()) with check (is_admin_user());
create policy "admin all" on ojt_months for all using (is_admin_user()) with check (is_admin_user());

-- admin can VIEW (not edit) an apprentice's bookings, working/target flags
-- on shows, and day-to-day logged hours — for the admin dashboard's "on the
-- schedule" section and the per-apprentice Calendar tab. Read-only on
-- purpose: work_entries stays apprentice-edited only, same "never
-- auto-reconcile" reasoning as the submitted-vs-logged split elsewhere in
-- this schema — admin can look, not touch.
create policy "admin read" on bookings for select using (is_admin_user());
create policy "admin read" on show_flags for select using (is_admin_user());
create policy "admin read" on work_entries for select using (is_admin_user());

-- admin can assign/edit/remove classes on any apprentice's schedule.
create policy "admin write" on classes for all using (is_admin_user()) with check (is_admin_user());

-- certifications: apprentice reads their own, admin manages any.
alter table certifications enable row level security;
create policy "own rows" on certifications for select using (user_id = auth.uid());
create policy "admin write" on certifications for all using (is_admin_user()) with check (is_admin_user());

-- notifications: apprentice reads/deletes (clears) their own; admin creates
-- them for anyone (assigning a class, adding/importing a show).
alter table notifications enable row level security;
create policy "own rows" on notifications for select using (user_id = auth.uid());
create policy "own delete" on notifications for delete using (user_id = auth.uid());
create policy "admin insert" on notifications for insert with check (is_admin_user());

-- ============================================================================
-- Storage: apprentice ID photos. Public bucket (simple `getPublicUrl`, no
-- signed-URL refresh logic) — the object path is the apprentice's own uuid,
-- so a photo is only reachable if you already know their id. Admin-only
-- writes; the upload route (app/api/admin/avatar) uses the service-role
-- client anyway, so these policies mostly guard the Supabase dashboard.
-- ============================================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "admin write avatars" on storage.objects for all
  using (bucket_id = 'avatars' and is_admin_user())
  with check (bucket_id = 'avatars' and is_admin_user());
create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
