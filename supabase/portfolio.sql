-- ============================================================================
-- Apprentice Portfolio — booth photos become a real career asset.
-- Entirely new, additive tables — no existing table or RLS policy touched,
-- no interaction with the multi-tenant Stage 1/2 work. See the approved
-- plan (2026-07-21) for the full design rationale.
-- ============================================================================

create table portfolio_projects (
  id                    text primary key,
  user_id               uuid not null references auth.users on delete cascade,
  title                 text not null,
  notes                 text,
  sort_order            integer not null default 0,
  include_in_portfolio  boolean not null default true,
  share_token           uuid,
  created_at            timestamptz not null default now()
);
create index on portfolio_projects (user_id);
create unique index on portfolio_projects (share_token) where share_token is not null;

create table portfolio_project_days (
  id            bigint generated always as identity primary key,
  project_id    text not null references portfolio_projects on delete cascade,
  work_entry_id text not null references work_entries on delete cascade,
  work_type     text not null check (work_type in ('install','dismantle')),
  unique (project_id, work_entry_id)
);

create table portfolio_project_photos (
  id           text primary key,
  project_id   text not null references portfolio_projects on delete cascade,
  storage_path text not null,
  caption      text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table portfolio_settings (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text,
  bio          text,
  share_token  uuid,
  updated_at   timestamptz not null default now()
);

alter table portfolio_projects       enable row level security;
alter table portfolio_project_days   enable row level security;
alter table portfolio_project_photos enable row level security;
alter table portfolio_settings       enable row level security;

create policy "own rows" on portfolio_projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own rows" on portfolio_project_days for all
  using (exists (select 1 from portfolio_projects p where p.id = portfolio_project_days.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from portfolio_projects p where p.id = portfolio_project_days.project_id and p.user_id = auth.uid()));

create policy "own rows" on portfolio_project_photos for all
  using (exists (select 1 from portfolio_projects p where p.id = portfolio_project_photos.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from portfolio_projects p where p.id = portfolio_project_photos.project_id and p.user_id = auth.uid()));

create policy "own rows" on portfolio_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: private bucket, apprentice writes/reads only their own folder.
-- Not public like avatars — nobody gets a working URL without going through
-- reviewed code that generates a signed one (the apprentice's own session
-- for their own view, the service-role-backed public share route for
-- outsiders).
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', false) on conflict (id) do nothing;
create policy "own portfolio photos" on storage.objects for all
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
