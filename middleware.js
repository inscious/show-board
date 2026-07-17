import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/* Single choke point: refreshes the Supabase session cookie on every request
   and sends anyone without a session to /login. Nothing else in the app is
   reachable unauthenticated. /signup is public too, but only actually usable
   when SELF_SIGNUP_ENABLED — see the dedicated check below, kept separate
   from this list since it needs an extra condition the others don't. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/signup"];

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
  // Vercel Cron has no user session — it authenticates with its own
  // Authorization: Bearer $CRON_SECRET check inside the route handler
  // (see app/api/cron/ojt-reminders/route.js). Without this bypass every
  // cron invocation gets redirected to /login before the route ever runs.
  const isCron = request.nextUrl.pathname.startsWith("/api/cron/");

  // self-signup is a feature that can be switched off entirely — bounce the
  // page server-side so a disabled flag never even flashes the form before
  // the client-side check (app/signup/page.jsx) would otherwise redirect it.
  if (request.nextUrl.pathname.startsWith("/signup") && !process.env.SELF_SIGNUP_ENABLED) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic && !isApiAuth && !isCron) {
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
  if (user && (isAdminPath || isApprenticeHome || isPendingPage)) {
    const { data: profile } = await supabase.from("profiles").select("is_admin, approved_at").eq("id", user.id).single();
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
