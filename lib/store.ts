/* ============================================================
   store.ts — the ONLY file in the app that touches persistence.

   Local-first on purpose — convention halls eat cell signal and the app has
   to work with no bars. Every write lands in localStorage instantly; Supabase
   sync happens in the background and never blocks the UI.

   load(): reads Supabase (shared schedule + your own hours/OJT/bookings/
   classes/rates), reassembles the same blob shape the app has always used,
   and caches it locally. Offline (or before sign-in resolves), it falls back
   to that cache.

   save(blob): writes the cache immediately, then diffs the blob against the
   last-synced id set per collection and pushes upserts/deletes through the
   API routes in the background. A failed sync just gets retried whole on the
   next save() or on the browser's `online` event — every upsert is
   idempotent, so re-sending unchanged rows is harmless.

   Row types below mirror supabase/schema.sql's actual columns — that's the
   whole point of typing this file: entryFromRow/bookingFromRow/classFromRow
   and the profiles select() are exactly where a DB-column-name mismatch
   would previously fail silently at runtime instead of at compile time.
   ============================================================ */

import { createClient } from "@/lib/supabase/client";
import { entrySplit, rateFor, levelIndex, ojtTotals } from "@/lib/core";
import type { Show, Entry, EntriesByDay, Booking, Klass, OjtMonth, Company } from "@/lib/core";

export const STORE_KEY = "showboard_v2";
const SYNC_KEY = STORE_KEY + ":sync";

/* -------- Supabase row shapes (mirrors supabase/schema.sql) -------- */
type ShowRow = {
  id: string; name: string; move_in: string | null; starts_on: string | null; ends_on: string | null;
  location: string | null; booth: string | null; gc: string | null; region: string | null;
  source: string | null; sheet_month: string | null;
};
type ShowFlagRow = { show_id: string; status: "working" | "target" | "passed" | null; note: string | null };
type WorkEntryRow = {
  id: string; worked_on: string; company: string; in_min: number | null; out_min: number | null;
  break_min: number | null; hours: number; category: string | null; note: string | null;
};
type OjtMonthRow = { month: string; cat_a: number; cat_b: number; cat_c: number; cat_d: number; status: string | null };
type BookingRow = { id: string; company: string; show: string | null; note: string | null; dates: string[]; day_notes: Record<string, string> | null };
type ClassRow = { id: string; name: string; start_min: number | null; location: string | null; note: string | null; dates: string[]; missed_dates: string[] | null };
type CompanyRateRow = { company: string; pay_level: string };
type PinnedCompanyRow = { company_name: string };
type CertRow = { id: string; name: string; exp: string };
type NotificationRow = { id: string; type: string; message: string; created_at: string };
type CompanyRow = { name: string; city: string | null; state: string | null; labor_line: string | null; foreman: string | null };
type JatcContactRow = { name: string; tel: string | null; ext: string | null; email: string | null; sms: string | null };
/* the exact column list in the profiles .select() below — narrower than the
   full profiles table on purpose (SSN/member ID etc. shouldn't over-fetch),
   but do_not_hire_at/do_not_hire_reason previously weren't in that list
   despite being read a few lines later. That made an apprentice's own
   do-not-hire banner (ShowBoard.jsx ~8986) permanently unable to show for
   ANYONE loading their own account, regardless of actual status — the
   select() and the fields read from its result had silently drifted apart.
   Typing this exact shape against the exact select() string is what caught
   it; both are fixed together below. */
type ProfileSelectRow = {
  is_admin: boolean;
  has_password: boolean;
  custom_companies: string[] | null;
  name: string | null;
  member_id: string | null;
  ssn_last4: string | null;
  local: string | null;
  rsi_credits: number | null;
  joined_on: string | null;
  do_not_hire_at: string | null;
  do_not_hire_reason: string | null;
};

export type Blob = {
  shows: Show[];
  pins: string[];
  entries: EntriesByDay;
  customCos: string[];
  ojt: { months: OjtMonth[] };
  rates: Record<string, string>;
  bookings: Booking[];
  classes: Klass[];
  certs?: Array<{ id: string; n: string; exp: string }>;
  completedClasses?: number[];
  notifications?: Array<{ id: string; type: string; message: string; at: string }>;
  companies?: Company[];
  jatcContacts?: Array<{ n: string; tel: string; ext: string; email: string; sms: string }>;
  isAdmin?: boolean;
  hasPassword?: boolean;
  email?: string | null;
  profile?: { name: string; memberId: string; last4: string; local: string; rsiCredits: number; joined: string };
  doNotHire?: { on: boolean; reason: string; since: string | null };
};
/* what save() actually receives — just the diffed/synced categories, not
   the read-only extras (certs, notifications, profile, ...) that load()
   also returns but only ever come FROM the server, never get pushed back. */
export type SaveBlob = Pick<Blob, "shows" | "pins" | "entries" | "customCos" | "ojt" | "rates" | "bookings" | "classes">;
type SyncBlob = SaveBlob & { isAdmin?: boolean; email?: string | null; __isAdmin?: boolean };

type SyncState = {
  entries?: Record<string, string>;
  ojtMonths?: Record<string, string>;
  bookings?: Record<string, string>;
  rates?: Record<string, string>;
  pins?: string[];
  customCos?: string[];
  shows?: Record<string, string>;
  showFlags?: Record<string, string>;
};

function lsGet(k: string): string | null { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch { return null; } }
function lsSet(k: string, v: string): boolean { try { if (window.localStorage) { window.localStorage.setItem(k, v); return true; } } catch {} return false; }
function lsDel(k: string): void { try { if (window.localStorage) window.localStorage.removeItem(k); } catch {} }

function readSyncState(): SyncState {
  try { return JSON.parse(lsGet(SYNC_KEY) || "") || {}; } catch { return {}; }
}
function writeSyncState(s: SyncState): void { lsSet(SYNC_KEY, JSON.stringify(s)); }

/* -------- shape mapping: DB rows <-> the app's local blob -------- */
function showFromRow(row: ShowRow, flag?: ShowFlagRow): Show {
  return {
    id: row.id, name: row.name, mi: row.move_in || "", start: row.starts_on || "",
    end: row.ends_on || "", loc: row.location || "", booth: row.booth || "",
    co: row.gc || "", region: row.region || "", src: row.source || "union",
    sheetMonth: row.sheet_month || "",
    status: flag ? flag.status : null, note: flag ? flag.note || "" : "",
  };
}
function entryFromRow(row: WorkEntryRow): Entry {
  const e: Entry = { id: row.id, co: row.company, cat: row.category, note: row.note || "", hrs: Number(row.hours) };
  if (row.in_min != null && row.out_min != null) { e.in = row.in_min; e.out = row.out_min; e.brk = row.break_min || 0; }
  return e;
}
function bookingFromRow(row: BookingRow): Booking { return { id: row.id, co: row.company, show: row.show || "", note: row.note || "", dates: row.dates || [], dayNotes: row.day_notes || {} }; }
function classFromRow(row: ClassRow): Klass { return { id: row.id, name: row.name, start: row.start_min, loc: row.location || "", note: row.note || "", dates: row.dates || [], missedDates: row.missed_dates || [] }; }

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(path + " " + res.status);
}
async function del(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(path + " " + res.status);
}

/* ids present now but absent from `before` -> gone; used to fire deletes */
function removedIds(beforeIds: string[] | undefined, nowIds: string[]): string[] {
  const now = new Set(nowIds);
  return (beforeIds || []).filter((id) => !now.has(id));
}

/* cheap change-detector: same shape, fixed key order every call site, so
   this only has to catch "did anything change", not hash cryptographically */
function hashOf(obj: unknown): string { return JSON.stringify(obj); }

let lastBlob: (SyncBlob & { __isAdmin?: boolean }) | null = null;
let syncing = false;
let currentSync: Promise<void> = Promise.resolve();

/* Sync failures used to be entirely silent (each category below is its own
   empty catch{} on purpose — one bad category must never block the rest).
   That meant a real failure (rate limit, offline, server error) gave the
   user no signal at all, so a stuck save looked identical to a working one.
   This tracks the latest outcome so the UI can say something instead of
   nothing; it does not change the retry behavior itself. */
type SyncStatus = { ok: boolean; message: string };
let syncStatus: SyncStatus = { ok: true, message: "" };
const statusListeners = new Set<(s: SyncStatus) => void>();
function setSyncStatus(next: SyncStatus): void {
  syncStatus = next;
  statusListeners.forEach((fn) => fn(syncStatus));
}
export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  fn(syncStatus);
  return () => statusListeners.delete(fn);
}

/* Each category is independently try/catch'd and persisted the moment it
   succeeds — a failure (or a 429) in one must never block the rest. They
   used to share one try block, all-or-nothing: if shows/show-flags (dozens
   of rows) tripped the route's rate limit partway through, the exception
   skipped every category below it in the function, and since writeSyncState
   only ran at the very end, NONE of that pass's progress was saved either —
   so entries and bookings silently never synced at all. Personal data goes
   first now, and the large shared shows list goes last, precisely so it
   can never be the thing standing between a logged hour and Supabase. */
async function runSync(blob: SyncBlob, isAdmin: boolean): Promise<void> {
  const prev = readSyncState();
  const next: SyncState = { ...prev };
  const persist = () => writeSyncState(next);
  const failures: Array<{ cat: string; err: unknown }> = [];

  // entries: pay math (entrySplit/rateFor) is derived here, the same pure
  // functions the UI uses for display — this is the user's own data, not a
  // security boundary, so the route just bounds-checks the numbers rather
  // than re-deriving them.
  try {
    const lvIdx = levelIndex(ojtTotals(blob.ojt?.months).total);
    const prevEntryHash = prev.entries || {};
    const entryHash: Record<string, string> = {};
    for (const dayKey of Object.keys(blob.entries || {})) {
      for (const e of blob.entries[dayKey]) {
        const sp = entrySplit(dayKey, e);
        const rt = rateFor(e.co, lvIdx, blob.rates);
        const body = {
          id: e.id, dayKey, co: e.co, cat: e.cat, note: e.note || "",
          hrs: e.hrs, in: e.in ?? null, out: e.out ?? null, brk: e.brk ?? null,
          clock: sp.clock, st: sp.st, ot: sp.ot, dt: sp.dt, payRate: rt.rate ?? null,
        };
        const h = hashOf(body);
        entryHash[e.id!] = h;
        if (prevEntryHash[e.id!] !== h) await post("/api/entries", body);
      }
    }
    for (const id of removedIds(Object.keys(prevEntryHash), Object.keys(entryHash))) await del("/api/entries", { id });
    next.entries = entryHash;
    persist();
  } catch (err) { failures.push({ cat: "entries", err }); }

  // ojt months — hash only the hours (m/a/b/c/d), never `status`. status is
  // admin-owned (approve/reject); this route always forces the row back to
  // 'pending' on any write, so if `status` were part of the hash, an admin
  // approving a month would make the very next unrelated save() see a
  // "changed" row, re-POST it, and silently flip it back to pending again.
  try {
    const prevMonthHash = prev.ojtMonths || {};
    const monthHash: Record<string, string> = {};
    for (const m of blob.ojt?.months || []) {
      const body = { m: m.m, a: m.a, b: m.b, c: m.c, d: m.d };
      const h = hashOf(body);
      monthHash[m.m] = h;
      if (prevMonthHash[m.m] !== h) await post("/api/ojt-months", body);
    }
    for (const m of removedIds(Object.keys(prevMonthHash), Object.keys(monthHash))) await del("/api/ojt-months", { m });
    next.ojtMonths = monthHash;
    persist();
  } catch (err) { failures.push({ cat: "ojtMonths", err }); }

  // bookings
  try {
    const prevBookHash = prev.bookings || {};
    const bookHash: Record<string, string> = {};
    for (const b of blob.bookings || []) {
      const h = hashOf(b);
      bookHash[b.id] = h;
      if (prevBookHash[b.id] !== h) await post("/api/bookings", b);
    }
    for (const id of removedIds(Object.keys(prevBookHash), Object.keys(bookHash))) await del("/api/bookings", { id });
    next.bookings = bookHash;
    persist();
  } catch (err) { failures.push({ cat: "bookings", err }); }

  // classes are admin-assigned only now — nothing here to push, they're
  // read straight off Supabase in load() below.

  // rates
  try {
    const rateCos = Object.keys(blob.rates || {}).filter((co) => blob.rates[co]);
    const prevRates = prev.rates || {};
    const rateMap: Record<string, string> = {};
    for (const co of rateCos) {
      rateMap[co] = blob.rates[co];
      if (prevRates[co] !== blob.rates[co]) await post("/api/rates", { co, level: blob.rates[co] });
    }
    for (const co of removedIds(Object.keys(prevRates), rateCos)) await del("/api/rates", { co });
    next.rates = rateMap;
    persist();
  } catch (err) { failures.push({ cat: "rates", err }); }

  // pins
  try {
    const pins = blob.pins || [];
    for (const name of pins) if (!(prev.pins || []).includes(name)) await post("/api/pins", { name, pinned: true });
    for (const name of removedIds(prev.pins, pins)) await post("/api/pins", { name, pinned: false });
    next.pins = pins;
    persist();
  } catch (err) { failures.push({ cat: "pins", err }); }

  // custom companies — additive only, the app never removes one
  try {
    const customCos = blob.customCos || [];
    for (const name of customCos) if (!(prev.customCos || []).includes(name)) await post("/api/custom-companies", { name });
    next.customCos = customCos;
    persist();
  } catch (err) { failures.push({ cat: "customCos", err }); }

  // shows: shared fields (admin only) + per-user status/note (everyone) —
  // last on purpose (see comment above) and only pushes what actually
  // changed, but a real season still runs into dozens of shows, so this
  // route's rate limit is bumped well above the default (see app/api/shows
  // and app/api/show-flags).
  try {
    const prevShowHash = prev.shows || {};
    const prevFlagHash = prev.showFlags || {};
    const showHash: Record<string, string> = {};
    const flagHash: Record<string, string> = {};
    for (const s of blob.shows) {
      if (isAdmin) {
        const body = { id: s.id, name: s.name, mi: s.mi, start: s.start, end: s.end, loc: s.loc, booth: s.booth, co: s.co, region: s.region || null, src: s.src };
        const h = hashOf(body);
        showHash[s.id] = h;
        if (prevShowHash[s.id] !== h) await post("/api/shows", body);
      }
      const flagBody = { showId: s.id, status: s.status || null, note: s.note || "" };
      const fh = hashOf(flagBody);
      flagHash[s.id] = fh;
      if (prevFlagHash[s.id] !== fh) await post("/api/show-flags", flagBody);
    }
    if (isAdmin) {
      for (const id of removedIds(Object.keys(prevShowHash), Object.keys(showHash))) await del("/api/shows", { id });
    }
    next.shows = showHash;
    next.showFlags = flagHash;
    persist();
  } catch (err) { failures.push({ cat: "shows", err }); }

  if (failures.length === 0) {
    setSyncStatus({ ok: true, message: "" });
  } else {
    const rateLimited = failures.some((f) => / 429$/.test(String((f.err as Error)?.message)));
    setSyncStatus({
      ok: false,
      message: rateLimited
        ? "Saving too fast — hours are kept on this device and will finish syncing in about a minute."
        : "Couldn't reach the server — hours are kept on this device and will sync automatically once the connection is back.",
    });
  }
}

/* single-flight: overlapping calls drop and rely on the caller to retry —
   except signOut(), which awaits currentSync then flushes once more so a
   save() that lands right before logging out doesn't get dropped for good. */
function syncToRemote(blob: SyncBlob, isAdmin: boolean): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return currentSync;
  if (syncing) return currentSync;
  syncing = true;
  currentSync = runSync(blob, isAdmin).finally(() => { syncing = false; });
  return currentSync;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (lastBlob) syncToRemote(lastBlob, !!lastBlob.__isAdmin); });
}

export const store = {
  backend: "none" as "none" | "local" | "supabase",
  savedAt: 0,
  isAdmin: false,
  email: null as string | null,
  hasPassword: false,

  async load(): Promise<Blob | null> {
    if (typeof window === "undefined") return null;
    const cached = lsGet(STORE_KEY);
    let cachedData: Blob | null = null;
    try { cachedData = cached !== null ? JSON.parse(cached) : null; } catch {}

    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return cachedData;

      const [profileRes, showsRes, flagsRes, entriesRes, ojtRes, bookingsRes, classesRes, ratesRes, pinsRes, certsRes, notifsRes, companiesRes, jatcRes, completedClassesRes] = await Promise.all([
        supabase.from("profiles").select("is_admin, has_password, custom_companies, name, member_id, ssn_last4, local, rsi_credits, joined_on, do_not_hire_at, do_not_hire_reason").eq("id", user.id).single(),
        supabase.from("shows").select("*"),
        supabase.from("show_flags").select("*").eq("user_id", user.id),
        supabase.from("work_entries").select("*").eq("user_id", user.id),
        supabase.from("ojt_months").select("*").eq("user_id", user.id),
        supabase.from("bookings").select("*").eq("user_id", user.id),
        supabase.from("classes").select("*").eq("user_id", user.id),
        supabase.from("company_rates").select("*").eq("user_id", user.id),
        supabase.from("pinned_companies").select("*").eq("user_id", user.id),
        supabase.from("certifications").select("*").eq("user_id", user.id),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("companies").select("*"),
        supabase.from("jatc_contacts").select("*"),
        supabase.from("completed_classes").select("course_id").eq("user_id", user.id),
      ]);

      const profile = profileRes.data as ProfileSelectRow | null;
      const showRows = (showsRes.data || []) as ShowRow[];
      const flagRows = (flagsRes.data || []) as ShowFlagRow[];
      const entryRows = (entriesRes.data || []) as (WorkEntryRow & { worked_on: string })[];
      const ojtRows = (ojtRes.data || []) as OjtMonthRow[];
      const bookingRows = (bookingsRes.data || []) as BookingRow[];
      const classRows = (classesRes.data || []) as ClassRow[];
      const rateRows = (ratesRes.data || []) as CompanyRateRow[];
      const pinRows = (pinsRes.data || []) as PinnedCompanyRow[];
      const certRows = (certsRes.data || []) as CertRow[];
      const notifRows = (notifsRes.data || []) as NotificationRow[];
      const companyRows = (companiesRes.data || []) as CompanyRow[];
      const jatcRows = (jatcRes.data || []) as JatcContactRow[];
      const completedClassRows = (completedClassesRes.data || []) as { course_id: number }[];

      const flagById: Record<string, ShowFlagRow> = {};
      flagRows.forEach((f) => { flagById[f.show_id] = f; });

      const entries: EntriesByDay = {};
      entryRows.forEach((row) => {
        const k = row.worked_on;
        (entries[k] = entries[k] || []).push(entryFromRow(row));
      });

      const rates: Record<string, string> = {};
      rateRows.forEach((r) => { rates[r.company] = r.pay_level; });

      const blob: Blob = {
        shows: showRows.map((row) => showFromRow(row, flagById[row.id])),
        pins: pinRows.map((p) => p.company_name),
        entries,
        customCos: profile?.custom_companies || [],
        ojt: { months: ojtRows.map((m) => ({ m: m.month, a: Number(m.cat_a), b: Number(m.cat_b), c: Number(m.cat_c), d: Number(m.cat_d), status: m.status || "approved" })) },
        rates,
        bookings: bookingRows.map(bookingFromRow),
        classes: classRows.map(classFromRow),
        certs: certRows.map((c) => ({ id: c.id, n: c.name, exp: c.exp })),
        completedClasses: completedClassRows.map((c) => c.course_id),
        notifications: notifRows.map((n) => ({ id: n.id, type: n.type, message: n.message, at: n.created_at })),
        // shared directory data — same shape the app has always used ({n, city, st, tel, fm})
        companies: companyRows.map((c) => ({ n: c.name, city: c.city || "", st: c.state || "", tel: c.labor_line || "", fm: c.foreman || "" })),
        jatcContacts: jatcRows.map((c) => ({ n: c.name, tel: c.tel || "", ext: c.ext || "", email: c.email || "", sms: c.sms || "" })),
        isAdmin: !!profile?.is_admin,
        hasPassword: !!profile?.has_password,
        email: user.email,
        profile: {
          name: profile?.name || "",
          memberId: profile?.member_id || "",
          last4: profile?.ssn_last4 || "",
          local: profile?.local || "IUPAT Local 831",
          rsiCredits: Number(profile?.rsi_credits || 0),
          joined: profile?.joined_on || "",
        },
        doNotHire: {
          on: !!profile?.do_not_hire_at,
          reason: profile?.do_not_hire_reason || "",
          since: profile?.do_not_hire_at || null,
        },
      };

      store.backend = "supabase";
      store.isAdmin = !!blob.isAdmin;
      store.email = blob.email ?? null;
      store.hasPassword = !!blob.hasPassword;
      lsSet(STORE_KEY, JSON.stringify({ ...blob, updatedAt: Date.now() }));
      return blob;
    } catch {
      store.backend = cachedData ? "local" : "none";
      if (cachedData) { store.isAdmin = !!cachedData.isAdmin; store.email = cachedData.email ?? null; store.hasPassword = !!cachedData.hasPassword; }
      return cachedData;
    }
  },

  async save(data: SaveBlob): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const blob: SyncBlob = { ...data, isAdmin: store.isAdmin, email: store.email };
    const ok = lsSet(STORE_KEY, JSON.stringify({ ...blob, updatedAt: Date.now() }));
    if (ok) store.savedAt = Date.now();
    lastBlob = { ...blob, __isAdmin: store.isAdmin };
    syncToRemote(blob, store.isAdmin); // fire-and-forget — never block the UI on the network
    return ok;
  },

  async wipe(): Promise<void> {
    if (typeof window === "undefined") return;
    lsDel(STORE_KEY);
    lsDel(SYNC_KEY);
  },

  /* clears (deletes) one notification, or all of them with id: "all" —
     goes straight to the server, same reasoning as setPassword: this isn't
     part of the diffed shows/entries/etc. blob, no need to route it through save(). */
  async clearNotification(id: string): Promise<{ ok: boolean }> {
    if (typeof window === "undefined") return { ok: false };
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  },

  async signOut(): Promise<void> {
    if (typeof window === "undefined") return;
    // flush whatever's pending so a save() right before logout isn't lost:
    // wait out anything already in flight, then push the latest state once
    // more — capped, so a slow connection can't turn "sign out" into a hang.
    if (lastBlob && navigator.onLine) {
      const flush = currentSync.then(() => syncToRemote(lastBlob!, !!lastBlob!.__isAdmin));
      await Promise.race([flush, new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  /* Sets/changes the password for the signed-in account. Needs an active
     session (magic link is still how you get the first one in the door).
     Goes through the server route (not supabase.auth.updateUser directly)
     so it can flip has_password and send the "your password changed" email. */
  async setPassword(password: string): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === "undefined") return { ok: false, error: "unavailable" };
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || "Couldn't set password" };
      store.hasPassword = true;
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  },

  /* Back up / restore the whole blob — useful before you break something. */
  async exportJson(): Promise<string> { return lsGet(STORE_KEY) || "{}"; },
  async importJson(json: string): Promise<boolean> { try { JSON.parse(json); return lsSet(STORE_KEY, json); } catch { return false; } },
};
