import { createClient } from "@/lib/supabase/server";

/* Public, unauthenticated by design — app/login/page.jsx needs this before
   any session exists to decide whether to show "Create an account" at all.
   RLS's "anyone can read" policy on app_settings is what actually allows
   this; there's nothing sensitive in a single boolean. */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("self_signup_enabled").eq("id", 1).single();
  return Response.json({ enabled: !!data?.self_signup_enabled });
}
