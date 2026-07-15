import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 2_000; // an email + password, nothing more
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

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
    return Response.json({ error: "Enter your email and password" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const supabase = createClient();
  const ip = clientIp(request);

  // 20 attempts / 15 minutes, keyed on email+IP together — the brute-force
  // guard a password ties to a real credential needs, that a magic link doesn't.
  const ok = await checkRateLimit(supabase, `auth:sign-in:${email}:${ip}`, 20, 15 * 60);
  if (!ok) {
    return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return Response.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
