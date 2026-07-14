import { guardedRoute } from "@/lib/apiGuard";
import { pinSchema } from "@/lib/schemas";

export async function POST(request) {
  return guardedRoute(request, "pins:post", { schema: pinSchema }, async ({ supabase, user, data }) => {
    const error = data.pinned
      ? (await supabase.from("pinned_companies").upsert({ user_id: user.id, company_name: data.name })).error
      : (await supabase.from("pinned_companies").delete().eq("user_id", user.id).eq("company_name", data.name)).error;
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
