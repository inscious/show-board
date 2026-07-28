/* Tiny in-memory, stale-while-revalidate cache for client components that
   read Supabase/API data directly (admin & console panels) rather than
   through the local-first store.js blob. This is NOT persistence — nothing
   here survives a real page reload, so it doesn't touch the "store.js is
   the only file that touches persistence" rule. It exists because these
   panels live inside conditionally-rendered tabs or their own route page,
   both of which fully unmount on every navigation away and remount fresh
   on the way back — without a cache, that remount reran every fetch (and
   re-flashed every loading skeleton) even though nothing had changed.

   Usage: seed useState's initial value from getCached(key) so a remount
   paints instantly from whatever was last loaded, then still call the
   panel's normal load function every mount (unchanged) and have it call
   setCached(key, data) alongside its own setState — that keeps the cache
   (and the next remount's instant paint) fresh in the background. */
const cache = new Map();

export function getCached(key) {
  return cache.has(key) ? cache.get(key) : null;
}

export function setCached(key, value) {
  cache.set(key, value);
}
