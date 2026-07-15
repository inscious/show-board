import { guardedRoute } from "@/lib/apiGuard";
import { adminCertSchema, adminCertDeleteSchema } from "@/lib/schemas";

/* admin-entered per-apprentice certifications (CPR, OSHA-10, lift certs) —
   the training center is the record-of-truth here, same reasoning as
   ojt_months; apprentices only ever read their own. */
export async function POST(request) {
  return guardedRoute(request, "admin:certs:post", { schema: adminCertSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("certifications").upsert({ id: data.id, user_id: data.userId, name: data.name, exp: data.exp });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:certs:delete", { schema: adminCertDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("certifications").delete().eq("id", data.id).eq("user_id", data.userId);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
