import { createClient } from "@/lib/supabase/server";
import { UNION_NAME, UNION_LINE, UNION_LINE_PRETTY, JATC } from "@/lib/core";

/* Public read, same reasoning as app/api/settings/self-signup — RLS's
   "anyone can read" policy on app_settings already allows this. Used by
   the admin Settings panel to prefill its edit form; the apprentice-facing
   app gets this same data as part of the main store.ts load() instead
   (avoids a second round-trip there), so this route's only real consumer
   is the admin panel. Falls back to lib/core.ts's defaults for any field
   not yet set. */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("org_profile").eq("id", 1).single();
  const p = data?.org_profile || {};
  return Response.json({
    unionName: p.unionName || UNION_NAME,
    outOfWorkLine: p.outOfWorkLine || UNION_LINE,
    outOfWorkLinePretty: p.outOfWorkLinePretty || UNION_LINE_PRETTY,
    jatcOfficeAddress: p.jatcOfficeAddress || JATC.office,
  });
}
