import { guardedRoute } from "@/lib/apiGuard";
import { adminForemanSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* Grant or revoke Foreman capability on an EXISTING apprentice/CJ's own
   profile — not a new account. See platform_architecture_scoping memory:
   most real hiring foremen are also union members, so this is a flag on
   their own login (same shape as graduated_at), not a separate identity.
   Plain profiles update through the caller's own RLS-scoped client — the
   org-scoped "admin update all" policy already means an admin can only
   ever grant this to an apprentice in their own union, same as every other
   admin write to profiles. */
export async function POST(request) {
  return guardedRoute(request, "admin:foreman", { schema: adminForemanSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { data: target, error: targetError } = await supabase.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    if (targetError || !target) return Response.json({ error: "Apprentice not found." }, { status: 404 });

    const { error } = await supabase.from("profiles").update({ foreman_of_company_id: data.companyId }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target.email,
      action: data.companyId ? "foreman_grant" : "foreman_revoke",
      message: data.companyId ? "Granted foreman capability to " + target.email : "Revoked foreman capability from " + target.email,
    });

    return Response.json({ ok: true });
  });
}
