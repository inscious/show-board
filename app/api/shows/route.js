import { guardedRoute } from "@/lib/apiGuard";
import { showSchema, showDeleteSchema } from "@/lib/schemas";
import { notifyUsers } from "@/lib/notify";

/* Admin-only: the shared show schedule. RLS on `shows` also restricts
   insert/update/delete to is_admin — this check is belt-and-suspenders. */
export async function POST(request) {
  // higher than the default 30/60s — same reasoning as app/api/show-flags:
  // a full-catalog resync can legitimately touch every show in one pass.
  return guardedRoute(request, "shows:post", { schema: showSchema, requireAdmin: true, rateLimit: { max: 200, windowSeconds: 60 } }, async ({ supabase, user, profile, data }) => {
    const { error } = await supabase.from("shows").upsert({
      id: data.id,
      name: data.name,
      move_in: data.mi || null,
      starts_on: data.start || null,
      ends_on: data.end || null,
      location: data.loc || null,
      booth: data.booth || null,
      gc: data.co || null,
      region: data.region || null,
      source: data.src || "user",
      sheet_month: data.sheetMonth || null,
      created_by: user.id,
      organization_id: profile.organization_id,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });

    // best-effort broadcast — the shared schedule changed, every apprentice gets a heads-up.
    // Scoped to the admin's own org — was missing before (pre-existing bug,
    // fixed here since it's this exact query): without it, every union on
    // the platform notified every other union's apprentices on any edit.
    const { data: apprentices } = await supabase.from("profiles").select("id")
      .eq("is_admin", false).eq("organization_id", profile.organization_id);
    if (apprentices?.length) {
      await notifyUsers(supabase, {
        type: "schedule", idPrefix: "ns",
        rows: apprentices.map((a) => ({
          userId: a.id,
          message: `Schedule updated: ${data.name}`,
          emailSubject: "Schedule updated — " + data.name,
          emailHtml: `<p>The show schedule was updated: <strong>${data.name}</strong>.</p><p>Check the Board tab for details.</p>`,
        })),
      });
    }

    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "shows:delete", { schema: showDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("shows").delete().eq("id", data.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
