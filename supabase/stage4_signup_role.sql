-- ============================================================================
-- Self-signup role picker — apprentice vs. Certified Journeyman. This is
-- deliberately NOT a way to self-grant CJ status: profiles.graduated_at
-- stays exactly as privilege-guarded as ever (protect_profile_privilege_
-- columns() already reverts any non-admin write to it). claimed_cj is a
-- plain, non-privileged column that only records what the person said
-- about themselves at signup — an admin sees it on the Pending Signups
-- panel and decides whether to actually grant graduated_at while approving.
--
-- STAGING FIRST. Apply to production only after staging verification.
-- ============================================================================

alter table profiles add column claimed_cj boolean not null default false;

-- handle_new_user() is a security-definer trigger on auth.users insert, not
-- a user-initiated profiles write — the protect_profile_privilege_columns()
-- UPDATE guard doesn't apply here (and shouldn't: this column isn't
-- privilege-bearing, it's just a self-reported hint), so reading it
-- straight from signup metadata is safe. Same coalesce/cast pattern as the
-- existing platform_admin check right above it.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'platform_admin', 'false') = 'true' then
    return new;
  end if;
  insert into public.profiles (id, email, is_admin, name, organization_id, claimed_cj)
  values (
    new.id, new.email, false, new.raw_user_meta_data->>'name',
    (select id from organizations where type = 'union' order by id limit 1),
    coalesce(new.raw_user_meta_data->>'claimed_cj', 'false') = 'true'
  );
  return new;
end;
$$;
