-- ============================================================================
-- Central vs. moderator admin tiers — the missing piece.
--
-- ce78830 ("Add central vs. moderator admin tiers") added is_central_admin
-- directly to schema.sql's from-scratch `create table profiles (...)` block,
-- with the actual `alter table` left to be "run by hand" per that commit's
-- own message — but the hand-written statement was never captured as a
-- checked-in file anywhere. stage2_foreman.sql's protect_profile_privilege_
-- columns() already references this column (see its trigger body), so it
-- must run AFTER this file, not before.
--
-- Run this before stage2_foreman.sql. Everything else in stage2_foreman.sql
-- (the foreman_of_company_id column, the consolidated trigger) is unchanged.
-- ============================================================================

alter table profiles add column is_central_admin boolean not null default false;
