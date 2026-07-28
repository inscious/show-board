-- ============================================================================
-- Tie a portfolio project back to the real show it happened at, so the
-- location comes from the actual show record instead of the apprentice
-- typing it (or folding it into the title, e.g. "UPPER DECK - COMIC CON
-- 2026"). Dates already come from real work_entries.worked_on rows via
-- portfolio_project_days, so this is only the piece that was missing.
--
-- show_id is a soft link on purpose (on delete set null, not restrict) —
-- shows are admin-managed and can be deleted; a project should keep its
-- own title/location text even if the show record disappears later.
-- location is its own text column, not derived live from shows.loc, so a
-- project stays correct even if the show's location field changes after
-- the fact, and so a project with no linked show can still have one typed
-- in by hand.
-- ============================================================================

alter table portfolio_projects add column show_id text references shows(id) on delete set null;
alter table portfolio_projects add column location text;
