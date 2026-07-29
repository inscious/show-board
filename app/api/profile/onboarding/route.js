import { guardedRoute } from "@/lib/apiGuard";
import { profileOnboardingSchema } from "@/lib/schemas";

/* Self-service — an apprentice's own local/joined-date/home city/phone.
   Originally just the /pending onboarding fields; phone was added later
   (labor-call feature, so a foreman can text/call a responder) and reuses
   this same route since it's the same "update my own optional profile
   fields, anytime" shape — not onboarding-only despite the route name.
   Same self-scoped shape as app/api/profile/welcomed (no requireAdmin,
   RLS's "own profile" policy is what actually allows this). Every field is
   optional; a blank field clears it rather than being rejected. */
export async function POST(request) {
  return guardedRoute(request, "profile:onboarding", { schema: profileOnboardingSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("profiles").update({
      local: data.local || null,
      joined_on: data.joined || null,
      city: data.city || null,
      phone: data.phone || null,
    }).eq("id", user.id);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
