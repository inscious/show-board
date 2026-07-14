# Show Board — Local 831

Show schedule, work calendar, and OJT tracker for an IUPAT Local 831 apprentice.

Next.js (App Router) · React · lucide-react. No Tailwind, no database, no accounts.
Everything lives in the browser on your phone.

---

## Before you start — what to have

| | Why |
|---|---|
| **Node.js 20 or newer** | Check with `node -v`. If it's missing, get it from nodejs.org (LTS). |
| **A code editor** | VS Code is fine. |
| **Git** | `git --version`. Comes with Xcode tools on a Mac. |
| **GitHub account** | Free. Where the code lives. |
| **Vercel account** | Free. Sign in *with GitHub* — it makes deploying one click. |

That's it. Nothing to pay for, nothing to configure.

---

## Run it

```bash
cd ~/where-you-put-it/show-board
npm install
npm run dev
```

Open **http://localhost:3000**.

To see it on your phone while you develop, find your laptop's LAN address
(`ipconfig getifaddr en0` on a Mac) and open `http://192.168.x.x:3000` on the phone —
same Wi-Fi. That's the fastest loop for testing move-in-day stuff.

---

## Put it on your phone for real

```bash
git init
git add -A
git commit -m "show board"
gh repo create show-board --private --source=. --push   # or push to a repo you make on github.com
```

Then on **vercel.com** → *Add New Project* → pick the repo → **Deploy**. No settings to
change; Vercel detects Next.js. You get a URL like `show-board-xyz.vercel.app` in about a minute.

On the phone: open that URL in Safari → **Share → Add to Home Screen**. It installs like a
native app — full screen, own icon, no browser chrome. That's the PWA manifest doing its job.

Every `git push` redeploys automatically.

---

## Where things are

```
show-board/
├── app/
│   ├── layout.jsx        page shell, PWA metadata, viewport
│   ├── page.jsx          renders <ShowBoard />
│   └── globals.css       page background + 5 utility classes
├── components/
│   └── ShowBoard.jsx     the whole app — 4 tabs, all the UI
├── lib/
│   ├── core.js           constants, seed data, pure helpers. No React.
│   └── store.js          ← THE ONLY FILE THAT TOUCHES PERSISTENCE
├── public/
│   ├── manifest.webmanifest
│   └── icon-*.png        home-screen icons
└── supabase/
    └── schema.sql        for the day your brother signs in. Not used yet.
```

**`lib/store.js` is the important one.** The entire app reads and writes through
`store.load()` and `store.save(data)`. Nothing else knows where the data lives. That's
deliberate — when you go multi-user, you rewrite *that file* and nothing else changes.

---

## What's your data vs. what's everyone's

In `lib/core.js`, clearly marked at the top:

**Yours** — `APPRENTICE`, `OJT_SEED`, `CO_RATE_SEED`, `BOOKING_SEED`, `CLASS_SEED`.
Your name, member ID, last-4, 748 submitted hours, Willwork's L4 rate, the Comic-Con
booking, the Double Decker class.

> **Before anyone else touches this app, that data has to come out of the source and into
> a per-user table.** Right now your last-4 is sitting in a file that would go in a git repo.
> Keep the repo **private** until it moves.

**Everyone's** — `COMPANIES`, `RAW_MAY/JUNE/JULY`, `LEVELS`, `CATS_META`, `PAY`, `JATC`.
Same for every apprentice in the local. These become shared tables, seeded once.

---

## Updating the schedule each month

Today: **Board tab → Import schedule**, paste the rows out of the union PDF. The parser
reads move-in · start · end · name · location · booth · company. Duplicates are skipped,
so re-pasting an overlapping sheet is safe.

Later, when it's multi-user: you import once, and everyone's board updates. That's the
whole reason `shows` is a shared table in the schema.

---

## Things worth knowing

- **It's local-first on purpose.** Convention halls eat cell signal. The app has to work
  with no bars, so it never blocks on a network call. Keep it that way.
- **Clock hours ≠ paid hours.** The union gets the hours you stood on the floor. The
  paycheck gets them weighted (OT ×1.5, DT ×2, holiday floor of 8 at OT). The app tracks
  both and never mixes them. Don't "simplify" this later.
- **The OT multiplier (×1.5) is an assumption.** Everything else in `PAY` came off the
  contract. Confirm it with the hall and change the one constant.
- **`YEAR = 2026` is hardcoded** in `core.js` because the union sheet prints dates as
  `7/18` with no year. When 2027 rolls around, that constant needs to become smarter.

---

## Next things to build

Roughly in the order I'd do them:

1. **Paycheck reconciliation.** Log what actually landed and diff it against what the app
   predicted. This is the one that finds money.
2. **`.ics` export.** Push scheduled days and class dates into the phone's real calendar
   with alarms.
3. **Travel pay.** $10/day is in the package and nothing counts it.
4. **Multi-user** (see `supabase/schema.sql` and the plan doc).
