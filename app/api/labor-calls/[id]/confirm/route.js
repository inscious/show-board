import { guardedRoute } from "@/lib/apiGuard";
import { laborCallConfirmSchema } from "@/lib/schemas";

/* Foreman marking one specific responder 'confirmed' after actually
   reaching them by phone/text — the "close the loop" step, kept as a
   plain response-status update rather than the app trying to manage real
   scheduling/booking itself (direct foreman-to-worker contact stays the
   default mechanism, see platform_architecture_scoping memory). RLS's
   "foreman can confirm responses to own calls" policy (stage3_labor_call_ui.sql)
   is the real enforcement — its WITH CHECK only allows setting status to
   'confirmed', so this can't be reused to touch available/withdrawn. */
export async function POST(request, { params }) {
  return guardedRoute(request, "labor-calls:confirm", { schema: laborCallConfirmSchema }, async ({ supabase, data }) => {
    const callId = Number(params?.id);
    if (!callId) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: updated, error } = await supabase
      .from("labor_call_responses")
      .update({ status: "confirmed" })
      .eq("labor_call_id", callId)
      .eq("user_id", data.userId)
      .select("labor_call_id")
      .maybeSingle();
    if (error) return Response.json({ error: "Could not confirm" }, { status: 400 });
    if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({ ok: true });
  });
}
