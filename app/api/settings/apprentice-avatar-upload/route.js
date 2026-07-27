import { createClient } from "@/lib/supabase/server";

/* Public read, same reasoning as app/api/settings/self-signup — RLS's
   "anyone can read" policy on app_settings already allows this, and the
   apprentice-side upload control needs to know before rendering whether
   to show an upload affordance at all. */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("apprentice_avatar_upload_enabled").eq("id", 1).single();
  return Response.json({ enabled: !!data?.apprentice_avatar_upload_enabled });
}
