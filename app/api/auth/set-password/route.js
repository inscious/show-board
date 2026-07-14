import { guardedRoute } from "@/lib/apiGuard";
import { setPasswordSchema } from "@/lib/schemas";
import { sendEmail } from "@/lib/email";

export async function POST(request) {
  return guardedRoute(request, "auth:set-password", { schema: setPasswordSchema, rateLimit: { max: 5, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) return Response.json({ error: "Couldn't set password" }, { status: 400 });

    await supabase.from("profiles").update({ has_password: true }).eq("id", user.id);

    await sendEmail({
      to: user.email,
      subject: "Show Board — your password was changed",
      html: `<p>The password on your Show Board account (${user.email}) was just changed.</p><p>If that wasn't you, sign in and change it again right away.</p>`,
    });

    return Response.json({ ok: true });
  });
}
