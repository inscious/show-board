# Claude Code — brief

App for a working IUPAT Local 831 tradeshow apprentice. Show schedule, hours, and OJT
paperwork. Used on a phone, in a convention hall, often with no signal.

## Ground rules

1. **`lib/store.js` is the only file that touches persistence.** If a component starts
   reaching for `localStorage` directly, that's a bug. The whole point of the seam is that
   swapping localStorage for Supabase is a one-file change.
2. **Local-first.** Never block the UI on a network call. It has to work with no bars.
3. **Clock hours and paid hours are different numbers.** The JATC gets the hours he stood
   on the floor. The paycheck gets them weighted (OT ×1.5, DT ×2, federal holiday = 8-hour
   floor at OT). `entrySplit()` returns both — `.clock` and `.st/.ot/.dt`. Do not merge them.
4. **Submitted hours and logged hours are different records.** `ojt.months` is what the
   union has on file. `entries` is what the app logged. The gap between them is the point —
   never auto-reconcile.
5. **Mobile first.** Nav is a bottom bar under 900px, top pills above it. Test at 360px.
6. **No Tailwind.** Colors are inline hex off the `C` palette in `core.js`. Layout uses
   plain CSS classes from the `<style>` block inside the component.
7. **Half-hour granularity.** No time ticket ever reads 10:17. Times come from `TIME_SLOTS`.

## Data that is personal and must not ship to another user

In `lib/core.js`: `APPRENTICE` (name, member ID, **last 4 of SSN**), `OJT_SEED`,
`CO_RATE_SEED`, `BOOKING_SEED`, `CLASS_SEED`. Keep the repo private until these move to a
per-user table. `supabase/schema.sql` already has the shape.

## Domain vocabulary

- **General contractor / "the general"** — the company printed on the union schedule
  (Freeman, GES, Shepard). They run the floor.
- **I&D house** — the labor shop that actually calls you (Eagle, Willwork). You can work
  the same show for two different shops. The company on your time ticket is the shop that
  called you, *not* the general.
- **OJT** — the monthly hours slip. Due the 1st of the following month by 4:00 PM. Late =
  do-not-hire list. Categories A/B/C/D are the four work processes.
- **RSI** — classroom credits. Classes are mandatory and unpaid.
- **Move-in** — install days before the show opens. That's when the labor calls happen.

## Verify before you claim it works

```bash
npm run build      # must pass — it prerenders, so SSR-unsafe code fails loudly
npm run dev        # then click through all four tabs
```
