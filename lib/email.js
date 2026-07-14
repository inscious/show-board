/* Minimal transactional-email sender via Resend's HTTP API — no SDK, just
   fetch. Separate from Supabase Auth's own emails (magic link, etc.), which
   go through the SMTP settings in the Supabase dashboard, not this file.

   Silently no-ops without RESEND_API_KEY set — a missing key should never
   break the action that triggered the email (e.g. a password change). */
const FROM = "Show Board <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
