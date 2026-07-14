import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/* Single choke point: refreshes the Supabase session cookie on every request
   and sends anyone without a session to /login. Nothing else in the app is
   reachable unauthenticated. */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

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

  if (!user && !isPublic && !isApiAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  /* admin vs. apprentice landing — resolved here, server-side, before any
     page ever renders, so signing in never flashes the wrong dashboard
     first (a client-side redirect-after-load would show the apprentice
     board for a beat before bouncing an admin over to /admin). */
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isApprenticeHome = request.nextUrl.pathname === "/";
  if (user && (isAdminPath || isApprenticeHome)) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = !!profile?.is_admin;
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
