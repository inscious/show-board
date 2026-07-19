import { guardedRoute } from "@/lib/apiGuard";
import { adminSelfSignupSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* live on/off switch for self-signup — a single row (id=1) in app_settings,
   read publicly (see app/api/settings/self-signup, app/login/page.jsx,
   middleware.js's /signup gate) but only admin-writable. Replaces the old
   SELF_SIGNUP_ENABLED env var, which needed a Vercel redeploy to change. */
export async function POST(request) {
  return guardedRoute(request, "admin:self-signup", { schema: adminSelfSignupSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("app_settings").update({ self_signup_enabled: data.enabled }).eq("id", 1);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email,
      action: data.enabled ? "self_signup_enable" : "self_signup_disable",
      message: data.enabled ? "Turned apprentice self-signup ON" : "Turned apprentice self-signup OFF",
    });

    return Response.json({ ok: true });
  });
}
