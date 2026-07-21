-- ============================================================================
-- Foreman capability — a grant onto an EXISTING apprentice/CJ profiles row,
-- not a separate account (see platform_architecture_scoping memory for the
-- full reasoning: most real hiring foremen are also union members). Distinct
-- from companies.foreman, which is just a free-text "who to call" directory
-- field, not a real login link.
--
-- STAGING ONLY. Not yet applied to production.
-- ============================================================================

alter table profiles add column foreman_of_company_id bigint references companies(id);

-- guarded the same way as every other privilege-bearing column — the "own
-- profile" RLS policy is otherwise wide open, so without this an apprentice
-- could self-grant foreman status for any company via a raw REST call.
--
-- NOTE, caught live 2026-07-21: an earlier pass at this function (the
-- central-admin migration) accidentally dropped the organization_id and
-- graduated_at guards from Stage 1 when it did `create or replace function`
-- without including them — create or replace silently discards whatever the
-- new body doesn't repeat, it doesn't merge. This version restores both
-- alongside the new foreman_of_company_id guard. Whenever this whole trigger
-- gets consolidated for a production handoff, this is the version to use —
-- not any earlier draft.
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
    new.approved_at := old.approved_at;
    new.organization_id := old.organization_id;
    new.graduated_at := old.graduated_at;
    new.foreman_of_company_id := old.foreman_of_company_id;
  end if;
  if auth.uid() is not null and not (select is_central_admin from profiles where id = auth.uid()) then
    new.is_central_admin := old.is_central_admin;
  end if;
  return new;
end;
$$;
