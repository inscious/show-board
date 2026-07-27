-- ============================================================================
-- Portfolio customization — section grouping, contact info on the shared
-- page. Cover photo needs no new column: it reuses portfolio_project_photos'
-- existing sort_order (already the field the shared route sorts photos by),
-- "set as cover" just reassigns that photo to the lowest sort_order.
-- ============================================================================

-- Free-text grouping label the apprentice sets per project — "2026",
-- "Freeman Expositions", "Install work", whatever they want. Not a fixed
-- taxonomy on purpose: projects share a section by matching text, and a
-- project with no section renders ungrouped on the shared page.
alter table portfolio_projects add column section text;

-- Contact info shown on the shared page, deliberately separate from the
-- apprentice's real login email/profile — this is an opt-in field they
-- type themselves for hiring managers to reach out through, never the
-- account email pulled automatically.
alter table portfolio_settings add column contact_email text;
alter table portfolio_settings add column contact_phone text;
