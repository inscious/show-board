import { guardedRoute } from "@/lib/apiGuard";
import { adminDc36ContactSchema, adminDc36ContactDeleteSchema } from "@/lib/schemas";

/* District Council 36 contacts — a separate table from jatc_contacts (the
   training center), not a relabeled subset of it. Same shared/admin-write
   shape as jatc_contacts and companies. id is client-assigned. */
export async function POST(request) {
  return guardedRoute(request, "admin:dc36-contacts:post", { schema: adminDc36ContactSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("dc36_contacts").upsert({
      id: data.id, name: data.name, tel: data.tel || null, ext: data.ext || null, email: data.email || null, sms: data.sms || null,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:dc36-contacts:delete", { schema: adminDc36ContactDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("dc36_contacts").delete().eq("id", data.id);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
