import { guardedRoute } from "@/lib/apiGuard";
import { entrySchema, entryDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  // Local-first: every state change in the app (not just entries) re-runs the
  // debounced sync, and a failed entry keeps retrying on every subsequent save
  // until it lands. The default 30/60s cap is shared across phone+desktop on
  // the same account and the fixed window doesn't self-heal while the app is
  // in active use (see check_rate_limit in schema.sql) — too easy to jam
  // during a normal editing session, which then blocks real hour-logging.
  return guardedRoute(request, "entries:post", { schema: entrySchema, rateLimit: { max: 120, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("work_entries").upsert({
      id: data.id,
      user_id: user.id,
      worked_on: data.dayKey,
      company: data.co,
      category: data.cat,
      note: data.note || null,
      hours: data.clock,
      st_hours: data.st,
      ot_hours: data.ot,
      dt_hours: data.dt,
      in_min: data.in ?? null,
      out_min: data.out ?? null,
      break_min: data.brk ?? 0,
      pay_rate: data.payRate ?? null,
      show_id: data.showId ?? null,
      travel_pay: data.travel ?? null,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "entries:delete", { schema: entryDeleteSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("work_entries").delete().eq("id", data.id).eq("user_id", user.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
