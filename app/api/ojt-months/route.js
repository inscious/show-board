import { guardedRoute } from "@/lib/apiGuard";
import { ojtMonthSchema, ojtMonthDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "ojt-months:post", { schema: ojtMonthSchema }, async ({ supabase, user, data }) => {
    // an actual edit to the hours lands as pending — an admin has to sign
    // off again. But a resync of the SAME numbers (background sync retrying,
    // a stale client cache, anything that isn't a real edit) must not
    // silently undo an admin's approval. Only flip to pending when the
    // values genuinely differ from what's on file.
    const { data: existing } = await supabase
      .from("ojt_months")
      .select("cat_a, cat_b, cat_c, cat_d, status")
      .eq("user_id", user.id)
      .eq("month", data.m)
      .maybeSingle();
    const unchanged = existing
      && Number(existing.cat_a) === data.a && Number(existing.cat_b) === data.b
      && Number(existing.cat_c) === data.c && Number(existing.cat_d) === data.d;
    // a resubmit after a decline always goes back to pending, even with the
    // same numbers — "unchanged" only means "don't undo an approval," not
    // "leave a declined month stuck declined forever."
    const status = unchanged && existing.status !== "rejected" ? existing.status : "pending";

    const { error } = await supabase.from("ojt_months").upsert({
      user_id: user.id,
      month: data.m,
      cat_a: data.a,
      cat_b: data.b,
      cat_c: data.c,
      cat_d: data.d,
      status,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "ojt-months:delete", { schema: ojtMonthDeleteSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("ojt_months").delete().eq("month", data.m).eq("user_id", user.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
