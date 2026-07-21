import { guardedRoute } from "@/lib/apiGuard";
import { laborCallResponseSchema } from "@/lib/schemas";

/* A worker marking themselves available (or withdrawing) for a labor call.
   Not a commitment — the foreman still confirms directly, same as texting
   today. RLS's "own responses" policy already covers this; the upsert
   handles both the first response and changing your mind later. */
export async function POST(request) {
  return guardedRoute(request, "labor-calls:responses:post", { schema: laborCallResponseSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("labor_call_responses").upsert(
      { labor_call_id: data.laborCallId, user_id: user.id, status: data.status, responded_at: new Date().toISOString() },
      { onConflict: "labor_call_id,user_id" }
    );
    if (error) return Response.json({ error: "Could not save your response" }, { status: 400 });

    return Response.json({ ok: true });
  });
}
