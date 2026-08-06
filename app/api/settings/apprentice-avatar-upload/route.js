import { createClient } from "@/lib/supabase/server";

/* Authenticated read, own org — AvatarUpload.jsx only renders for a
   signed-in apprentice. RLS's "read own org" policy
   (supabase/stage7_app_settings_org_scoping.sql) narrows the table to
   exactly the caller's own org's row, so no explicit organization_id
   filter is needed — same reasoning as lib/store.ts's own app_settings
   read. Needs to know before rendering whether to show an upload
   affordance at all. */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ enabled: false });
  const { data } = await supabase.from("app_settings").select("apprentice_avatar_upload_enabled").single();
  return Response.json({ enabled: !!data?.apprentice_avatar_upload_enabled });
}
