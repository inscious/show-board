import { guardedRoute } from "@/lib/apiGuard";
import { adminOjtAutoApproveSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* Live on/off switch for OJT auto-approve — a single boolean in
   app_settings (same row/pattern as self_signup_enabled), only
   admin-writable. When on, an apprentice's own submitted/uploaded OJT
   months land approved immediately instead of waiting on admin review —
   protect_ojt_months_status() (supabase/schema.sql) is what actually
   enforces this at the DB level for apprentice-initiated writes; this
   route only flips the setting it reads. */
export async function POST(request) {
  return guardedRoute(request, "admin:ojt-auto-approve", { schema: adminOjtAutoApproveSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("app_settings").update({ ojt_auto_approve: data.enabled }).eq("id", 1);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email,
      action: data.enabled ? "ojt_auto_approve_enable" : "ojt_auto_approve_disable",
      message: data.enabled ? "Turned OJT auto-approve ON" : "Turned OJT auto-approve OFF",
    });

    return Response.json({ ok: true });
  });
}
