import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* Cross-tenant account search for the Platform Console — same
   platform_admins-gated + service-role pattern as /api/console/set-roles
   (not guardedRoute's requireAdmin, which checks profiles.is_admin — a
   platform admin has no profiles row at all). Empty query returns nothing
   rather than dumping every account platform-wide; this is a search, not
   a browse. Capped at 50 results.

   The platform_admin check runs concurrently with the search query itself
   (not blocking ahead of it) — same reasoning as /api/console/metrics: an
   unauthorized caller costs one wasted query, an authorized one saves a
   full round-trip of real network latency to Supabase. */
export async function GET(request) {
  return guardedRoute(request, "console:accounts:get", { rateLimit: { max: 60, windowSeconds: 60 } }, async ({ supabase, user }) => {
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (!q) return Response.json({ ok: true, accounts: [] });

    const admin = createAdminClient();
    const like = "%" + q.replace(/[%_]/g, "") + "%";
    const [{ data: platformAdmin }, { data: profiles, error }] = await Promise.all([
      supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle(),
      admin
        .from("profiles")
        .select("id, email, name, member_id, local, is_admin, is_central_admin, foreman_of_company_id, graduated_at, organization_id, do_not_hire_at, archived_at, avatar_url")
        .or(`name.ilike.${like},email.ilike.${like},member_id.ilike.${like}`)
        .order("name", { ascending: true })
        .limit(50),
    ]);
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });
    if (error) return Response.json({ error: "Search failed" }, { status: 400 });

    const orgIds = [...new Set((profiles || []).map((p) => p.organization_id).filter(Boolean))];
    let orgsById = {};
    if (orgIds.length) {
      const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds);
      orgsById = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));
    }

    const accounts = (profiles || []).map((p) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      memberId: p.member_id,
      local: p.local,
      isAdmin: p.is_admin,
      isCentralAdmin: p.is_central_admin,
      isForeman: !!p.foreman_of_company_id,
      isCJ: !!p.graduated_at,
      orgName: orgsById[p.organization_id] || null,
      doNotHire: !!p.do_not_hire_at,
      archived: !!p.archived_at,
      avatarUrl: p.avatar_url,
    }));

    return Response.json({ ok: true, accounts });
  });
}
