import { guardedRoute } from "@/lib/apiGuard";
import { platformSetRolesSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/* Platform Admin's role-assignment tool — named explicitly by the user for
   his own testing/troubleshooting (see platform_architecture_scoping
   memory). Deliberately crosses every union boundary, so it goes through
   the service-role client (bypasses each union's own org-scoped RLS on
   purpose) rather than the caller's RLS-scoped one — a platform admin has
   no profiles row at all, so there's no RLS-scoped session that could do
   this anyway. Not gated by guardedRoute's requireAdmin (that checks
   profiles.is_admin, which doesn't apply to platform admins); checked here
   against platform_admins instead, same pattern as /api/console/set-password.

   Every change gets logged to platform_audit_log — a separate table from
   the union-scoped admin_audit_log, since this crosses tenant boundaries
   and admin_audit_log has no organization_id to scope a cross-tenant
   action against, and is readable by every union admin. */
export async function POST(request) {
  return guardedRoute(request, "console:set-roles", { schema: platformSetRolesSchema, rateLimit: { max: 20, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin.from("profiles").select("id, email").eq("email", data.email).maybeSingle();
    if (targetError || !target) return Response.json({ error: "No account with that email." }, { status: 404 });

    const changes = {};
    if (data.isAdmin !== undefined) changes.is_admin = data.isAdmin;
    if (data.isCentralAdmin !== undefined) changes.is_central_admin = data.isCentralAdmin;
    if (data.organizationId !== undefined) changes.organization_id = data.organizationId;
    if (data.foremanOfCompanyId !== undefined) changes.foreman_of_company_id = data.foremanOfCompanyId;
    if (data.graduatedAt !== undefined) changes.graduated_at = data.graduatedAt || null;

    if (Object.keys(changes).length === 0) {
      return Response.json({ error: "Nothing to change." }, { status: 400 });
    }

    const { error } = await admin.from("profiles").update(changes).eq("id", target.id);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    // own table, not the shared logAudit()/admin_audit_log — this crosses
    // union boundaries, admin_audit_log has no organization_id to scope it
    // against and is readable by every union admin.
    await admin.from("platform_audit_log").insert({
      actor_email: user.email, target_email: target.email,
      action: "platform_set_roles",
      message: "Set " + JSON.stringify(changes) + " on " + target.email,
    });

    return Response.json({ ok: true });
  });
}
