-- ============================================================================
-- Labor calls — the actual workflow behind "are you available to work,"
-- per the platform_architecture_scoping memory. A foreman (an apprentice/CJ
-- with foreman_of_company_id set) posts a call; approved union members
-- mark themselves available; the foreman closes the loop directly, same
-- as texting today.
--
-- STAGING ONLY. Not yet applied to production.
--
-- OPEN QUESTION, DELIBERATELY UNRESOLVED (see memory): who exactly a call
-- should reach — the foreman's own union? everyone who's worked for that
-- company before? This MVP picks the most permissive option (any approved
-- union member, any union, can see an open call) since the marketplace
-- side is explicitly not union-scoped — narrower targeting is a real
-- decision for later, not something to guess at here.
--
-- `category` is a label the foreman puts on the call describing the kind
-- of work — per the ojt_category_self_reporting memory, this must NEVER
-- be used to filter/match against an apprentice's own OJT category
-- history, since that history isn't a reliable skill signal.
-- ============================================================================

create table labor_calls (
  id           bigint generated always as identity primary key,
  posted_by    uuid not null references auth.users on delete cascade,
  company_id   bigint not null references companies(id),
  show_id      text references shows on delete set null,
  title        text,
  needed_count int not null check (needed_count > 0),
  category     char(1) check (category in ('A','B','C','D')),
  starts_at    timestamptz not null,
  status       text not null default 'open' check (status in ('open','filled','cancelled')),
  created_at   timestamptz not null default now()
);

create table labor_call_responses (
  id            bigint generated always as identity primary key,
  labor_call_id bigint not null references labor_calls on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  status        text not null default 'available' check (status in ('available','withdrawn')),
  responded_at  timestamptz not null default now(),
  unique (labor_call_id, user_id)
);

alter table labor_calls enable row level security;
alter table labor_call_responses enable row level security;

-- read: any authenticated (approved) union member can see an open call, or
-- their own posted calls regardless of status.
create policy "read open calls" on labor_calls for select to authenticated
  using (status = 'open' or posted_by = auth.uid());

-- only someone with foreman_of_company_id set to this exact company can
-- post a call for it — can't post as a company you're not actually a
-- foreman for.
create policy "foreman can post" on labor_calls for insert to authenticated
  with check (
    posted_by = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and foreman_of_company_id = company_id)
  );

create policy "foreman can update own calls" on labor_calls for update to authenticated
  using (posted_by = auth.uid())
  with check (posted_by = auth.uid());

-- responses: a worker manages their own response row.
create policy "own responses" on labor_call_responses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- the foreman who posted a call can see who responded to it.
create policy "foreman reads responses to own calls" on labor_call_responses for select to authenticated
  using (exists (select 1 from labor_calls lc where lc.id = labor_call_responses.labor_call_id and lc.posted_by = auth.uid()));
