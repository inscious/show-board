import { guardedRoute } from "@/lib/apiGuard";
import { adminProfileSchema } from "@/lib/schemas";

/* admin editing another apprentice's profile — RLS's "admin update all" policy
   on profiles (supabase/schema.sql) is what actually allows this; requireAdmin
   here is belt-and-suspenders, same pattern as app/api/shows/route.js. */
export async function POST(request) {
  return guardedRoute(request, "admin:profile", { schema: adminProfileSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("profiles").update({
      name: data.name || null,
      member_id: data.memberId || null,
      ssn_last4: data.last4 || null,
      local: data.local || null,
      joined_on: data.joined || null,
      rsi_credits: data.rsiCredits ?? null,
    }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
