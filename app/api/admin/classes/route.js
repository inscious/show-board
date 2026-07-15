import { guardedRoute } from "@/lib/apiGuard";
import { adminClassAssignSchema, adminClassDeleteSchema, adminClassAttendanceSchema } from "@/lib/schemas";

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
