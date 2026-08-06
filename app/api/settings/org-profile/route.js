import { createClient } from "@/lib/supabase/server";
import { UNION_NAME, UNION_LINE, UNION_LINE_PRETTY, JATC, INTERIM_PREAUTH_ORGANIZATION_ID } from "@/lib/core";

/* Mixed audience, unlike self-signup/ojt-auto-approve: app/login/page.jsx
   calls this pre-auth (no session at all), while the admin Settings panel
   and /pending call it authenticated. Authenticated callers get their own
   org via RLS's "read own org" policy (supabase/stage7_app_settings_org_scoping.sql,
   same as lib/store.ts's own read) with no explicit filter needed;
   unauthenticated callers fall back to INTERIM_PREAUTH_ORGANIZATION_ID —
   see that constant's own comment for why. Falls back to lib/core.ts's
   hardcoded defaults for any field not yet set, same as before. */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const query = supabase.from("app_settings").select("org_profile");
  const { data } = user ? await query.single() : await query.eq("organization_id", INTERIM_PREAUTH_ORGANIZATION_ID).single();
  const p = data?.org_profile || {};
  return Response.json({
    unionName: p.unionName || UNION_NAME,
    outOfWorkLine: p.outOfWorkLine || UNION_LINE,
    outOfWorkLinePretty: p.outOfWorkLinePretty || UNION_LINE_PRETTY,
    jatcOfficeAddress: p.jatcOfficeAddress || JATC.office,
  });
}
