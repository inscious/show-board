import { guardedRoute } from "@/lib/apiGuard";
import { adminOjtMonthSchema, adminOjtMonthDeleteSchema, adminOjtStatusSchema } from "@/lib/schemas";
import { mMed } from "@/lib/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/notify";

/* admin correcting or backfilling an apprentice's on-file OJT month —
   lands pre-approved since the admin is the authority here, not the
   apprentice-facing submit-then-review flow in app/api/ojt-months. */
export async function POST(request) {
  return guardedRoute(request, "admin:ojt-months:post", { schema: adminOjtMonthSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("ojt_months").upsert({
      user_id: data.userId, month: data.m,
      cat_a: data.a, cat_b: data.b, cat_c: data.c, cat_d: data.d,
      status: "approved",
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:ojt-months:delete", { schema: adminOjtMonthDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("ojt_months").delete().eq("month", data.m).eq("user_id", data.userId);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

/* approve / reject a pending submission — the only path that can move a
   row's status, since app/api/ojt-months (apprentice-facing) always forces 'pending'. */
export async function PATCH(request) {
  return guardedRoute(request, "admin:ojt-months:status", { schema: adminOjtStatusSchema, requireAdmin: true }, async ({ supabase, data }) => {
    // .select() so we can tell "updated 1 row" from "matched 0 rows" — RLS's
    // "admin all" policy on ojt_months is org-scoped, so a cross-org
    // (month, userId) pair matches nothing and this comes back empty rather
    // than erroring. The notification below (which goes through the
    // service-role client — see its own comment) must never fire unless a
    // row we're actually authorized to touch was really updated.
    const { data: updated, error } = await supabase.from("ojt_months")
      .update({ status: data.status })
      .eq("month", data.m).eq("user_id", data.userId)
      .select();
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });
    if (!updated || updated.length === 0) return Response.json({ error: "OJT month not found" }, { status: 404 });

    // let the apprentice know either way — a rejection especially, since
    // that's the signal to fix and resubmit, not just a silent drop.
    // Deterministic id (userId+month+status) + upsert instead of a fresh
    // insert every time: re-deciding the same month (e.g. an admin
    // double-clicking, or a reject/resubmit/reject cycle before the
    // apprentice has resubmitted) refreshes one row instead of stacking
    // duplicate "declined" notifications in their bell. Upsert's ON
    // CONFLICT DO UPDATE needs UPDATE privilege even on the no-conflict
    // path, and notifications only has an "admin insert" RLS policy — so
    // this one write goes through the admin client (bypasses RLS) rather
    // than opening up a broader "admin can update any notification" policy
    // just for this.
    if (data.status === "approved" || data.status === "rejected") {
      const approved = data.status === "approved";
      const message = approved
        ? mMed(data.m) + " OJT approved — it now counts toward your total."
        : mMed(data.m) + " OJT was declined by your admin — check the hours and resubmit.";
      const admin = createAdminClient();
      const { error: notifError } = await notifyUsers(admin, {
        type: "ojt", upsert: true,
        rows: [{
          id: "noj-" + data.userId + "-" + data.m + "-" + data.status,
          userId: data.userId,
          message,
          emailSubject: approved ? mMed(data.m) + " OJT approved" : mMed(data.m) + " OJT declined",
          emailHtml: approved
            ? `<p><strong>${mMed(data.m)}</strong> OJT was approved — it now counts toward your total.</p>`
            : `<p><strong>${mMed(data.m)}</strong> OJT was declined by your admin.</p><p>Check the hours and resubmit.</p>`,
        }],
      });
      if (notifError) console.error("ojt-months notification upsert failed:", notifError.message);
    }

    return Response.json({ ok: true });
  });
}
