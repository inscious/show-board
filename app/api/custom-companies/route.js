import { guardedRoute } from "@/lib/apiGuard";
import { customCompanySchema } from "@/lib/schemas";

/* Small, rarely-written per-user list (ad-hoc company names typed into the
   picker) — stored as a text[] on profiles rather than its own table. */
export async function POST(request) {
  return guardedRoute(request, "custom-companies:post", { schema: customCompanySchema }, async ({ supabase, user, data }) => {
    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("custom_companies")
      .eq("id", user.id)
      .single();
    if (readError) return Response.json({ error: "Could not save" }, { status: 400 });

    const existing = profile?.custom_companies || [];
    if (existing.includes(data.name)) return Response.json({ ok: true });
    if (existing.length >= 200) return Response.json({ error: "Too many custom companies" }, { status: 400 });

    const { error } = await supabase
      .from("profiles")
      .update({ custom_companies: [...existing, data.name] })
      .eq("id", user.id);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
