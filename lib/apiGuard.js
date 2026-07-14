/* Shared wrapper for every mutating API route: session check, rate limit,
   payload-size cap, zod validation, optional admin check — all before the
   route's own handler ever touches the database. RLS still applies underneath
   every Supabase call the handler makes; this is the extra layer RLS can't
   provide on its own (rate limiting, "reject this before it's even parsed"). */
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 100_000; // 100KB — generous for this app's payloads, small enough to reject abuse

export async function guardedRoute(request, routeName, options, handler) {
  const { schema, requireAdmin = false, rateLimit = { max: 30, windowSeconds: 60 } } = options;

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ok = await checkRateLimit(supabase, `api:${routeName}:${user.id}`, rateLimit.max, rateLimit.windowSeconds);
  if (!ok) {
    return Response.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  let profile = null;
  if (requireAdmin) {
    const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    profile = data;
    if (!profile?.is_admin) {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }
  }

  let body = {};
  const method = request.method;
  if (method !== "GET") {
    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Malformed request body" }, { status: 400 });
    }
  }

  if (schema) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    body = parsed.data;
  }

  try {
    return await handler({ supabase, user, profile, data: body });
  } catch (err) {
    return Response.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
