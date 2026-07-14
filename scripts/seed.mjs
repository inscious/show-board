/* One-off, local-only script — never deployed, never imported by the app.

   1. Pushes the shared SEED shows + COMPANIES directory from lib/core.js.
   2. Backfills YOUR historical data (lib/personal-data.js — gitignored, real
      values) into your own Supabase account: profile fields, OJT hours
      already on file, your rate override, bookings, classes.

   Step 2 needs your profiles row to already exist, which the handle_new_user
   trigger creates the first time you actually sign in — so sign in once via
   the app, THEN run this:

     npm run seed

   Uses the service-role key (bypasses RLS) because this is the only place
   that key is allowed to exist.
*/
// supabase-js always spins up a realtime (WebSocket) client, which needs
// Node 22's native WebSocket — this script only does plain REST calls, so a
// dev-only `ws` polyfill is enough; nothing here ships with the app.
if (!globalThis.WebSocket) {
  const { default: WebSocket } = await import("ws");
  globalThis.WebSocket = WebSocket;
}

import { createClient } from "@supabase/supabase-js";
import { SEED, COMPANIES } from "../lib/core.js";
import { APPRENTICE, CO_RATE_SEED, OJT_SEED, BOOKING_SEED, CLASS_SEED } from "../lib/personal-data.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.ALLOWED_EMAILS || "").split(",")[0]?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function seedShared() {
  const shows = SEED.map((s) => ({
    id: s.id, name: s.name, move_in: s.mi || null, starts_on: s.start || null,
    ends_on: s.end || null, location: s.loc || null, booth: s.booth || null,
    gc: s.co || null, region: s.region || null, source: s.src || "union",
  }));
  const { error: showsError } = await supabase.from("shows").upsert(shows);
  if (showsError) throw showsError;
  console.log(`Seeded ${shows.length} shows.`);

  const companies = COMPANIES.map((c) => ({
    name: c.n, city: c.city || null, state: c.st || null, labor_line: c.tel || null, foreman: c.fm || null,
  }));
  const { error: coError } = await supabase.from("companies").upsert(companies, { onConflict: "name" });
  if (coError) throw coError;
  console.log(`Seeded ${companies.length} companies.`);
}

async function seedPersonal() {
  if (!adminEmail) {
    console.log("No ALLOWED_EMAILS set — skipping personal data backfill.");
    return;
  }
  const { data: profile, error: findError } = await supabase
    .from("profiles").select("id").eq("email", adminEmail).maybeSingle();
  if (findError) throw findError;
  if (!profile) {
    console.log(`No profile yet for ${adminEmail} — sign in once via the app first, then re-run this script.`);
    return;
  }
  const userId = profile.id;

  await supabase.from("profiles").update({
    name: APPRENTICE.name, member_id: APPRENTICE.memberId, ssn_last4: APPRENTICE.last4,
    local: APPRENTICE.local, joined_on: APPRENTICE.joined, rsi_credits: APPRENTICE.rsi,
  }).eq("id", userId);

  await supabase.from("company_rates").upsert(
    Object.entries(CO_RATE_SEED).map(([company, pay_level]) => ({ user_id: userId, company, pay_level }))
  );

  await supabase.from("ojt_months").upsert(
    OJT_SEED.map((m) => ({ user_id: userId, month: m.m, cat_a: m.a, cat_b: m.b, cat_c: m.c, cat_d: m.d }))
  );

  await supabase.from("bookings").upsert(
    BOOKING_SEED.map((b) => ({ id: b.id, user_id: userId, company: b.co, show: b.show || null, note: b.note || null, dates: b.dates }))
  );

  await supabase.from("classes").upsert(
    CLASS_SEED.map((c) => ({ id: c.id, user_id: userId, name: c.name, start_min: c.start ?? null, location: c.loc || null, note: c.note || null, dates: c.dates }))
  );

  console.log(`Backfilled personal data for ${adminEmail}.`);
}

async function main() {
  await seedShared();
  await seedPersonal();
}

main().catch((err) => { console.error(err); process.exit(1); });
