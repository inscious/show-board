import { guardedRoute } from "@/lib/apiGuard";
import { adminApproveSignupSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";

/* the other half of self-signup (app/api/auth/sign-up) — flips a pending
   account (profiles.approved_at null) into a real one. RLS's "admin update
   all" policy on profiles already covers this, same as app/api/admin/profile;
   requireAdmin here is belt-and-suspenders. Rejecting a signup instead of
   approving it reuses the existing apprentices DELETE route, which already
   allows one-step deletion for a never-approved account. */
export async function POST(request) {
  return guardedRoute(request, "admin:approve-signup", { schema: adminApproveSignupSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { data: target } = await supabase.from("profiles").select("email, notify_email").eq("id", data.userId).single();
    // graduated_at only ever moves for real here because the caller is a
    // confirmed admin (guardedRoute's requireAdmin above) — the same write
    // from a non-admin session would get silently reverted by
    // protect_profile_privilege_columns(). markCj is the admin's own call,
    // not an automatic grant of whatever the signup form's role picker said.
    const update = { approved_at: new Date().toISOString() };
    if (data.markCj) update.graduated_at = new Date().toISOString();
    const { error } = await supabase.from("profiles").update(update).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not approve" }, { status: 400 });

    // best-effort, same as every other transactional email here — a missing
    // key or a failed send shouldn't undo the approval itself. Gated by
    // notify_email same as every other notification now (this one has no
    // in-app bell row to go with it — /pending has nothing to show it on —
    // so it's a plain preference check, not routed through notifyUsers).
    if (target?.email && target.notify_email) {
      await sendEmail({
        to: target.email,
        subject: "You're in — L831 Tracker",
        html: `<p>Your account's approved. Log back in and you'll get a quick rundown of the app.</p>`,
      });
    }

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: "approve_signup",
      message: "Approved " + (target?.email || data.userId) + (data.markCj ? " as Certified Journeyman" : ""),
    });

    return Response.json({ ok: true });
  });
}
