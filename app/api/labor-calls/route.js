import { guardedRoute } from "@/lib/apiGuard";
import { laborCallSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/notify";

/* Posting a labor call — not an admin action, any apprentice/CJ with
   foreman_of_company_id set for this company can do it. Not gated by
   guardedRoute's requireAdmin (that checks profiles.is_admin, unrelated to
   foreman status); checked here against the caller's own foreman grant.
   RLS's "foreman can post" policy is the real enforcement — this check is
   just so a non-foreman gets a real error instead of a silent 0-row insert. */
export async function POST(request) {
  return guardedRoute(request, "labor-calls:post", { schema: laborCallSchema }, async ({ supabase, user, data }) => {
    const { data: me } = await supabase.from("profiles").select("foreman_of_company_id, organization_id").eq("id", user.id).maybeSingle();
    if (me?.foreman_of_company_id !== data.companyId) {
      return Response.json({ error: "You're not set up as a foreman for that company." }, { status: 403 });
    }

    const { data: call, error } = await supabase.from("labor_calls").insert({
      posted_by: user.id,
      company_id: data.companyId,
      show_id: data.showId || null,
      title: data.title || null,
      needed_count: data.neededCount,
      category: data.category || null,
      starts_at: data.startsAt,
    }).select("id").maybeSingle();
    if (error) return Response.json({ error: "Could not post the call" }, { status: 400 });

    // Best-effort notify — the call is visible to any approved member of
    // any union regardless (RLS's permissive "read open calls" policy,
    // deliberately unresolved-broader per platform_architecture_scoping),
    // but the actual ping only goes to the foreman's own union by default,
    // matching real practice (a Local 831 foreman calls Local 831 first).
    // Crosses beyond the caller's own row, so this needs the service-role
    // client, same as every other notification fan-out in this app.
    if (me.organization_id) {
      const admin = createAdminClient();
      const { data: recipients } = await admin
        .from("profiles")
        .select("id")
        .eq("organization_id", me.organization_id)
        .eq("is_admin", false)
        .is("archived_at", null)
        .not("approved_at", "is", null)
        .neq("id", user.id);
      if (recipients?.length) {
        const title = data.title || "Labor call";
        await notifyUsers(admin, {
          type: "labor_call", idPrefix: "lc",
          rows: recipients.map((r) => ({
            userId: r.id,
            message: `New labor call posted — ${data.neededCount} needed`,
            emailSubject: "New labor call — " + data.neededCount + " needed",
            emailHtml: `<p><strong>${title}</strong> — ${data.neededCount} needed.</p><p>Open the app to respond.</p>`,
          })),
        });
      }
    }

    return Response.json({ ok: true, id: call?.id });
  });
}
