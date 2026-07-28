import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { LEVELS, ojtTotals, levelIndex } from "@/lib/core";

/* The one public, unauthenticated route in this whole feature — see the
   plan's §3. Deliberately NOT a public RLS policy: every other table here
   stays "own rows only," and this route alone reads through the service-role
   client, by share_token, returning a narrow hand-picked shape. Token can
   match either portfolio_settings (whole portfolio) or portfolio_projects
   (a single project) — checked in that order since a whole-portfolio link
   is the more common case.

   Never returns email, member_id, ssn_last4, or anything off `profiles`
   beyond what's explicitly picked below — see the plan's "professional
   identity" principle: credential context (level/years/local/certs), not a
   full profile dump. */

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function credentialContext(admin, userId) {
  const { data: profile } = await admin.from("profiles").select("name, local, joined_on").eq("id", userId).single();
  const { data: monthRows } = await admin.from("ojt_months").select("cat_a, cat_b, cat_c, cat_d").eq("user_id", userId).eq("status", "approved");
  const { data: certifications } = await admin.from("certifications").select("name, exp").eq("user_id", userId).order("exp", { ascending: false });

  const months = (monthRows || []).map((m) => ({ a: Number(m.cat_a), b: Number(m.cat_b), c: Number(m.cat_c), d: Number(m.cat_d) }));
  const totals = ojtTotals(months);
  const idx = levelIndex(totals.total);
  const level = LEVELS[idx];
  const isCJ = level?.k === "CJ";

  const firstName = (profile?.name || "").trim().split(/\s+/).filter(Boolean)[0] || "This apprentice";
  const years = profile?.joined_on
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.joined_on).getTime()) / (365.25 * 24 * 3600 * 1000)))
    : null;

  return {
    displayName: profile?.name || firstName,
    firstName,
    local: profile?.local || null,
    levelLabel: isCJ ? "Certified Journeyperson" : level?.label || null,
    isCJ,
    yearsInTrade: years,
    certifications: (certifications || []).map((c) => ({ name: c.name, exp: c.exp })),
  };
}

async function projectPayload(admin, project) {
  const { data: days } = await admin
    .from("portfolio_project_days")
    .select("work_type, work_entries(worked_on, company)")
    .eq("project_id", project.id);

  const { data: photos } = await admin
    .from("portfolio_project_photos")
    .select("id, storage_path, caption, sort_order")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const signedPhotos = [];
  for (const p of photos || []) {
    const { data: signed } = await admin.storage.from("portfolio").createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) signedPhotos.push({ id: p.id, url: signed.signedUrl, caption: p.caption });
  }

  return {
    id: project.id,
    title: project.title,
    notes: project.notes,
    section: project.section || null,
    location: project.location || null,
    days: (days || []).map((d) => ({
      workType: d.work_type,
      date: d.work_entries?.worked_on || null,
      company: d.work_entries?.company || null,
    })).sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    photos: signedPhotos,
  };
}

export async function GET(request, { params }) {
  const token = params?.token;
  if (!token || !TOKEN_RE.test(token)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const ip = clientIp(request);
  const ok = await checkRateLimit(supabase, `api:portfolio:shared:${ip}`, 60, 3600);
  if (!ok) {
    return Response.json({ error: "Too many requests. Try again in a bit." }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("portfolio_settings")
    .select("user_id, display_name, bio, contact_email, contact_phone")
    .eq("share_token", token)
    .maybeSingle();

  if (settings) {
    const context = await credentialContext(admin, settings.user_id);
    const { data: projects } = await admin
      .from("portfolio_projects")
      .select("id, title, notes, section, location")
      .eq("user_id", settings.user_id)
      .eq("include_in_portfolio", true)
      .order("sort_order", { ascending: true });

    const payload = [];
    for (const p of projects || []) payload.push(await projectPayload(admin, p));

    return Response.json({
      ok: true,
      scope: "portfolio",
      displayName: settings.display_name || context.displayName,
      bio: settings.bio || null,
      contactEmail: settings.contact_email || null,
      contactPhone: settings.contact_phone || null,
      credentials: context,
      projects: payload,
    });
  }

  const { data: project } = await admin.from("portfolio_projects").select("id, title, notes, section, location, user_id").eq("share_token", token).maybeSingle();
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const context = await credentialContext(admin, project.user_id);
  const payload = await projectPayload(admin, project);
  // a per-project share link has no settings row of its own to source
  // contact info from — fall back to the owner's whole-portfolio settings,
  // if they've set any, so a hiring manager who only got one project link
  // can still reach out.
  const { data: ownerSettings } = await admin
    .from("portfolio_settings")
    .select("contact_email, contact_phone")
    .eq("user_id", project.user_id)
    .maybeSingle();

  return Response.json({
    ok: true,
    scope: "project",
    displayName: context.displayName,
    bio: null,
    contactEmail: ownerSettings?.contact_email || null,
    contactPhone: ownerSettings?.contact_phone || null,
    credentials: context,
    projects: [payload],
  });
}
