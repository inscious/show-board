import { guardedRoute } from "@/lib/apiGuard";
import { adminJatcContactSchema, adminJatcContactDeleteSchema } from "@/lib/schemas";

/* JATC office staff directory — same shared/admin-write shape as companies.
   id is client-assigned (matches the rest of the app's id convention). */
export async function POST(request) {
  return guardedRoute(request, "admin:jatc-contacts:post", { schema: adminJatcContactSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("jatc_contacts").upsert({
      id: data.id, name: data.name, tel: data.tel || null, ext: data.ext || null, email: data.email || null, sms: data.sms || null,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:jatc-contacts:delete", { schema: adminJatcContactDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("jatc_contacts").delete().eq("id", data.id);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
