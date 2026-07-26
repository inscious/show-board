import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/* Single choke point: refreshes the Supabase session cookie on every request
   and sends anyone without a session to /login. Nothing else in the app is
   reachable unauthenticated. /signup is public too, but only actually usable
   when app_settings.self_signup_enabled is true — see the dedicated check
   below, kept separate from this list since it needs an extra condition the
   others don't, and specifically scoped to /signup requests only so this
   doesn't add a DB read to every single navigation. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/signup", "/portfolio"];

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  const isApiAuth = request.nextUrl.pathname.startsWith("/api/auth/");
  // deliberately unauthenticated by design (see each route's own comment) —
  // the login page fetches these before any session exists (self-signup to
  // decide whether to show "Create an account", org-profile for the real
  // union name in the header). Without this bypass every logged-out request
  // got redirected to /login instead of the JSON it expected, so the fetch
  // silently failed and the login page fell back to its static defaults.
  const isPublicSettings = ["/api/settings/self-signup", "/api/settings/org-profile"].includes(request.nextUrl.pathname);
  // the shared-portfolio page (app/portfolio/[token]/page.jsx) fetches this
  // itself, signed out, from a hiring manager's browser with no session at
  // all — see app/api/portfolio/shared/[token]/route.js for the route's own
  // hand-rolled auth (there is none; it's public by design, scoped by an
  // unguessable share_token instead).
  const isPublicPortfolio = request.nextUrl.pathname.startsWith("/api/portfolio/shared/");
  // Vercel Cron has no user session — it authenticates with its own
  // Authorization: Bearer $CRON_SECRET check inside the route handler
  // (see app/api/cron/ojt-reminders/route.js). Without this bypass every
  // cron invocation gets redirected to /login before the route ever runs.
  const isCron = request.nextUrl.pathname.startsWith("/api/cron/");

  // self-signup is a live admin toggle (Settings → Apprentice Sign-Up), not
  // a build-time flag — bounce the page server-side, before it ever renders,
  // so a disabled flag never flashes the form first.
  if (request.nextUrl.pathname.startsWith("/signup")) {
    const { data: settings, error: settingsError } = await supabase.from("app_settings").select("self_signup_enabled").eq("id", 1).single();
    // same reasoning as the profile read below: a transient error isn't
    // "the toggle is off," so don't bounce a real signup on a network blip.
    if (!settingsError && !settings?.self_signup_enabled) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isPublic && !isApiAuth && !isCron && !isPublicSettings && !isPublicPortfolio) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  /* admin vs. apprentice landing, and the pending-approval gate — resolved
     here, server-side, before any page ever renders, so signing in never
     flashes the wrong screen first (a client-side redirect-after-load would
     show the real dashboard for a beat before bouncing to /pending, or vice
     versa). A pending (self-signed-up, not yet admin-approved) account can
     only ever land on /pending — everything else routes them back there. */
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isApprenticeHome = request.nextUrl.pathname === "/";
  const isPendingPage = request.nextUrl.pathname === "/pending";
  const isConsolePath = request.nextUrl.pathname.startsWith("/console");
  if (user && (isAdminPath || isApprenticeHome || isPendingPage || isConsolePath)) {
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin, approved_at").eq("id", user.id).single();
    // a transient read failure here (network blip, connection timeout) used
    // to silently read as "no profile" -> not admin, not approved -> bounce
    // a real admin to /pending. Every signed-in user has a profile row EXCEPT
    // a platform admin (handle_new_user() deliberately skips creating one for
    // them, see supabase/stage1_staging.sql) — so a missing-row error is now
    // ambiguous between "genuine platform admin" and "real infra blip," and
    // this is the one place that distinguishes them. Ordinary apprentice/
    // admin requests never pay this extra lookup — only ones that would
    // already have hit this branch do.
    if (profileError) {
      const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
      if (platformAdmin) {
        if (!isConsolePath) {
          const url = request.nextUrl.clone();
          url.pathname = "/console";
          return NextResponse.redirect(url);
        }
        return response;
      }
      // not a platform admin either — real infra blip, don't guess.
      return response;
    }
    if (isConsolePath) {
      // has a real profiles row, so definitionally not a platform admin.
      const url = request.nextUrl.clone();
      url.pathname = profile?.is_admin ? "/admin" : "/";
      return NextResponse.redirect(url);
    }
    const isAdmin = !!profile?.is_admin;
    // admins are never subject to this gate regardless of approved_at —
    // belt-and-suspenders alongside create-admin/apprentices always
    // stamping it, in case some future account-creation path forgets to.
    const isApproved = isAdmin || !!profile?.approved_at;

    if (!isApproved && !isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
    if (isApproved && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = isAdmin ? "/admin" : "/";
      return NextResponse.redirect(url);
    }
    if (isAdminPath && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (isApprenticeHome && isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /* run on everything except static assets and the PWA manifest/icons */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png).*)",
  ],
};
