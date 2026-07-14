import { guardedRoute } from "@/lib/apiGuard";
import { ojtMonthSchema, ojtMonthDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "ojt-months:post", { schema: ojtMonthSchema }, async ({ supabase, user, data }) => {
    // always lands as pending, even editing a previously-approved month —
    // an admin has to sign off before it counts toward the running total.
    const { error } = await supabase.from("ojt_months").upsert({
      user_id: user.id,
      month: data.m,
      cat_a: data.a,
      cat_b: data.b,
      cat_c: data.c,
      cat_d: data.d,
      status: "pending",
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
