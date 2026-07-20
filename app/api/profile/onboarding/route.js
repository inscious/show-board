import { guardedRoute } from "@/lib/apiGuard";
import { profileOnboardingSchema } from "@/lib/schemas";

/* Self-service — an apprentice filling in their own local/joined-date/home
   city while on /pending, waiting on admin approval. Same self-scoped shape
   as app/api/profile/welcomed (no requireAdmin, RLS's "own profile" policy
   is what actually allows this). All three fields are optional; a blank
   field clears it rather than being rejected. */
export async function POST(request) {
  return guardedRoute(request, "profile:onboarding", { schema: profileOnboardingSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("profiles").update({
      local: data.local || null,
      joined_on: data.joined || null,
      city: data.city || null,
    }).eq("id", user.id);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
