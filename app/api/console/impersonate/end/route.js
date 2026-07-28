import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* Ends the CALLER's own active impersonation session (scoped to their own
   authenticated user id, never client-supplied — a user can only ever end
   a session where they themselves are the target) and hands back a fresh
   magic link for the platform admin to return to /console already signed
   in, no retyping credentials. No pre-generated/stored return token —
   deliberately regenerated fresh here instead, so nothing sensitive ever
   sits in impersonation_sessions (which the target can also read, for the
   in-app banner check — see supabase/console_impersonation.sql). */
export async function POST(request) {
  return guardedRoute(request, "console:impersonate:end", { rateLimit: { max: 10, windowSeconds: 60 } }, async ({ user }) => {
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("impersonation_sessions")
      .select("*")
      .eq("target_user_id", user.id)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) return Response.json({ error: "No active impersonation session" }, { status: 404 });

    await admin.from("impersonation_sessions").update({ ended_at: new Date().toISOString() }).eq("id", session.id);
    await admin.from("platform_audit_log").insert({
      actor_email: session.platform_admin_email,
      target_email: session.target_email,
      action: "impersonate_end",
      message: `Ended impersonation of ${session.target_email}`,
    });

    const origin = new URL(request.url).origin;
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: session.platform_admin_email,
      options: { redirectTo: origin + "/auth/callback" },
    });
    if (linkError || !link?.properties?.hashed_token) {
      // the session already ended above even if the return link fails —
      // worst case the platform admin has to sign back in normally.
      return Response.json({ error: "Ended, but could not generate a return link — sign back in manually." }, { status: 500 });
    }

    return Response.json({ ok: true, tokenHash: link.properties.hashed_token });
  });
}
