import { guardedRoute } from "@/lib/apiGuard";
import { showImportSchema } from "@/lib/schemas";
import { notifyUsers } from "@/lib/notify";

/* Bulk import from a pasted union sheet — admin-only, capped at 500 rows
   per request by showImportSchema. */
export async function POST(request) {
  return guardedRoute(
    request,
    "shows:import",
    { schema: showImportSchema, requireAdmin: true, rateLimit: { max: 10, windowSeconds: 60 } },
    async ({ supabase, user, profile, data }) => {
      const rows = data.shows.map((s) => ({
        id: s.id,
        name: s.name,
        move_in: s.mi || null,
        starts_on: s.start || null,
        ends_on: s.end || null,
        location: s.loc || null,
        booth: s.booth || null,
        gc: s.co || null,
        region: s.region || null,
        source: s.src || "union",
        sheet_month: s.sheetMonth || null,
        created_by: user.id,
        organization_id: profile.organization_id,
      }));
      const { error } = await supabase.from("shows").upsert(rows);
      if (error) return Response.json({ error: "Could not import" }, { status: 400 });

      // one notification per apprentice, not per show — a 40-row import shouldn't spam 40 alerts.
      // Scoped to the admin's own org — same pre-existing cross-org leak fixed in app/api/shows.
      const { data: apprentices } = await supabase.from("profiles").select("id")
        .eq("is_admin", false).eq("organization_id", profile.organization_id);
      if (apprentices?.length) {
        const summary = `${rows.length} show${rows.length === 1 ? "" : "s"} added`;
        await notifyUsers(supabase, {
          type: "schedule", idPrefix: "ni",
          rows: apprentices.map((a) => ({
            userId: a.id,
            message: `Schedule updated: ${summary}`,
            emailSubject: "Schedule updated — " + summary,
            emailHtml: `<p>The show schedule was updated: <strong>${summary}</strong>.</p><p>Check the Board tab for details.</p>`,
          })),
        });
      }

      return Response.json({ ok: true, count: rows.length });
    }
  );
}
