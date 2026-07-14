import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 2_000; // an email address, nothing more
const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

const ALLOWED = new Set(
  (process.env.ALLOWED_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

export async function POST(request) {
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
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const { email } = parsed.data;

  const supabase = createClient();
  const ip = clientIp(request);

  // 5 attempts / 15 minutes, keyed on email+IP together so one never gates the other alone.
  const ok = await checkRateLimit(supabase, `auth:request-link:${email}:${ip}`, 5, 15 * 60);
  if (!ok) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  // Same response whether or not the email is allowed / has an account —
  // never confirm or deny which addresses are valid to an unauthenticated caller.
  if (ALLOWED.has(email)) {
    const origin = new URL(request.url).origin;
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
    });
  }

  return Response.json({ ok: true });
}
