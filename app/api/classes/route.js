import { guardedRoute } from "@/lib/apiGuard";
import { classSchema, classDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "classes:post", { schema: classSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("classes").upsert({
      id: data.id,
      user_id: user.id,
      name: data.name,
      start_min: data.start ?? null,
      location: data.loc || null,
      note: data.note || null,
      dates: data.dates,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "classes:delete", { schema: classDeleteSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("classes").delete().eq("id", data.id).eq("user_id", user.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
