-- ============================================================================
-- Time ticket photos — a photo of the physical paper time ticket for one
-- logged work_entries row. Record-keeping / proof-of-work, private to the
-- apprentice — deliberately separate from portfolio_project_photos (that's
-- a shareable career asset; this is an internal accuracy/audit record and
-- is never exposed through the public portfolio share route).
--
-- Per-entry, not per-day: a two-company day (see the real Eagle/Freeman
-- example from the Portfolio feature) has two separate paper tickets.
-- ============================================================================

create table time_ticket_photos (
  id            text primary key,
  work_entry_id text not null references work_entries on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);
create index on time_ticket_photos (work_entry_id);

alter table time_ticket_photos enable row level security;

create policy "own rows" on time_ticket_photos for all
  using (exists (select 1 from work_entries w where w.id = time_ticket_photos.work_entry_id and w.user_id = auth.uid()))
  with check (exists (select 1 from work_entries w where w.id = time_ticket_photos.work_entry_id and w.user_id = auth.uid()));

-- Storage: private bucket, own-folder RLS — same shape as the `portfolio`
-- bucket, but a separate bucket since these photos serve a different
-- purpose and should never accidentally end up reachable through any
-- portfolio-sharing code path.
insert into storage.buckets (id, name, public) values ('time_tickets', 'time_tickets', false) on conflict (id) do nothing;
create policy "own time ticket photos" on storage.objects for all
  using (bucket_id = 'time_tickets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'time_tickets' and (storage.foldername(name))[1] = auth.uid()::text);
