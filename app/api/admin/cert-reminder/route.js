import { guardedRoute } from "@/lib/apiGuard";
import { adminCertReminderSchema } from "@/lib/schemas";
import { notifyUsers } from "@/lib/notify";

/* the client already knows which certs are expiring/expired (ExpiringCerts
   on the dashboard computes it from certsByUser, already loaded) — this
   route just fans that list out into one notification per apprentice, same
   in-app mechanism classes/do-not-hire already use. Each row is its own
   cert/expiry, so — unlike classes' shared-message batches — the email
   copy genuinely varies per recipient here. */
export async function POST(request) {
  return guardedRoute(request, "admin:cert-reminder", { schema: adminCertReminderSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await notifyUsers(supabase, {
      type: "cert", idPrefix: "ncert",
      rows: data.reminders.map((r) => ({
        userId: r.userId,
        message: `Renew "${r.certName}" — expires ${r.exp}`,
        emailSubject: "Renew " + r.certName,
        emailHtml: `<p><strong>${r.certName}</strong> expires ${r.exp}.</p><p>Renew it and update the certification in the app.</p>`,
      })),
    });
    if (error) return Response.json({ error: "Could not send reminders" }, { status: 400 });
    return Response.json({ ok: true, count: data.reminders.length });
  });
}
