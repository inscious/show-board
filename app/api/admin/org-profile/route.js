import { guardedRoute } from "@/lib/apiGuard";
import { adminOrgProfileSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* Admin-editable org identity — union name, out-of-work line, JATC office
   address — stored as one JSONB blob in app_settings.org_profile rather
   than one column per field, so future "union profile" fields (Phase 2 of
   the platform-vision memory) can be added by extending the object, not by
   another migration. lib/core.ts's UNION_NAME/UNION_LINE/JATC.office stay
   the fallback defaults (used pre-auth on /login, and whenever a field here
   is empty) — this route only overrides them per-deployment. */
export async function POST(request) {
  return guardedRoute(request, "admin:org-profile", { schema: adminOrgProfileSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("app_settings").update({ org_profile: data }).eq("id", 1);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email,
      action: "org_profile_update",
      message: "Updated org profile (union name / out-of-work line / JATC address)",
    });

    return Response.json({ ok: true });
  });
}
