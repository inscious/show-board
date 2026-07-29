import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* Who responded to one of MY calls — foreman-only, verified against
   labor_calls.posted_by before anything is returned. Uses the service-role
   client because a foreman reading another worker's contact info (email,
   phone) and do-not-hire status isn't something the plain "own profile"
   RLS policy permits — same narrow "enough to act on, not a full dump"
   shape as app/api/console/accounts/[id]/route.js. DNH status is included
   deliberately: foremen already get a do-not-hire list from the training
   center outside this app today, so this isn't new disclosure. */
export async function GET(request, { params }) {
  return guardedRoute(request, "labor-calls:responses:get", { rateLimit: { max: 60, windowSeconds: 60 } }, async ({ supabase, user }) => {
    const callId = Number(params?.id);
    if (!callId) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: call } = await supabase.from("labor_calls").select("id, posted_by").eq("id", callId).maybeSingle();
    if (!call || call.posted_by !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: responses, error } = await admin
      .from("labor_call_responses")
      .select("user_id, status, responded_at")
      .eq("labor_call_id", callId)
      .order("responded_at", { ascending: true });
    if (error) return Response.json({ error: "Could not load responses" }, { status: 400 });

    const userIds = (responses || []).map((r) => r.user_id);
    let profiles = [];
    if (userIds.length) {
      const { data } = await admin
        .from("profiles")
        .select("id, name, email, avatar_url, phone, graduated_at, do_not_hire_at, do_not_hire_reason")
        .in("id", userIds);
      profiles = data || [];
    }
    const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

    return Response.json({
      ok: true,
      responses: (responses || []).map((r) => {
        const p = byId[r.user_id] || {};
        return {
          userId: r.user_id,
          status: r.status,
          respondedAt: r.responded_at,
          name: p.name || null,
          email: p.email || null,
          avatarUrl: p.avatar_url || null,
          phone: p.phone || null,
          isCJ: !!p.graduated_at,
          doNotHire: !!p.do_not_hire_at,
          doNotHireReason: p.do_not_hire_reason || null,
        };
      }),
    });
  });
}
