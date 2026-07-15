import { guardedRoute } from "@/lib/apiGuard";
import { showImportSchema } from "@/lib/schemas";

/* Bulk import from a pasted union sheet — admin-only, capped at 500 rows
   per request by showImportSchema. */
export async function POST(request) {
  return guardedRoute(
    request,
    "shows:import",
    { schema: showImportSchema, requireAdmin: true, rateLimit: { max: 10, windowSeconds: 60 } },
    async ({ supabase, user, data }) => {
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
        created_by: user.id,
      }));
      const { error } = await supabase.from("shows").upsert(rows);
      if (error) return Response.json({ error: "Could not import" }, { status: 400 });

      // one notification per apprentice, not per show — a 40-row import shouldn't spam 40 alerts
      const { data: apprentices } = await supabase.from("profiles").select("id").eq("is_admin", false);
      if (apprentices?.length) {
        await supabase.from("notifications").insert(apprentices.map((a, i) => ({
          id: "ni" + Date.now().toString(36) + i, user_id: a.id, type: "schedule",
          message: `Schedule updated: ${rows.length} show${rows.length === 1 ? "" : "s"} added`,
        })));
      }

      return Response.json({ ok: true, count: rows.length });
    }
  );
}
