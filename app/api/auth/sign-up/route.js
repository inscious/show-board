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
   reads name out of the signUp() metadata at row-creation time, since email
   confirmation being required means there's no active session — and so no
   RLS-scoped moment — right after this call returns. approved_at is left
   null by that same trigger; that's the whole point of this account existing
   in a not-yet-real state until an admin approves it. */
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
  // not just sends an email.
  const ok = await checkRateLimit(supabase, `auth:sign-up:${ip}`, 5, 60 * 60);
  if (!ok) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.signUp({
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

  return Response.json({ ok: true });
}
