import { guardedRoute } from "@/lib/apiGuard";
import { adminRevokeAdminSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* the mirror of create-admin — plain profiles update, RLS's "admin update
   all" policy already covers it (org-scoped as of stage2_org_scoping.sql —
   a central admin's RLS-scoped client silently can't touch a row outside
   their own organization_id, so a cross-union revoke would already fail at
   the database level even without the explicit check below). Guardrails:
   only a central admin can revoke anyone (a moderator admin has every
   other admin capability, just not this one), can't revoke your own
   session (no accidental lockout), can't drop the last admin *of this
   union* to zero (no locked-out system at all — scoped per-org, not
   platform-wide, since another union having admins doesn't help this one). */
export async function POST(request) {
  return guardedRoute(request, "admin:revoke-admin", { schema: adminRevokeAdminSchema, requireAdmin: true }, async ({ supabase, user, profile, data }) => {
    if (!profile?.is_central_admin) return Response.json({ error: "Only a central admin can revoke admin access." }, { status: 403 });
    if (data.userId === user.id) return Response.json({ error: "Can't revoke your own admin access." }, { status: 400 });

    // RLS-scoped, so this is naturally already limited to the caller's own
    // union — explicit here (rather than relying only on the silent RLS
    // no-op below) so a cross-union attempt gets a real error instead of a
    // false "ok" that changed nothing.
    const { data: target, error: targetError } = await supabase.from("profiles").select("email, organization_id").eq("id", data.userId).maybeSingle();
    if (targetError || !target) return Response.json({ error: "Admin not found." }, { status: 404 });

    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true).eq("organization_id", profile.organization_id);
    if ((count || 0) <= 1) return Response.json({ error: "At least one admin has to remain." }, { status: 400 });

    const { error } = await supabase.from("profiles").update({ is_admin: false }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not revoke" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: "admin_revoke", message: "Revoked admin access from " + (target?.email || data.userId),
    });

    return Response.json({ ok: true });
  });
}
