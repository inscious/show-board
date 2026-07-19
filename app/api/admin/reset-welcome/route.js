import { guardedRoute } from "@/lib/apiGuard";
import { adminResetWelcomeSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* clears welcomed_at so the first-login welcome modal (components/apprentice/
   WelcomeModal.jsx) shows again next time this apprentice loads Home — for
   someone who missed it, or who needs the OJT-history nudge again after a
   support call. Same plain-profiles-column shape as archive/do-not-hire. */
export async function POST(request) {
  return guardedRoute(request, "admin:reset-welcome", { schema: adminResetWelcomeSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { data: target } = await supabase.from("profiles").select("email").eq("id", data.userId).single();
    const { error } = await supabase.from("profiles").update({ welcomed_at: null }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not reset" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: "reset_welcome", message: "Reset welcome modal for " + (target?.email || data.userId),
    });

    return Response.json({ ok: true });
  });
}
