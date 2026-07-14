import { guardedRoute } from "@/lib/apiGuard";
import { showFlagSchema } from "@/lib/schemas";

export async function POST(request) {
  // higher than the default 30/60s — a full-season sync can legitimately touch
  // every show on the board in one pass (a fresh device, or the first sync
  // after the sync-state format changes), easily above 30 rows.
  return guardedRoute(request, "show-flags:post", { schema: showFlagSchema, rateLimit: { max: 200, windowSeconds: 60 } }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("show_flags").upsert({
      user_id: user.id,
      show_id: data.showId,
      status: data.status || null,
      note: data.note || null,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
