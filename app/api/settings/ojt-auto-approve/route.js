import { createClient } from "@/lib/supabase/server";

/* Authenticated read, own org — every real caller (MonthForm, OjtImportFlow,
   OjtAutoApprovePanel, /pending) already has a session by the time it asks.
   RLS's "read own org" policy (supabase/stage7_app_settings_org_scoping.sql)
   narrows the table to exactly the caller's own org's row, so no explicit
   organization_id filter is needed here — same reasoning as lib/store.ts's
   own app_settings read. MonthForm/OjtImportFlow need to know before an
   apprentice submits whether their hours will be approved automatically (so
   they can be warned to double-check the numbers first, since there's no
   admin review backstop when this is on). */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ enabled: false });
  const { data } = await supabase.from("app_settings").select("ojt_auto_approve").single();
  return Response.json({ enabled: !!data?.ojt_auto_approve });
}
