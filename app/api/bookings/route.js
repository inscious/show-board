import { guardedRoute } from "@/lib/apiGuard";
import { bookingSchema, bookingDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "bookings:post", { schema: bookingSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("bookings").upsert({
      id: data.id,
      user_id: user.id,
      company: data.co,
      show: data.show || null,
      note: data.note || null,
      dates: data.dates,
      day_notes: data.dayNotes || {},
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "bookings:delete", { schema: bookingDeleteSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("bookings").delete().eq("id", data.id).eq("user_id", user.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
