-- ============================================================================
-- Show Board — multi-user schema.
-- NOT USED YET. This is for the day your brother signs in.
-- Paste into the Supabase SQL editor when you're ready.
--
-- The idea: the schedule and the company directory are SHARED (same Local 831
-- sheet for everyone). Hours, OJT, bookings, classes and pay rates are YOURS.
-- Row Level Security means nobody can read anybody else's rows — that's
-- Postgres saying no, not the app remembering to.
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

create table shows (
  id          bigint generated always as identity primary key,
  name        text not null,
  move_in     date,
  starts_on   date,
  ends_on     date,
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
  id          uuid primary key references auth.users on delete cascade,
  name        text,
  member_id   text,
  ssn_last4   text,
  local       text default 'IUPAT 831',
  joined_on   date,
  rsi_credits numeric default 0
);

-- what each shop pays YOU. store a LEVEL, not a dollar amount, so an override
-- rides the scale up as you advance. anything not listed pays your actual level.
create table company_rates (
  user_id   uuid references auth.users on delete cascade,
  company   text not null,
  pay_level text not null check (pay_level in ('L1','L2','L3','L4','L5','L6','EJ','CJ')),
  primary key (user_id, company)
);

create table show_flags (
  user_id uuid   references auth.users on delete cascade,
  show_id bigint references shows      on delete cascade,
  status  text check (status in ('working','target','passed')),
  note    text,
  primary key (user_id, show_id)
);

-- days you've been asked to work, before any hours exist.
-- one show can have several rows: Eagle for four days, Freeman for two.
create table bookings (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  company text not null,          -- who called YOU, not the general on the floor
  show    text,
  note    text,
  dates   date[] not null
);

-- union classes: mandatory, unpaid, scheduled per apprentice
create table classes (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users on delete cascade,
  name     text not null,
  start_at time,
  location text,
  note     text,
  dates    date[] not null
);

-- one row per company per day. two shops in a day = two rows.
-- hours split between categories, they never stack.
create table work_entries (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  worked_on  date not null,
  company    text not null,
  started_at time,                       -- null = untimed, assume an 8:00 start
  ended_at   time,                       -- < started_at means the call ran overnight
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
  show_id    bigint references shows on delete set null,
  created_at timestamptz default now()
);
create index on work_entries (user_id, worked_on);

-- what you actually turned in. NEVER derived from work_entries — you want to see the gap.
create table ojt_months (
  user_id      uuid references auth.users on delete cascade,
  month        text not null,          -- '2026-06'
  cat_a        numeric default 0,
  cat_b        numeric default 0,
  cat_c        numeric default 0,
  cat_d        numeric default 0,
  submitted_on date,
  primary key (user_id, month)
);

create table pinned_companies (
  user_id    uuid   references auth.users on delete cascade,
  company_id bigint references companies on delete cascade,
  primary key (user_id, company_id)
);

-- ============================================================================
-- Authorization. Ten lines, and your hours are physically unreadable by anyone else.
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
create policy "own rows" on classes          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on show_flags       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on company_rates    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on pinned_companies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile" on profiles      for all using (id = auth.uid())      with check (id = auth.uid());

-- the schedule and the directory: everyone signed in reads; anyone can import a sheet.
-- the unique constraint on shows means a double-import is a no-op, so this is safe.
alter table shows     enable row level security;
alter table companies enable row level security;
create policy "read"   on shows     for select to authenticated using (true);
create policy "import" on shows     for insert to authenticated with check (true);
create policy "read"   on companies for select to authenticated using (true);
