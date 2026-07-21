import { guardedRoute } from "@/lib/apiGuard";
import { laborCallSchema } from "@/lib/schemas";

/* Posting a labor call — not an admin action, any apprentice/CJ with
   foreman_of_company_id set for this company can do it. Not gated by
   guardedRoute's requireAdmin (that checks profiles.is_admin, unrelated to
   foreman status); checked here against the caller's own foreman grant.
   RLS's "foreman can post" policy is the real enforcement — this check is
   just so a non-foreman gets a real error instead of a silent 0-row insert. */
export async function POST(request) {
  return guardedRoute(request, "labor-calls:post", { schema: laborCallSchema }, async ({ supabase, user, data }) => {
    const { data: me } = await supabase.from("profiles").select("foreman_of_company_id").eq("id", user.id).maybeSingle();
    if (me?.foreman_of_company_id !== data.companyId) {
      return Response.json({ error: "You're not set up as a foreman for that company." }, { status: 403 });
    }

    const { error } = await supabase.from("labor_calls").insert({
      posted_by: user.id,
      company_id: data.companyId,
      show_id: data.showId || null,
      title: data.title || null,
      needed_count: data.neededCount,
      category: data.category || null,
      starts_at: data.startsAt,
    });
    if (error) return Response.json({ error: "Could not post the call" }, { status: 400 });

    return Response.json({ ok: true });
  });
}
