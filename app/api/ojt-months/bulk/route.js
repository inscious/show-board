import { guardedRoute } from "@/lib/apiGuard";
import { ojtMonthBulkSchema } from "@/lib/schemas";

/* The write side of OJT bulk import (app/api/ojt-months/extract reads files
   and drafts numbers; this saves what the apprentice reviewed/edited). One
   batched upsert instead of N single-month requests — the whole point of
   "efficient" here, and it keeps a big backfill from tripping the regular
   ojt-months route's per-request rate limit. Same unchanged-value check as
   that route: only rows whose hours actually changed get bumped back to
   'pending' — a resubmit of the same numbers doesn't undo an existing
   approval. The DB trigger (protect_ojt_months_status) enforces this too,
   belt-and-suspenders, same as the single-month route. */
export async function POST(request) {
  return guardedRoute(request, "ojt-months:bulk", { schema: ojtMonthBulkSchema, rateLimit: { max: 5, windowSeconds: 60 } }, async ({ supabase, user, data: rows }) => {
    const months = rows.map((r) => r.m);
    const { data: existingRows } = await supabase
      .from("ojt_months")
      .select("month, cat_a, cat_b, cat_c, cat_d, status")
      .eq("user_id", user.id)
      .in("month", months);
    const existingByMonth = new Map((existingRows || []).map((r) => [r.month, r]));

    const payload = rows.map((r) => {
      const existing = existingByMonth.get(r.m);
      const unchanged = existing
        && Number(existing.cat_a) === r.a && Number(existing.cat_b) === r.b
        && Number(existing.cat_c) === r.c && Number(existing.cat_d) === r.d;
      // same as the single-month route: a declined month always goes back
      // to pending on resubmit, even with identical numbers.
      const status = unchanged && existing.status !== "rejected" ? existing.status : "pending";
      return {
        user_id: user.id,
        month: r.m,
        cat_a: r.a,
        cat_b: r.b,
        cat_c: r.c,
        cat_d: r.d,
        status,
      };
    });

    const { error } = await supabase.from("ojt_months").upsert(payload);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true, saved: payload.length });
  });
}
