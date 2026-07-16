import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ojtState, mAdd, mKey, todayMid, mMed } from "@/lib/core";

/* Daily cron (see vercel.json) — no user session exists on a cron trigger,
   so this can't go through guardedRoute like every other admin route; the
   Authorization: Bearer $CRON_SECRET header (Vercel sets this automatically
   for configured crons) is what stands in for requireAdmin here.

   Fires two one-time-per-month emails per apprentice: a reminder once
   they're within 3 days of the 1st, and a late notice once they cross it.
   "Once" is enforced by a deterministic notification id — if that id
   already exists, the milestone already fired and this run skips it. */
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles, error: profErr } = await admin.from("profiles")
    .select("id, email, name")
    .eq("is_admin", false)
    .is("archived_at", null);
  if (profErr) return Response.json({ error: profErr.message }, { status: 500 });

  const nowKey = mKey(todayMid().getFullYear(), todayMid().getMonth());
  const lastMk = mAdd(nowKey, -1);

  let reminders = 0, lates = 0;
  for (const p of profiles) {
    const { data: months } = await admin.from("ojt_months").select("month").eq("user_id", p.id);
    const submitted = (months || []).map((m) => ({ m: m.month }));

    const openSt = ojtState(nowKey, submitted);
    const lateSt = ojtState(lastMk, submitted);

    if (openSt.k === "open" && openSt.days <= 3) {
      const id = "ojtdue-" + p.id + "-" + nowKey;
      const { data: existing } = await admin.from("notifications").select("id").eq("id", id).maybeSingle();
      if (!existing) {
        await admin.from("notifications").insert({ id, user_id: p.id, type: "ojt", message: mMed(nowKey) + " OJT due in " + openSt.days + " day" + (openSt.days === 1 ? "" : "s") + " — 4 PM on the 1st" });
        if (p.email) {
          await sendEmail({
            to: p.email, subject: "L831 Tracker — OJT due soon",
            html: `<p>Your ${mMed(nowKey)} OJT hours are due in ${openSt.days} day${openSt.days === 1 ? "" : "s"} — the 1st by 4:00 PM.</p><p>Turn in what you've logged before the deadline to stay off the do-not-hire list.</p>`,
          });
        }
        reminders++;
      }
    }

    if (lateSt.k === "late") {
      const id = "ojtlate-" + p.id + "-" + lastMk;
      const { data: existing } = await admin.from("notifications").select("id").eq("id", id).maybeSingle();
      if (!existing) {
        await admin.from("notifications").insert({ id, user_id: p.id, type: "ojt", message: mMed(lastMk) + " OJT is late — do-not-hire risk" });
        if (p.email) {
          await sendEmail({
            to: p.email, subject: "L831 Tracker — OJT is late",
            html: `<p>Your ${mMed(lastMk)} OJT hours are past the 1st, 4:00 PM deadline.</p><p>This puts you at risk of the do-not-hire list — turn it in as soon as you can.</p>`,
          });
        }
        lates++;
      }
    }
  }

  return Response.json({ ok: true, reminders, lates, checked: profiles.length });
}
