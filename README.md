# Show Board — Local 831

Show schedule, work calendar, and OJT tracker for IUPAT Local 831 apprentices — now
multi-user, backed by Supabase, with a separate admin console for the JATC/coordinator
side of things.

Next.js 14 (App Router) · React · Supabase (Postgres + Auth) · lucide-react · Recharts (the
dashboard charts). No Tailwind — colors and layout are inline, off the palette in `lib/core.js`.

---

## What it does

### Apprentice side (`/`)

- **Home** — this month's hours and gross pay, a monthly-hours chart (trailing calendar year,
  A/B/C/D category breakdown — past months come off the submitted OJT record, the current
  month comes live off the calendar), this week at a glance, what's on the floor today, OJT
  due-date status, level progress.
- **Board** — the shared union show schedule: move-in/start/end dates, general contractor,
  region. Flag yourself working/target/passed on any show; schedule the days you got called for,
  down to a note on an individual date (start time, gate, booth) distinct from the booking's
  overall note.
- **Calendar** — a month grid of logged hours, classes, bookings, and holidays, each rendered
  as a filled/highlighted cell (not just a dot) so composition is visible at a glance.
- **OJT** — level ladder, category (A/B/C/D) progress toward EJ, per-company pay overrides, the
  monthly OJT slip (submit a month's hours to your admin for review), and your class schedule.
  Classes are assigned by your admin only — tap one to see the details (time, location, note,
  per-date status) in a read-only modal; you can't add, edit, or remove one yourself.

Everything **auto-saves** — no save button anywhere. Every change lands in `localStorage`
instantly (works with no bars) and syncs to Supabase in the background, diffed so only what
actually changed gets pushed.

### Admin side (`/admin`)

A genuinely separate dashboard, not extra buttons bolted onto the apprentice view —
`middleware.js` routes each account to the right one at sign-in, before any page renders.

- **Roster** — every apprentice, their level, total *approved* OJT hours, pending-review
  count, and what they're currently on the schedule for (working/target flags + bookings), plus
  two roster-wide panels: hours-by-category across everyone (stacked bar, lifetime composition)
  and certifications expiring within 60 days across the whole roster.
- **Per-apprentice detail** — four tabs: **Overview** (stats, pending review, on-the-schedule),
  **History** (approved months + backfill/correct a month), **Classes & Certs** (assign a class,
  toggle any individual class date between attended/missed — the apprentice sees the flag on
  their calendar and gets a notification; add/remove certifications), and **Settings** (edit
  profile, reset their password).
- **Schedule** — add a show, bulk-import a pasted union PDF, edit or delete existing shows,
  each with a move-in countdown badge.
- **Add apprentice** — create a new account directly (email + temp password), no signup flow.

### Classes are admin-assigned, not self-service

`classes` used to be full read/write for the apprentice who owned each row; it's now
select-only for apprentices at the RLS layer (`supabase/schema.sql`) — the write path is
`/api/admin/classes` exclusively. Admin can also toggle any individual date on an assigned
class between attended and missed (`missed_dates`, a plain array of the dates within that
class that got flagged) and revert it later by toggling it back. Both a calendar highlight and
a row in the apprentice's notifications feed follow from marking a date missed — the same
`notifications` table used for new class assignments.

### Submitted vs. approved hours

An apprentice's monthly OJT submission lands as **pending** — it only counts toward their
running total once an admin **approves** it. This is separate from (and doesn't touch)
`work_entries`, which is the apprentice's own day-to-day logged hours. Three distinct records,
on purpose, per the union's own three-way gap: what you worked, what you submitted, what's
officially on file.

### Auth

Password sign-in is the default (an apprentice can set one from OJT → Account once they're
in), with a magic-link email as a fallback for testing/lost passwords. There's no self-serve
signup — accounts only get created by an admin.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the four values below
npm run dev
```

### `.env.local`

| Var | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page — public by design, RLS is the real gate |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server-only**, bypasses RLS, never expose client-side |
| `ALLOWED_EMAILS` | comma-separated emails allowed to request a magic link |

### Database

Paste `supabase/schema.sql` into the Supabase SQL Editor once, on a fresh project. It creates
every table, the RLS policies, the `is_admin_user()` helper, and the rate-limit function the
API routes lean on.

### Custom SMTP (recommended)

Supabase's default shared SMTP has a very low send rate — fine for testing, not for two
people signing in the same afternoon. Point Project Settings → Authentication → SMTP at a
real provider (Resend, Postmark, etc.) once you're past initial setup.

### Bootstrapping the first admin

There's no UI path to create the first admin (chicken-and-egg — creating an apprentice
requires an existing admin session). Use the Supabase service-role key directly:

```js
// one-off script, service-role key, never deployed
const { data } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
await supabase.from("profiles").update({ is_admin: true }).eq("id", data.user.id);
```

---

## Where things are

```
show-board/
├── app/
│   ├── page.jsx                 apprentice dashboard <ShowBoard />
│   ├── admin/page.jsx            admin console <AdminBoard />
│   ├── login/page.jsx            password + magic-link sign-in
│   ├── auth/callback/route.js    magic-link redirect target
│   └── api/
│       ├── auth/                 sign-in, magic-link request, self-service set-password
│       ├── admin/                create apprentice, edit profile/OJT-months, reset password
│       └── (shows, entries, ojt-months, bookings, rates, pins, ...) — no apprentice-facing
│           classes route; classes are admin-write-only, see below
├── components/
│   ├── ShowBoard.jsx             the apprentice app — 4 tabs, all the UI
│   ├── AdminBoard.jsx            the admin console — roster, detail, schedule
│   └── ShowEditor.jsx            shared add/edit/import-show UI (admin-only)
├── lib/
│   ├── core.js                   constants, shared seed data, pure helpers — no React, no DOM
│   ├── store.js                  ← THE ONLY FILE THAT TOUCHES PERSISTENCE (apprentice side)
│   ├── apiGuard.js                shared wrapper: auth + rate limit + zod + admin check
│   ├── rateLimit.js                Postgres-backed fixed-window rate limiter
│   ├── schemas.js                  zod schemas for every mutation route
│   ├── email.js                    minimal Resend sender for password-change notifications
│   └── supabase/                   browser / server / service-role client factories
├── middleware.js                 session gate + admin/apprentice routing
└── supabase/
    └── schema.sql                 tables, RLS policies, rate-limit + is_admin_user() functions
```

**`lib/store.js` is still the rule for the apprentice side** — everything reads and writes
through `store.load()` / `store.save(data)`. The admin console doesn't use it (it's a
different data shape — a roster, not one person's blob) but follows the same idea: reads go
straight through Supabase client calls, writes go through the `/api/admin/*` routes.

---

## Personal data

Nothing in this repo hardcodes any individual's data — apprentice or third-party. Name, member
ID, last-4 SSN, hours, rates, bookings, and classes all live in Supabase, scoped per-user by RLS
(`user_id = auth.uid()`), never in source. `lib/personal-data.js` (gitignored) only exists for
`scripts/seed.mjs`, a one-off local script to backfill your own historical hours.

The labor/I&D company directory (foreman names, labor-line numbers) and JATC office staff
contacts used to be hardcoded constants in `lib/core.js` — that's real third-party contact
info, not the apprentice's own, so it's been moved to Supabase (`companies`, `jatc_contacts`
tables) and is fetched per-session instead. Both are shared, read-only-for-apprentices,
admin-writable via RLS — see `supabase/schema.sql`.

---

## Updating the schedule each month

**Admin → Schedule → Import schedule**, paste the rows out of the union PDF. The parser reads
`move-in · start · end · name · location · booth · company` (tab- or double-space-separated,
matching how PDF table columns paste). Duplicates (same name + start date) are skipped, so
re-pasting an overlapping sheet is safe. Every apprentice's Board tab updates from the same
shared `shows` table.

---

## Things worth knowing

- **It's local-first on purpose.** Convention halls eat cell signal. Every write lands in
  `localStorage` instantly; Supabase sync happens in the background and never blocks the UI.
- **Sync is diffed, not full-resync.** Each category (entries, bookings, shows, ...) only
  posts what actually changed since the last successful sync — posting everything on every
  save doesn't scale past a handful of shows and blows through the API's own rate limits.
- **Clock hours ≠ paid hours.** The union gets the hours you stood on the floor. The paycheck
  gets them weighted (OT ×1.5, DT ×2, holiday floor of 8 at OT). `entrySplit()` returns both
  and they're never merged.
- **Submitted ≠ approved ≠ logged.** Three separate records on purpose — see "Submitted vs.
  approved hours" above.
- **Mobile-first, but desktop isn't an afterthought.** Both apps switch to a wider, centered
  desktop layout above 900px (bottom nav → top pills, modals go from a mobile bottom-sheet to
  centered) — same breakpoint, same `.sb`/`.admin-shell` scoped `<style>` block pattern, no
  Tailwind, no separate desktop build.
- **The OT multiplier (×1.5) is an assumption.** Everything else in `PAY` came off the
  contract. Confirm it with the hall and change the one constant.
- **`YEAR = 2026` is hardcoded** in `core.js` because the union sheet prints dates as `7/18`
  with no year. When 2027 rolls around, that constant needs to become smarter.

---

## Next things to build

1. **Paycheck reconciliation.** Log what actually landed and diff it against what the app
   predicted.
2. **`.ics` export.** Push scheduled days and class dates into the phone's real calendar.
3. **Travel pay.** In the pay package, not counted anywhere yet.
4. **Self-service admin invite flow** — right now a second admin account has to be bootstrapped
   with the service-role key directly (see Setup above).
