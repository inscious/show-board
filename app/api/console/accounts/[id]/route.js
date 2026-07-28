import { guardedRoute } from "@/lib/apiGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/* One account's detail for the Platform Console — same platform_admins-gated
   + service-role pattern as the sibling search route. Deliberately not a
   full data dump: enough to troubleshoot (identity, org, role flags, a
   light activity signal), not every row the account has ever touched. */
export async function GET(request, { params }) {
  return guardedRoute(request, "console:accounts:detail:get", { rateLimit: { max: 60, windowSeconds: 60 } }, async ({ supabase, user }) => {
    const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
    if (!platformAdmin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const id = params?.id;
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, email, name, member_id, ssn_last4, local, is_admin, is_central_admin, foreman_of_company_id, graduated_at, organization_id, do_not_hire_at, do_not_hire_reason, archived_at, approved_at, joined_on, avatar_url, has_password")
      .eq("id", id)
      .maybeSingle();
    if (error || !profile) return Response.json({ error: "Not found" }, { status: 404 });

    let orgName = null;
    if (profile.organization_id) {
      const { data: org } = await admin.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle();
      orgName = org?.name || null;
    }

    const { data: lastEntry } = await admin
      .from("work_entries")
      .select("worked_on, company")
      .eq("user_id", id)
      .order("worked_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastMonth } = await admin
      .from("ojt_months")
      .select("month, status")
      .eq("user_id", id)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();

    return Response.json({
      ok: true,
      account: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        memberId: profile.member_id,
        last4: profile.ssn_last4,
        local: profile.local,
        isAdmin: profile.is_admin,
        isCentralAdmin: profile.is_central_admin,
        foremanOfCompanyId: profile.foreman_of_company_id,
        graduatedAt: profile.graduated_at,
        orgId: profile.organization_id,
        orgName,
        doNotHireAt: profile.do_not_hire_at,
        doNotHireReason: profile.do_not_hire_reason,
        archivedAt: profile.archived_at,
        approvedAt: profile.approved_at,
        joinedOn: profile.joined_on,
        avatarUrl: profile.avatar_url,
        hasPassword: profile.has_password,
        lastWorkedOn: lastEntry?.worked_on || null,
        lastWorkedCompany: lastEntry?.company || null,
        lastOjtMonth: lastMonth?.month || null,
        lastOjtStatus: lastMonth?.status || null,
      },
    });
  });
}
