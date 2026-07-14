/* Service-role client — bypasses RLS entirely. Only for privileged Admin API
   calls that RLS genuinely can't do (creating an auth.users row, resetting
   someone else's password): both require the platform's Admin API, not a
   user-scoped session, no matter how permissive the RLS policy is.

   NEVER import this from anything under components/ — server-only, and even
   server-side it should only be reached from routes that already ran
   guardedRoute's requireAdmin check before touching it. */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  // supabase-js always spins up a realtime (WebSocket) client; outside
  // Next's own server bundle that needs a polyfill on this Node version —
  // same fix as scripts/seed.mjs. Unused here (no realtime calls), just
  // satisfies the constructor.
  if (!globalThis.WebSocket) {
    globalThis.WebSocket = class {};
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
