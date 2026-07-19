import { guardedRoute } from "@/lib/apiGuard";
import { entryBulkSchema } from "@/lib/schemas";
import { entrySplit } from "@/lib/core";

/* Bulk write side of the OJT-slip calendar backfill — app/api/ojt-months/
   extract already reads a scanned slip for its monthly A/B/C/D totals; when
   the slip also shows a real day-by-day breakdown (the actual union form
   has DATE/A/B/C/D/COMPANY columns, not just a monthly sum), the apprentice
   can review those rows too and land them here as normal work_entries —
   same "flat hours entry assumes an 8:00am start" convention as a manual
   Log Today entry (see entrySplit), just extracted from a photo instead of
   typed by hand. One batched upsert instead of N single-entry requests,
   same reasoning as ojt-months/bulk.

   This bypasses the local-first store's diff/sync entirely on purpose: that
   mechanism is built for incrementally-edited entries changing over time,
   not a one-shot batch of 20-60 new rows. The caller merges the returned
   rows into local state itself so the calendar reflects them immediately;
   the next regular sync cycle re-upserting the same ids is harmless. */
export async function POST(request) {
  return guardedRoute(request, "entries:bulk", { schema: entryBulkSchema, rateLimit: { max: 5, windowSeconds: 60 } }, async ({ supabase, user, data: rows }) => {
    const payload = rows.map((r, i) => {
      const sp = entrySplit(r.dayKey, { hrs: r.hrs });
      return {
        id: "eimp" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5),
        user_id: user.id,
        worked_on: r.dayKey,
        company: r.co,
        category: r.cat,
        hours: sp.clock,
        st_hours: sp.st,
        ot_hours: sp.ot,
        dt_hours: sp.dt,
      };
    });

    const { error } = await supabase.from("work_entries").upsert(payload);
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });

    return Response.json({
      ok: true,
      entries: payload.map((p, i) => ({ id: p.id, dayKey: p.worked_on, co: p.company, cat: p.category, hrs: rows[i].hrs })),
    });
  });
}
