import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* Platform-wide counts for the Organizations page's stats strip. profiles
   has no is_platform_admin() read policy (only own-row and org-scoped admin
   reads), so a plain client-side count from a platform admin's session
   would return zero — needs the service-role client, same pattern as the
   other console routes. head:true + count:"exact" avoids pulling any rows
   back, just the counts. */
export async function GET(request) {
  return guardedRoute(request, "console:metrics:get", { rateLimit: { max: 30, windowSeconds: 60 } }, async ({ supabase, user }) => {
    const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const admin = createAdminClient();
    const [{ count: accounts }, { count: platformAdmins }, { count: organizations }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("platform_admins").select("id", { count: "exact", head: true }),
      admin.from("organizations").select("id", { count: "exact", head: true }),
    ]);

    return Response.json({ ok: true, accounts: accounts ?? 0, platformAdmins: platformAdmins ?? 0, organizations: organizations ?? 0 });
  });
}
