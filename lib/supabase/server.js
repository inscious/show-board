/* Server-side Supabase client for Server Components, Route Handlers and Server
   Actions. Cookie-backed session — always runs as the signed-in user, so RLS
   applies exactly as it would for a direct browser call. */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component render — middleware refreshes the
               session cookie on every request, so this is safe to ignore */
          }
        },
      },
    }
  );
}
