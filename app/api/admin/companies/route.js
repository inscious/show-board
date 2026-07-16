import { guardedRoute } from "@/lib/apiGuard";
import { adminCompanySchema, adminCompanyDeleteSchema } from "@/lib/schemas";

/* shared I&D labor-shop directory — one copy for the whole local, everyone
   reads it (app/api/... none needed, it's a direct RLS-scoped select), only
   admin writes. name is the natural key (unique in schema.sql). */
export async function POST(request) {
  return guardedRoute(request, "admin:companies:post", { schema: adminCompanySchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("companies").upsert({
      name: data.name, city: data.city || null, state: data.state || null,
      labor_line: data.laborLine || null, foreman: data.foreman || null,
    }, { onConflict: "name" });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:companies:delete", { schema: adminCompanyDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("companies").delete().eq("name", data.name);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
