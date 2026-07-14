import { guardedRoute } from "@/lib/apiGuard";
import { rateSchema, rateDeleteSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "rates:post", { schema: rateSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("company_rates").upsert({
      user_id: user.id,
      company: data.co,
      pay_level: data.level,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "rates:delete", { schema: rateDeleteSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("company_rates").delete().eq("company", data.co).eq("user_id", user.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
