import { guardedRoute } from "@/lib/apiGuard";
import { createAdminSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/auditLog";

/* admins are their own accounts, never a promoted apprentice — same account-
   creation shape as app/api/admin/apprentices, just with is_admin set from
   the start so this one never lands on the roster at all. New admins land
   as moderators (is_central_admin = false, can't revoke/grant admin access)
   unless the creator is themselves a central admin AND explicitly asks for
   it — a moderator admin creating another admin can never grant central
   status, whatever the request body claims. */
export async function POST(request) {
  return guardedRoute(request, "admin:create-admin", { schema: createAdminSchema, requireAdmin: true }, async ({ user, profile, data }) => {
    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) return Response.json({ error: error.message || "Could not create account" }, { status: 400 });

    const isCentralAdmin = !!(profile?.is_central_admin && data.isCentralAdmin);
    await admin.from("profiles").update({ name: data.name || null, has_password: true, is_admin: true, is_central_admin: isCentralAdmin, approved_at: new Date().toISOString() }).eq("id", created.user.id);

    await logAudit(admin, {
      actorEmail: user.email, targetEmail: data.email,
      action: "admin_create", message: "Created admin account " + data.email,
    });

    return Response.json({ ok: true });
  });
}
