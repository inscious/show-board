import { createClient } from "@/lib/supabase/server";

/* Public read, same reasoning as app/api/settings/self-signup — RLS's
   "anyone can read" policy on app_settings already allows this, and both
   MonthForm and OjtImportFlow need to know before an apprentice submits
   whether their hours will be approved automatically (so they can be
   warned to double-check the numbers first, since there's no admin
   review backstop when this is on). */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("ojt_auto_approve").eq("id", 1).single();
  return Response.json({ enabled: !!data?.ojt_auto_approve });
}
