import { guardedRoute } from "@/lib/apiGuard";
import { setPasswordSchema } from "@/lib/schemas";
import { sendEmail } from "@/lib/email";

/* self-service — a platform admin changing their own password. Not gated by
   guardedRoute's requireAdmin (that checks profiles.is_admin, and platform
   admins deliberately have no profiles row — see handle_new_user() in
   supabase/stage1_staging.sql). Checked here against platform_admins instead. */
export async function POST(request) {
  return guardedRoute(request, "console:set-password", { schema: setPasswordSchema, rateLimit: { max: 5, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) return Response.json({ error: "Couldn't set password" }, { status: 400 });

    await sendEmail({
      to: user.email,
      subject: "L831 Tracker — your Platform Console password was changed",
      html: `<p>The password on your Platform Console account (${user.email}) was just changed.</p><p>If that wasn't you, sign in and change it again right away.</p>`,
    });

    return Response.json({ ok: true });
  });
}
