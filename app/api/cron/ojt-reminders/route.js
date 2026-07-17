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

  /* Used to be one ojt_months query PER apprentice, plus up to two more
     per-apprentice notification-existence checks — fine at 15 apprentices,
     but O(N) sequential round-trips in one request stops being fine well
     before "hundreds." Two bulk queries up front instead: fetch every
     apprentice's submitted months in one shot, decide who's due/late in
     memory, then check all their dedup ids in one more query. Only the
     insert + email for an apprentice actually crossing a milestone still
     happens per-apprentice — that part can't be batched (each is a real,
     distinct notification/email) and wasn't the expensive part anyway. */
  const ids = profiles.map((p) => p.id);
  const monthsByUser = {};
  if (ids.length) {
    const { data: allMonths, error: monthsErr } = await admin.from("ojt_months").select("user_id, month").in("user_id", ids);
    if (monthsErr) return Response.json({ error: monthsErr.message }, { status: 500 });
    (allMonths || []).forEach((m) => { (monthsByUser[m.user_id] = monthsByUser[m.user_id] || []).push({ m: m.month }); });
  }

  const dueCandidates = [], lateCandidates = [];
  for (const p of profiles) {
    const submitted = monthsByUser[p.id] || [];
    const openSt = ojtState(nowKey, submitted);
    const lateSt = ojtState(lastMk, submitted);
    if (openSt.k === "open" && openSt.days <= 3) dueCandidates.push({ p, id: "ojtdue-" + p.id + "-" + nowKey, days: openSt.days });
    if (lateSt.k === "late") lateCandidates.push({ p, id: "ojtlate-" + p.id + "-" + lastMk });
  }

  const candidateIds = dueCandidates.map((c) => c.id).concat(lateCandidates.map((c) => c.id));
  let existingIds = new Set();
  if (candidateIds.length) {
    const { data: existingRows, error: existErr } = await admin.from("notifications").select("id").in("id", candidateIds);
    if (existErr) return Response.json({ error: existErr.message }, { status: 500 });
    existingIds = new Set((existingRows || []).map((r) => r.id));
  }

  let reminders = 0, lates = 0;
  for (const c of dueCandidates) {
    if (existingIds.has(c.id)) continue;
    await admin.from("notifications").insert({ id: c.id, user_id: c.p.id, type: "ojt", message: mMed(nowKey) + " OJT due in " + c.days + " day" + (c.days === 1 ? "" : "s") + " — 4 PM on the 1st" });
    if (c.p.email) {
      await sendEmail({
        to: c.p.email, subject: "L831 Tracker — OJT due soon",
        html: `<p>Your ${mMed(nowKey)} OJT hours are due in ${c.days} day${c.days === 1 ? "" : "s"} — the 1st by 4:00 PM.</p><p>Turn in what you've logged before the deadline to stay off the do-not-hire list.</p>`,
      });
    }
    reminders++;
  }
  for (const c of lateCandidates) {
    if (existingIds.has(c.id)) continue;
    await admin.from("notifications").insert({ id: c.id, user_id: c.p.id, type: "ojt", message: mMed(lastMk) + " OJT is late — do-not-hire risk" });
    if (c.p.email) {
      await sendEmail({
        to: c.p.email, subject: "L831 Tracker — OJT is late",
        html: `<p>Your ${mMed(lastMk)} OJT hours are past the 1st, 4:00 PM deadline.</p><p>This puts you at risk of the do-not-hire list — turn it in as soon as you can.</p>`,
      });
    }
    lates++;
  }

  return Response.json({ ok: true, reminders, lates, checked: profiles.length });
}
