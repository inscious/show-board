import { guardedRoute } from "@/lib/apiGuard";
import { adminRevokeAdminSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* the mirror of create-admin — plain profiles update, RLS's "admin update
   all" policy already covers it. Two guardrails that only make sense
   server-side: can't revoke your own session (no accidental lockout), and
   can't drop the last admin to zero (no locked-out system at all). */
export async function POST(request) {
  return guardedRoute(request, "admin:revoke-admin", { schema: adminRevokeAdminSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    if (data.userId === user.id) return Response.json({ error: "Can't revoke your own admin access." }, { status: 400 });

    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true);
    if ((count || 0) <= 1) return Response.json({ error: "At least one admin has to remain." }, { status: 400 });

    const { data: target } = await supabase.from("profiles").select("email").eq("id", data.userId).single();
    const { error } = await supabase.from("profiles").update({ is_admin: false }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not revoke" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: "admin_revoke", message: "Revoked admin access from " + (target?.email || data.userId),
    });

    return Response.json({ ok: true });
  });
}
