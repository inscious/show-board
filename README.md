# Show Board — IUPAT Local 831

Show schedule, work calendar, OJT tracker, portfolio, and labor-call system for IUPAT
Local 831 tradeshow apprentices — multi-user, backed by Supabase, with a separate admin
console for the JATC/coordinator side and a platform console for cross-union administration.

Next.js 14 (App Router) · React · Supabase (Postgres + Auth + Storage) · lucide-react ·
Recharts (dashboard charts). No Tailwind — colors and layout are inline, off the palette in
`lib/core.ts`.

---

## What it does

### Apprentice side (`/`)

- **Home** — this month's hours and gross pay, a monthly-hours chart (trailing calendar
  year, A/B/C/D category breakdown), this week at a glance, what's on the floor today, OJT
  due-date and cert-expiry warnings, notifications feed.
- **Board** — the shared union show schedule: move-in/start/end dates, general contractor,
  region. Flag yourself working/target/passed on any show; schedule the days you got called
  for, down to a note on an individual date distinct from the booking's overall note.
- **Calendar** — a month grid of logged hours, classes, bookings, union meetings/dues, and
  holidays. Clock in/out or flat-hours entry, travel pay and parking pay as their own line
  items, a time-ticket photo attachable to any logged day as a private proof-of-hours record
  (never shown on Portfolio — see below).
- **Portfolio** — tag photos to shows you've worked, building into a shareable public link
  (`/portfolio/[token]`) a hiring manager can open with no login — a real, verifiable work
  history for job-hunting. Deliberately separate from time tickets, which stay private.
- **OJT** — level ladder, category (A/B/C/D) progress toward EJ, per-company pay overrides,
  the monthly OJT slip (submit a month's hours for admin review, or scan an old paper slip
  instead of retyping it by hand), certifications, class curriculum, JATC rules reference,
  contacts. Becomes a read-only **Account** tab once someone's marked a Certified Journeyman
  (`profiles.graduated_at`) — the apprenticeship-only screens drop away, pay defaults to CJ
  scale, apprenticeship history stays visible.
- **Hiring** (foreman capability only) — post a labor call for a specific show, see who
  responds. Confirming a crew directly in-app is still being built; today that last step
  happens the same way it always has, by phone.

Everything **auto-saves** — no save button anywhere for hours/schedule/OJT data. Every
change lands in `localStorage` instantly (works with no bars) and syncs to Supabase in the
background, diffed so only what actually changed gets pushed.

### Admin side (`/admin`)

A genuinely separate dashboard, not extra buttons bolted onto the apprentice view —
`middleware.js` routes each account to the right one at sign-in, before any page renders.

- **Dashboard** — roster hours chart, pending signups, who's on the floor today, certs
  expiring soon.
- **Roster** — every apprentice/CJ, filterable, individual detail view (hours, pay rates,
  certs, classes, do-not-hire status), promote to Certified Journeyman, bulk archive/DNH.
- **Schedule** — add a show one at a time or bulk-import a pasted union PDF, edit/delete
  existing shows, move-in countdown badges.
- **Settings** — org profile, self-signup toggle, OJT auto-approve toggle, apprentice
  avatar-upload toggle, company directory, JATC/DC36 contacts, other admin accounts (a
  **central admin** can grant/revoke admin access; a regular/**moderator admin** can't).

### Platform console (`/console`)

A third, separate dashboard above the union level — for whoever administers the platform
itself across every participating union (`platform_admins`, a distinct identity table, not
a `profiles` flag). Organizations list, cross-union account management, an audited
impersonation flow (time-boxed, logged to `platform_audit_log`) for support, and platform
settings. Local 831 is the pilot union; the schema already supports a second one without a
second codebase — see "Multi-union architecture" below.

### Notifications

Every status change (class assigned, cert expiring, do-not-hire status, OJT approved/
declined, schedule updated, labor call posted) reaches a person two ways: in-app, and by
email (opt-out, on by default — `profiles.notify_email`, sent via `lib/email.js`/Resend).
SMS is scoped in the schema (`notify_sms`) but not wired to a live send path yet.

### Submitted vs. approved vs. logged hours

An apprentice's monthly OJT submission lands as **pending** — it only counts toward their
official total once an admin **approves** it. This is separate from (and never auto-
reconciled with) `work_entries`, the apprentice's own day-to-day logged hours. Three
distinct records on purpose, mirroring the union's own paper-process gap: what was worked,
what was submitted, what's officially on file.

### Auth

Password sign-in is the default (an apprentice can set one from Account once they're in),
with a magic-link email as a fallback. Self-service signup exists (`/signup`) but is
admin-approval-gated — a new account sits pending until an admin approves it; there's no
route to a working account without one.

---

## Multi-union architecture

Every tenant-scoped table (`profiles`, `shows`, `ojt_months`, `bookings`, `classes`,
`certifications`, `notifications`, `jatc_contacts`, and more) carries `organization_id`,
enforced at the RLS layer via `admin_organization_id()` — not just a client-side filter.
`organizations` has a `type` discriminator (union / labor_provider / district_council /
general_contractor / training_center) rather than a separate table per type. Local 831 is
the only real tenant today; the isolation has been tested against a second one on staging,
not just designed. `companies` (the shared labor-provider directory) is deliberately
**not** org-scoped — a labor provider like Freeman or GES works across multiple union
locals, so that data is platform-wide by design, not per-union.

**Known gap, not yet fixed:** `app_settings` (self-signup toggle, OJT auto-approve, org
profile) is still a hard singleton with no org-scoping on its admin-write RLS policy —
harmless with one union, becomes a real cross-tenant write risk once a second union's admin
exists. Flag before onboarding a second union.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### `.env.local`

| Var | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page — public by design, RLS is the real gate |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server-only**, bypasses RLS, never expose client-side |
| `RESEND_API_KEY` | resend.com — outbound notification emails |
| `ALLOWED_EMAILS` | comma-separated emails allowed to request a magic link |

### Database

Paste `supabase/schema.sql` into the Supabase SQL Editor once, on a fresh project — tables,
RLS policies, `is_admin_user()`, the rate-limit function every API route leans on. Everything
else under `supabase/*.sql` (portfolio, time tickets, union notices, the `stageN_*` files,
`fix_avatars_private.sql`) is a dated follow-on migration, applied by hand in order — there's
no automated migration runner. `supabase/schema.sql` itself is the base state only; it does
**not** reflect every later migration, so a fresh project needs the base file plus every
dated migration after it, in order.

### Custom SMTP (recommended)

Supabase's default shared SMTP has a very low send rate. Point Project Settings →
Authentication → SMTP at a real provider once you're past initial setup.

### Bootstrapping the first admin

There's no UI path to create the first admin. Use the service-role key directly:

```js
// one-off script, service-role key, never deployed
const { data } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
await supabase.from("profiles").update({ is_admin: true, is_central_admin: true }).eq("id", data.user.id);
```

---

## Where things are

```
show-board/
├── app/
│   ├── page.jsx                  apprentice dashboard <ShowBoard />
│   ├── admin/                    admin console (layout.jsx = shell/nav, page.jsx = Dashboard)
│   ├── console/                  platform console (organizations, accounts, audit, settings)
│   ├── login/, signup/, pending/ auth + self-signup + awaiting-approval pages
│   ├── portfolio/[token]/        the one public, unauthenticated page — a shared portfolio
│   ├── impersonate/verify/       client-side landing for platform-admin impersonation
│   ├── auth/callback/            magic-link / impersonation redirect target
│   └── api/                      one folder per resource — entries, ojt-months, portfolio,
│                                  time-tickets, labor-calls, console/*, admin/*, settings/*, ...
├── components/
│   ├── apprentice/                the 5-tab apprentice app, incl. tabs/ for each screen
│   ├── admin/                     admin console panels, incl. tabs/ for Dashboard/Roster/Schedule
│   ├── ojt/                       OJT tab's own sub-panels, incl. Portfolio's editor UI
│   ├── ui/                        generic Modal/ConfirmModal shared app-wide
│   └── ShowEditor.jsx             shared add/edit/import-show UI (admin-only)
├── lib/
│   ├── core.ts                    constants, shared seed data, pure helpers — no React, no DOM
│   ├── store.ts                   ← THE ONLY FILE THAT TOUCHES PERSISTENCE (apprentice side)
│   ├── apiGuard.js                shared wrapper: auth + rate limit + zod + admin check
│   ├── rateLimit.js               Postgres-backed fixed-window rate limiter
│   ├── schemas.ts                 zod schemas for every mutation route
│   ├── compressImage.js           client-side photo downscale/recompress before upload
│   ├── email.js / notify.js       Resend sender + the single notifyUsers() entry point
│   ├── AdminContext.js / PlatformContext.js   shared data for the admin/platform consoles
│   └── supabase/                  browser / server / service-role client factories
├── middleware.js                  session gate + apprentice/admin/console routing
└── supabase/
    ├── schema.sql                 base schema — NOT the full current state, see Database above
    └── *.sql                      every dated migration since, applied in order
```

**`lib/store.ts` is still the rule for the apprentice side** — everything reads and writes
through `store.load()` / `store.save()`. Portfolio and time tickets are the one deliberate
exception (own-rows RLS, straight Supabase client reads, guarded API routes for writes) —
photo uploads can't go through the offline-first diff/sync model anyway. Admin and platform
consoles don't use `store.ts` either (different data shape — a roster/org list, not one
person's blob) but follow the same idea: reads go straight through Supabase client calls,
writes go through guarded `/api/admin/*` or `/api/console/*` routes.

---

## Personal data

Nothing in this repo hardcodes any individual's data — apprentice or third-party. Name,
member ID, last-4 SSN, hours, rates, bookings, and classes all live in Supabase, scoped
per-user by RLS, never in source. `lib/personal-data.js` (gitignored) only exists for
`scripts/seed.mjs`, a one-off local script to backfill historical hours.

The labor/I&D company directory and JATC/DC36 contacts are real third-party contact
info — they live in Supabase (`companies`, `jatc_contacts`, `dc36_contacts`), shared,
read-only for apprentices, admin-writable via RLS.

Profile avatars are stored in a **private** Supabase Storage bucket, served via long-lived
signed URLs — not a public bucket. Portfolio and time-ticket photos are private buckets too;
only what an apprentice explicitly shares via their portfolio link is ever public.

---

## Updating the schedule each month

**Admin → Schedule → Import schedule**, paste the rows out of the union PDF. Duplicates
(same name + start date) are skipped, so re-pasting an overlapping sheet is safe. Every
apprentice's Board tab updates from the same shared `shows` table.

---

## Things worth knowing

- **It's local-first on purpose.** Convention halls eat cell signal. Every write lands in
  `localStorage` instantly; Supabase sync happens in the background and never blocks the UI.
- **Sync is diffed, not full-resync**, and durable mid-failure — each category persists its
  own progress as soon as it lands, so a rate-limited or failed delete elsewhere in the same
  sync pass can't erase a save that already reached the server (`lib/store.ts`'s `runSync`).
- **Clock hours ≠ paid hours.** The union gets the hours you stood on the floor. The
  paycheck gets them weighted (OT ×1.5, DT ×2, federal-holiday floor of 8 at OT).
  `entrySplit()` returns both and they're never merged.
- **Worked ≠ submitted ≠ approved.** Three separate records on purpose — see "Submitted vs.
  approved vs. logged hours" above.
- **Time tickets ≠ Portfolio.** A time ticket is a private, per-day proof-of-hours photo. A
  Portfolio photo is a public, shareable career-record photo. Never conflate the two.
- **Mobile-first, but desktop isn't an afterthought.** All three shells (apprentice, admin,
  platform console) switch to a wider, centered desktop layout above 900px — bottom nav
  becomes top pills, modals go from a mobile bottom-sheet to centered.
- **Foreman is a capability, not a separate account.** `profiles.foreman_of_company_id`
  grants it onto an existing apprentice/CJ login — the same real-world person who works the
  floor is usually the one making the hiring calls.
- **The OT multiplier (×1.5) is an assumption.** Everything else in `PAY` came off the
  contract. Confirm it with the hall and change the one constant.
- **`YEAR` is hardcoded** in `core.ts` because the union sheet prints dates as `7/18` with no
  year. It needs bumping (or making smarter) at each year boundary.

---

## Next things to build

1. **Foreman crew confirmation.** Posting a call and seeing who's available already works;
   confirming a crew directly in-app (instead of the followup happening by phone) is the
   piece still missing.
2. **`app_settings` per-union split.** Currently a global singleton with no org-scoping on
   its write policy — needs fixing before a second union's admin exists (see "Multi-union
   architecture" above).
3. **Self-signup's "which union" step.** New self-signups currently land in a hardcoded
   default org; admin-created accounts are unaffected.
4. **Paycheck reconciliation.** Log what actually landed on a stub and diff it against what
   the app predicted.
5. **`.ics` export.** Push scheduled days and class dates into the phone's real calendar.
