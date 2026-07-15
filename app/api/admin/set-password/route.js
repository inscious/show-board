import { guardedRoute } from "@/lib/apiGuard";
import { adminSetPasswordSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/* resetting an apprentice's password requires the platform Admin API
   (auth.admin.updateUserById) — no RLS policy can grant that, it's not a
   table row. requireAdmin below is what actually gates this. */
export async function POST(request) {
  return guardedRoute(request, "admin:set-password", { schema: adminSetPasswordSchema, requireAdmin: true }, async ({ data }) => {
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
