/* Thin wrapper around the check_rate_limit() Postgres function (see
   supabase/schema.sql). A fixed-window counter stored in Postgres, not memory
   — correct across Vercel's stateless serverless functions. Fails CLOSED: if
   the check itself errors, treat it as rate-limited rather than open. */
export async function checkRateLimit(supabase, key, max, windowSeconds) {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return false;
  return data === true;
}

/* Best-effort client identity for rate-limit keys on unauthenticated routes
   (there's no user id yet before sign-in). Not spoof-proof — a determined
   attacker can rotate IPs — but it's the identity Vercel gives us, and it's
   paired with the email in the key so it doesn't gate on IP alone. */
export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
