import { sendEmail } from "@/lib/email";

/* Central point for "let someone know something happened" — writes the
   in-app notifications row(s), the same thing every one of the 6 event
   types (class/cert/dnh/ojt/schedule/labor_call) already wrote before this
   file existed, and now also fires an email for any recipient with
   notify_email on. One shared place so a future notification type doesn't
   reinvent the insert-then-maybe-email dance each of the 6 grew
   independently (two of them — do-not-hire, approve-signup — already had
   their own hand-rolled, unconditional sendEmail call; this folds those in
   too, now actually gated by preference for the first time).

   `client` is whatever Supabase client the caller already has — its own
   admin session (RLS's "admin insert" policy on notifications already
   covers every admin-triggered route below) or the service-role client
   (labor-calls, since a foreman isn't an admin and needs to write other
   users' rows). Same client reads recipients' email/notify_email, so it
   needs read access to those profiles rows either way.

   rows is per-recipient: most callers map one shared message across a flat
   list of userIds (do-not-hire, classes, shows, labor-calls); cert-reminder
   builds a genuinely different message per row (one per expiring cert).
   Either shape is just an array of { userId, id?, message, emailSubject?,
   emailHtml? } here — omit emailSubject to skip email for that row
   entirely (e.g. a type that hasn't had its copy written yet). */
export async function notifyUsers(client, { type, idPrefix, upsert = false, rows }) {
  if (!rows?.length) return { error: null };

  const dbRows = rows.map((r, i) => ({
    id: r.id || idPrefix + Date.now().toString(36) + i,
    user_id: r.userId,
    type,
    message: r.message,
    ...(upsert ? { created_at: new Date().toISOString() } : {}),
  }));
  const q = client.from("notifications");
  const { error } = upsert ? await q.upsert(dbRows) : await q.insert(dbRows);
  if (error) return { error };

  // best-effort from here down — a failed/skipped email must never surface
  // as a failure of the action that triggered the notification itself.
  try {
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const { data: profiles } = await client.from("profiles").select("id, email, notify_email").in("id", userIds);
    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    await Promise.all(rows.map((r) => {
      const p = byId[r.userId];
      if (!p?.notify_email || !p.email || !r.emailSubject) return null;
      return sendEmail({ to: p.email, subject: r.emailSubject, html: r.emailHtml });
    }));
  } catch {
    // swallow — see comment above
  }

  return { error: null };
}
