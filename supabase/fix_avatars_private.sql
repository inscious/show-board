-- The `avatars` bucket was created public (schema.sql:577) — every profile
-- photo sat at a guessable, unauthenticated URL (`{user_id}.{ext}`). Portfolio
-- and time-ticket photos were already private from the start; avatars alone
-- were missed. app/api/profile/avatar and app/api/admin/avatar now issue
-- long-lived (1 year) signed URLs instead of public ones, and the one
-- existing production avatar_url has already been backfilled to a signed
-- URL — this migration is safe to run immediately, nothing will break.
update storage.buckets set public = false where id = 'avatars';
