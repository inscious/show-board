import { guardedRoute } from "@/lib/apiGuard";
import { adminApproveSignupSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* the other half of self-signup (app/api/auth/sign-up) — flips a pending
   account (profiles.approved_at null) into a real one. RLS's "admin update
   all" policy on profiles already covers this, same as app/api/admin/profile;
   requireAdmin here is belt-and-suspenders. Rejecting a signup instead of
   approving it reuses the existing apprentices DELETE route, which already
   allows one-step deletion for a never-approved account. */
export async function POST(request) {
  return guardedRoute(request, "admin:approve-signup", { schema: adminApproveSignupSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { data: target } = await supabase.from("profiles").select("email").eq("id", data.userId).single();
    const { error } = await supabase.from("profiles").update({ approved_at: new Date().toISOString() }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not approve" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: "approve_signup", message: "Approved " + (target?.email || data.userId),
    });

    return Response.json({ ok: true });
  });
}
