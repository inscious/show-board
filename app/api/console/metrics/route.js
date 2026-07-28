import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* Platform-wide counts for the Organizations page's stats strip. profiles
   has no is_platform_admin() read policy (only own-row and org-scoped admin
   reads), so a plain client-side count from a platform admin's session
   would return zero — needs the service-role client, same pattern as the
   other console routes. head:true + count:"exact" avoids pulling any rows
   back, just the counts.

   The platform_admins authorization check runs concurrently with the three
   counts rather than blocking ahead of them — worst case an unauthorized
   caller costs a few wasted count queries (cheap, head-only), and the
   common authorized-caller path saves a full extra round-trip of latency,
   which is the actual bottleneck on real network latency to Supabase (this
   was noticeably slow before — every extra sequential round-trip is felt). */
export async function GET(request) {
  return guardedRoute(request, "console:metrics:get", { rateLimit: { max: 30, windowSeconds: 60 } }, async ({ supabase, user }) => {
    const admin = createAdminClient();
    const [{ data: platformAdmin }, { count: accounts }, { count: platformAdmins }, { count: organizations }] = await Promise.all([
      supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("platform_admins").select("id", { count: "exact", head: true }),
      admin.from("organizations").select("id", { count: "exact", head: true }),
    ]);
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    return Response.json({ ok: true, accounts: accounts ?? 0, platformAdmins: platformAdmins ?? 0, organizations: organizations ?? 0 });
  });
}
