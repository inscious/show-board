import { guardedRoute } from "@/lib/apiGuard";
import { adminOjtMonthSchema, adminOjtMonthDeleteSchema, adminOjtStatusSchema } from "@/lib/schemas";
import { mMed } from "@/lib/core";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { error } = await supabase.from("ojt_months").update({ status: data.status }).eq("month", data.m).eq("user_id", data.userId);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

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
      const message = data.status === "approved"
        ? mMed(data.m) + " OJT approved — it now counts toward your total."
        : mMed(data.m) + " OJT was declined by your admin — check the hours and resubmit.";
      const admin = createAdminClient();
      const { error: notifError } = await admin.from("notifications").upsert({
        id: "noj-" + data.userId + "-" + data.m + "-" + data.status,
        user_id: data.userId, type: "ojt", message, created_at: new Date().toISOString(),
      });
      if (notifError) console.error("ojt-months notification upsert failed:", notifError.message);
    }

    return Response.json({ ok: true });
  });
}
