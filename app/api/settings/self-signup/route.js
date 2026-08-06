import { createClient } from "@/lib/supabase/server";
import { INTERIM_PREAUTH_ORGANIZATION_ID } from "@/lib/core";

/* Public, unauthenticated by design — app/login/page.jsx needs this before
   any session exists to decide whether to show "Create an account" at all.
   RLS's "public read pilot org" policy on app_settings is what actually
   allows this (supabase/stage7_app_settings_org_scoping.sql) — scoped to
   INTERIM_PREAUTH_ORGANIZATION_ID specifically, not every org, since
   there's no way yet to know which union an unauthenticated visitor
   belongs to. Nothing sensitive in a single boolean either way. */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("self_signup_enabled").eq("organization_id", INTERIM_PREAUTH_ORGANIZATION_ID).single();
  return Response.json({ enabled: !!data?.self_signup_enabled });
}
