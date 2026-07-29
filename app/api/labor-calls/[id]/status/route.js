import { guardedRoute } from "@/lib/apiGuard";
import { laborCallStatusSchema } from "@/lib/schemas";

/* Foreman closing out their own call as filled or cancelled. The existing
   "foreman can update own calls" RLS policy (posted_by = auth.uid()) would
   technically allow this via a raw client call, but every other mutation in
   this app goes through guardedRoute for schema validation + rate limiting,
   so this does too rather than being a one-off exception. */
export async function POST(request, { params }) {
  return guardedRoute(request, "labor-calls:status", { schema: laborCallStatusSchema }, async ({ supabase, data }) => {
    const callId = Number(params?.id);
    if (!callId) return Response.json({ error: "Missing id" }, { status: 400 });

    // RLS silently no-ops an update to a call that isn't the caller's own
    // (posted_by = auth.uid()) rather than erroring — .select() after the
    // update is what surfaces that as a real 404 instead of a false-success 200.
    const { data: updated, error } = await supabase.from("labor_calls").update({ status: data.status }).eq("id", callId).select("id").maybeSingle();
    if (error) return Response.json({ error: "Could not update the call" }, { status: 400 });
    if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({ ok: true });
  });
}
