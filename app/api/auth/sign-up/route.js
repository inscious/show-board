import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

/* Self-signup — gated behind SELF_SIGNUP_ENABLED so this whole surface can be
   turned off with one env var and the app reverts to admin-provisioned-only
   accounts (see app/api/admin/apprentices/route.js), exactly as it worked
   before this route existed. Unauthenticated by definition (nobody has a
   session yet), same category as request-link/sign-in — own rate limit and
   validation here, no guardedRoute.

   Doesn't touch profiles directly: handle_new_user() (supabase/schema.sql)
   reads name out of the signUp() metadata at row-creation time instead.
   approved_at is left null by that same trigger; that's the whole point of
   this account existing in a not-yet-real state until an admin approves it.

   Confirmed live (2026-07): this project's Supabase Auth has "Confirm
   email" OFF, so signUp() returns an active session immediately — the
   emailRedirectTo below and app/auth/callback/route.js exist for if that
   ever gets turned on, but right now they're unused. app/signup/page.jsx
   navigates straight to "/" after this call for that reason. If you flip
   confirmation on in the Supabase dashboard, that page needs a "check your
   email" step instead, or new signups will silently bounce to /login. */
const MAX_BODY_BYTES = 2_000;
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(200).optional(),
});

export async function POST(request) {
  if (!process.env.SELF_SIGNUP_ENABLED) {
    return Response.json({ error: "Self-signup isn't open right now." }, { status: 403 });
  }

  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let json;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email and an 8+ character password" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const supabase = createClient();
  const ip = clientIp(request);

  // tighter than sign-in/request-link on purpose — this is the one
  // unauthenticated route that creates real, durable state (an account),
  // not just sends an email. Still needs enough headroom for a group of
  // apprentices signing up from the same union-hall/house wifi within the
  // same hour, so this isn't per-person. Local 831's roster is finite, not
  // a public app, so a generous ceiling here doesn't meaningfully open the
  // door to abuse the way it might for a public-signup product.
  const ok = await checkRateLimit(supabase, `auth:sign-up:${ip}`, 30, 60 * 60);
  if (!ok) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: name ? { name } : undefined,
    },
  });

  if (error) {
    return Response.json({ error: error.message || "Couldn't create that account" }, { status: 400 });
  }

  // self-signup already collects a real password as part of this same form —
  // handle_new_user() doesn't know that, so it leaves has_password at its
  // default false, which would wrongly show the "set a password" nudge to
  // someone who already has one. Admin-created accounts set this themselves
  // (see app/api/admin/apprentices/route.js) since admin hands out that
  // password directly; this is the self-signup equivalent of that same stamp.
  if (signUpData?.user) {
    await supabase.from("profiles").update({ has_password: true }).eq("id", signUpData.user.id);
  }

  return Response.json({ ok: true });
}
