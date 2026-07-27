-- ============================================================================
-- Lets an apprentice upload their own profile picture, gated by an
-- admin-controlled on/off switch — same app_settings singleton-row shape as
-- self_signup_enabled / ojt_auto_approve. Default true: admin can turn it
-- off if it becomes a problem, but the feature starts usable.
-- ============================================================================

alter table app_settings add column apprentice_avatar_upload_enabled boolean not null default true;
