import { guardedRoute } from "@/lib/apiGuard";
import { certSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/* Apprentice self-reporting a certification they already hold — picked from
   the COMMON_CERTS starter list (lib/core.ts), not free text. Separate from
   the official admin-entered record (app/api/admin/certs) the training
   center cross-checks against — same table, two ways in, same reasoning
   and same RLS workaround as app/api/completed-classes: certifications only
   has an "own rows" SELECT policy for apprentices, no self-write policy,
   and this repo has no DB migration tooling available to add one. Routes
   through the service-role admin client instead; the userId is taken from
   the authenticated session, never the request body, so this can only ever
   touch the caller's own rows.

   id is reused (not freshly generated) when the apprentice already has a
   row for this cert name, so re-picking an expired cert with a new date
   updates it in place instead of leaving a stale duplicate — the id is
   resolved client-side from the apprentice's own already-loaded cert list. */
export async function POST(request) {
  return guardedRoute(request, "certs:post", { schema: certSchema }, async ({ user, data }) => {
    const admin = createAdminClient();
    const { error } = await admin.from("certifications").upsert({
      id: data.id,
      user_id: user.id,
      name: data.name,
      exp: data.exp,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
