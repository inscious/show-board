import { guardedRoute } from "@/lib/apiGuard";
import { adminCertReminderSchema } from "@/lib/schemas";

/* the client already knows which certs are expiring/expired (ExpiringCerts
   on the dashboard computes it from certsByUser, already loaded) — this
   route just fans that list out into one notification per apprentice, same
   in-app mechanism classes/do-not-hire already use. No email involved. */
export async function POST(request) {
  return guardedRoute(request, "admin:cert-reminder", { schema: adminCertReminderSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const rows = data.reminders.map((r, i) => ({
      id: "ncert" + Date.now().toString(36) + i,
      user_id: r.userId,
      type: "cert",
      message: `Renew "${r.certName}" — expires ${r.exp}`,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) return Response.json({ error: "Could not send reminders" }, { status: 400 });
    return Response.json({ ok: true, count: rows.length });
  });
}
