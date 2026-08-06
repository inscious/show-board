import { guardedRoute } from "@/lib/apiGuard";
import { adminSelfSignupSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* live on/off switch for self-signup — one row per union org in
   app_settings, org-scoped both by RLS (organization_id = the caller's own,
   see supabase/stage7_app_settings_org_scoping.sql) and by this explicit
   filter (belt-and-suspenders, same reasoning as every other org-scoped
   admin write in this app). Read publicly for the pilot org today (see
   app/api/settings/self-signup, app/login/page.jsx, middleware.js's
   /signup gate) — real per-org public routing is a separate, later piece
   of work. Replaces the old SELF_SIGNUP_ENABLED env var, which needed a
   Vercel redeploy to change. */
export async function POST(request) {
  return guardedRoute(request, "admin:self-signup", { schema: adminSelfSignupSchema, requireAdmin: true }, async ({ supabase, user, profile, data }) => {
    const { error } = await supabase.from("app_settings").update({ self_signup_enabled: data.enabled }).eq("organization_id", profile.organization_id);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email,
      action: data.enabled ? "self_signup_enable" : "self_signup_disable",
      message: data.enabled ? "Turned apprentice self-signup ON" : "Turned apprentice self-signup OFF",
    });

    return Response.json({ ok: true });
  });
}
