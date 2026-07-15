import { guardedRoute } from "@/lib/apiGuard";
import { adminClassAssignSchema, adminClassDeleteSchema } from "@/lib/schemas";

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
