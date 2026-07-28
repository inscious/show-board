import { guardedRoute } from "@/lib/apiGuard";
import { platformImpersonateSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/* Start a real, time-boxed session as the target account — same
   platform_admins-gated + service-role pattern as every other console
   route. admin.auth.admin.generateLink()'s action_link uses Supabase's
   implicit hash-fragment flow (#access_token=...), which a server route
   can never consume (fragments never leave the browser) and which this
   app's own /auth/callback (PKCE ?code= only) doesn't handle either.
   Returning hashed_token instead lets the browser hit /impersonate/verify,
   a client page that calls supabase.auth.verifyOtp({token_hash, type})
   directly — no redirect/fragment mismatch involved.

   No explicit "not a platform admin" check on the target: platform admin
   accounts never get a profiles row at all (handle_new_user() skips it),
   so a target found via profiles can never simultaneously be a platform
   admin — structurally excluded, not just checked. */
const SESSION_MINUTES = 30;

export async function POST(request) {
  return guardedRoute(request, "console:impersonate:start", { schema: platformImpersonateSchema, rateLimit: { max: 10, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin.from("profiles").select("id, email, name").eq("id", data.targetUserId).maybeSingle();
    if (targetError || !target) return Response.json({ error: "Account not found" }, { status: 404 });

    const origin = new URL(request.url).origin;
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: { redirectTo: origin + "/auth/callback" },
    });
    if (linkError || !link?.properties?.hashed_token) {
      return Response.json({ error: "Could not start session" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString();
    await admin.from("impersonation_sessions").insert({
      platform_admin_id: user.id,
      platform_admin_email: user.email,
      target_user_id: target.id,
      target_email: target.email,
      expires_at: expiresAt,
    });

    await admin.from("platform_audit_log").insert({
      actor_email: user.email,
      target_email: target.email,
      action: "impersonate_start",
      message: `Started impersonating ${target.name || target.email} for ${SESSION_MINUTES} minutes`,
    });

    return Response.json({ ok: true, tokenHash: link.properties.hashed_token });
  });
}
