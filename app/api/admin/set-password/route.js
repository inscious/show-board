import { guardedRoute } from "@/lib/apiGuard";
import { adminSetPasswordSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/* resetting an apprentice's password requires the platform Admin API
   (auth.admin.updateUserById) — no RLS policy can grant that, it's not a
   table row. requireAdmin below gates this to admins in general; the
   lookup right after is what stops one union's admin from reaching into a
   different union's account — the Admin API call itself has no RLS under
   it at all, so nothing else here would catch a cross-org attempt.
   Same pattern as app/api/admin/revoke-admin: look the target up through
   the RLS-scoped client first (its "admin read all" policy is already
   org-scoped), so a cross-org id naturally returns nothing and this can
   fail with a real error instead of silently resetting the wrong org's
   account. */
export async function POST(request) {
  return guardedRoute(request, "admin:set-password", { schema: adminSetPasswordSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { data: target, error: targetError } = await supabase.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (targetError || !target) return Response.json({ error: "Apprentice not found" }, { status: 404 });

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) return Response.json({ error: "Couldn't set password" }, { status: 400 });

    const { data: profile } = await admin.from("profiles").update({ has_password: true }).eq("id", data.userId).select("email").maybeSingle();
    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: "L831 Tracker — your password was changed",
        html: `<p>An admin changed the password on your L831 Tracker account (${profile.email}).</p><p>If you weren't expecting this, ask your admin.</p>`,
      });
    }

    return Response.json({ ok: true });
  });
}
