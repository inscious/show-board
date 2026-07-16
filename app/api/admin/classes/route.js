import { guardedRoute } from "@/lib/apiGuard";
import { adminClassAssignSchema, adminClassDeleteSchema, adminClassAttendanceSchema, adminClassEditSchema } from "@/lib/schemas";

/* one class, assigned to one or many apprentices at once — each gets its
   own row (classes has no shared "template" id, just per-user rows), same
   name/time/location/dates, so editing later still means editing each
   apprentice's row individually (matches how classes already work). */
export async function POST(request) {
  return guardedRoute(request, "admin:classes:post", { schema: adminClassAssignSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const rows = data.userIds.map((userId, i) => ({
      id: "ac" + Date.now().toString(36) + i,
      user_id: userId,
      name: data.name,
      start_min: data.start ?? null,
      location: data.loc || null,
      note: data.note || null,
      dates: data.dates,
    }));
    const { error } = await supabase.from("classes").upsert(rows);
    if (error) return Response.json({ error: "Could not assign" }, { status: 400 });

    // best-effort — a notification that doesn't land shouldn't fail the assignment itself
    await supabase.from("notifications").insert(data.userIds.map((userId, i) => ({
      id: "nc" + Date.now().toString(36) + i, user_id: userId, type: "class",
      message: `New class assigned: ${data.name}`,
    })));

    return Response.json({ ok: true, count: rows.length });
  });
}

/* editing a session means editing every apprentice's row in it — same "no
   shared template id" reality as POST above, so this takes the full list of
   {id, userId} pairs the client already has (from grouping classesByUser by
   name+dates) and updates each one to the new shared name/start/loc/note/
   dates. missed_dates is left untouched — a missed date that's no longer in
   the new date range just stops rendering, nothing to migrate. */
export async function PUT(request) {
  return guardedRoute(request, "admin:classes:put", { schema: adminClassEditSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const results = await Promise.all(data.items.map(({ id, userId }) =>
      supabase.from("classes").update({
        name: data.name, start_min: data.start ?? null, location: data.loc || null, note: data.note || null, dates: data.dates,
      }).eq("id", id).eq("user_id", userId)));
    if (results.some((r) => r.error)) return Response.json({ error: "Could not update the class" }, { status: 400 });

    await supabase.from("notifications").insert(data.items.map(({ userId }, i) => ({
      id: "nce" + Date.now().toString(36) + i, user_id: userId, type: "class",
      message: `Class updated: ${data.name}`,
    })));

    return Response.json({ ok: true, count: data.items.length });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:classes:delete", { schema: adminClassDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("classes").delete().eq("id", data.id).eq("user_id", data.userId);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

/* toggling attendance per date — the apprentice can't touch this, only see
   the result. A date landing in missed_dates for the first time gets a
   notification; reverting one (admin marks it taken again) doesn't spam one. */
export async function PATCH(request) {
  return guardedRoute(request, "admin:classes:patch", { schema: adminClassAttendanceSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { data: existing, error: fetchErr } = await supabase
      .from("classes").select("name, missed_dates").eq("id", data.id).eq("user_id", data.userId).single();
    if (fetchErr || !existing) return Response.json({ error: "Class not found" }, { status: 404 });

    const { error } = await supabase.from("classes")
      .update({ missed_dates: data.missedDates }).eq("id", data.id).eq("user_id", data.userId);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    const before = new Set(existing.missed_dates || []);
    const newlyMissed = data.missedDates.filter((d) => !before.has(d));
    if (newlyMissed.length) {
      await supabase.from("notifications").insert(newlyMissed.map((d, i) => ({
        id: "nma" + Date.now().toString(36) + i, user_id: data.userId, type: "class",
        message: `Marked absent — ${existing.name}, ${d}`,
      })));
    }
    return Response.json({ ok: true });
  });
}
