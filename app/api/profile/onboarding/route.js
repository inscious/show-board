import { guardedRoute } from "@/lib/apiGuard";
import { profileOnboardingSchema } from "@/lib/schemas";

/* Self-service — an apprentice's own local/joined-date/home city/phone/
   notification prefs. Originally just the /pending onboarding fields; phone
   was added later (labor-call feature, so a foreman can text/call a
   responder) and reuses this same route since it's the same "update my own
   optional profile fields, anytime" shape — not onboarding-only despite the
   route name. Same self-scoped shape as app/api/profile/welcomed (no
   requireAdmin, RLS's "own profile" policy is what actually allows this).
   local/joined/city/phone are blank-clears-on-omit (a real "clear this
   field" UI action); notifyEmail/notifySms are booleans, where an absent
   field must mean "unchanged," not "turn off" — the AccountCard toggles are
   the only real callers of those two, but /pending's profile form (also
   this route) never sends them, and a blank boolean silently opting
   everyone out of email the first time they save their city would be a bad
   surprise. Zod's .optional() (no .default()) makes an absent field
   `undefined`, and Supabase's update() drops undefined keys from the
   request body entirely (JSON.stringify strips them) — so omitting them
   here really does leave the column untouched, not null. */
export async function POST(request) {
  return guardedRoute(request, "profile:onboarding", { schema: profileOnboardingSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("profiles").update({
      local: data.local || null,
      joined_on: data.joined || null,
      city: data.city || null,
      phone: data.phone || null,
      notify_email: data.notifyEmail,
      notify_sms: data.notifySms,
    }).eq("id", user.id);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
