-- ============================================================================
-- Foreman labor-call UI support — the three schema gaps that surfaced once
-- real UI was designed on top of stage2_foreman.sql / stage2_labor_calls.sql
-- (see platform_architecture_scoping memory for the full history).
--
-- STAGING FIRST. Apply to production only after staging verification.
-- ============================================================================

-- Optional, self-service — an apprentice/CJ opts in so a foreman can
-- actually text/call to close the loop (the real-world workflow this whole
-- feature models). Not privilege-bearing, so no protect_profile_privilege_
-- columns() guard needed — covered by the existing "own profile update"
-- policy the same way avatar_url/city already are. Only ever surfaced to a
-- foreman for people who responded to THEIR OWN open call (see
-- app/api/labor-calls/[id]/responses/route.js), never a general directory.
alter table profiles add column phone text;

-- A foreman marks a specific responder 'confirmed' after actually reaching
-- them by phone/text — distinct from 'available' (the worker's own
-- self-reported, non-committal hand-raise) and 'withdrawn' (the worker
-- taking it back). Not something a worker sets on themselves.
alter table labor_call_responses drop constraint labor_call_responses_status_check;
alter table labor_call_responses add constraint labor_call_responses_status_check
  check (status in ('available', 'withdrawn', 'confirmed'));

-- The foreman who posted a call can set a response on it to 'confirmed' —
-- deliberately narrow: the WITH CHECK restricts this policy to only ever
-- *set* 'confirmed', so it can't be used to overwrite a worker's own
-- available/withdrawn choice to anything else. The existing "own responses"
-- policy remains the only way a worker sets available/withdrawn on their
-- own row.
create policy "foreman can confirm responses to own calls" on labor_call_responses for update to authenticated
  using (exists (select 1 from labor_calls lc where lc.id = labor_call_responses.labor_call_id and lc.posted_by = auth.uid()))
  with check (status = 'confirmed');
