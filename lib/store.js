/* ============================================================
   store.js — the ONLY file in the app that touches persistence.

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
   ============================================================ */

import { createClient } from "@/lib/supabase/client";
import { entrySplit, rateFor, levelIndex, ojtTotals } from "@/lib/core";

export const STORE_KEY = "showboard_v2";
const SYNC_KEY = STORE_KEY + ":sync";

function lsGet(k) { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { if (window.localStorage) { window.localStorage.setItem(k, v); return true; } } catch {} return false; }
function lsDel(k) { try { if (window.localStorage) window.localStorage.removeItem(k); } catch {} }

function readSyncState() {
  try { return JSON.parse(lsGet(SYNC_KEY)) || {}; } catch { return {}; }
}
function writeSyncState(s) { lsSet(SYNC_KEY, JSON.stringify(s)); }

/* -------- shape mapping: DB rows <-> the app's local blob -------- */
function showFromRow(row, flag) {
  return {
    id: row.id, name: row.name, mi: row.move_in || "", start: row.starts_on || "",
    end: row.ends_on || "", loc: row.location || "", booth: row.booth || "",
    co: row.gc || "", region: row.region || "", src: row.source || "union",
    status: flag ? flag.status : null, note: flag ? flag.note || "" : "",
  };
}
function entryFromRow(row) {
  const e = { id: row.id, co: row.company, cat: row.category, note: row.note || "", hrs: Number(row.hours) };
  if (row.in_min != null && row.out_min != null) { e.in = row.in_min; e.out = row.out_min; e.brk = row.break_min || 0; }
  return e;
}
function bookingFromRow(row) { return { id: row.id, co: row.company, show: row.show || "", note: row.note || "", dates: row.dates || [], dayNotes: row.day_notes || {} }; }
function classFromRow(row) { return { id: row.id, name: row.name, start: row.start_min, loc: row.location || "", note: row.note || "", dates: row.dates || [] }; }

async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(path + " " + res.status);
}
async function del(path, body) {
  const res = await fetch(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(path + " " + res.status);
}

/* ids present now but absent from `before` -> gone; used to fire deletes */
function removedIds(beforeIds, nowIds) {
  const now = new Set(nowIds);
  return (beforeIds || []).filter((id) => !now.has(id));
}

/* cheap change-detector: same shape, fixed key order every call site, so
   this only has to catch "did anything change", not hash cryptographically */
function hashOf(obj) { return JSON.stringify(obj); }

let lastBlob = null;
let syncing = false;
let currentSync = Promise.resolve();

/* Each category is independently try/catch'd and persisted the moment it
   succeeds — a failure (or a 429) in one must never block the rest. They
   used to share one try block, all-or-nothing: if shows/show-flags (dozens
   of rows) tripped the route's rate limit partway through, the exception
   skipped every category below it in the function, and since writeSyncState
   only ran at the very end, NONE of that pass's progress was saved either —
   so entries and bookings silently never synced at all. Personal data goes
   first now, and the large shared shows list goes last, precisely so it
   can never be the thing standing between a logged hour and Supabase. */
async function runSync(blob, isAdmin) {
  const prev = readSyncState();
  const next = { ...prev };
  const persist = () => writeSyncState(next);

  // entries: pay math (entrySplit/rateFor) is derived here, the same pure
  // functions the UI uses for display — this is the user's own data, not a
  // security boundary, so the route just bounds-checks the numbers rather
  // than re-deriving them.
  try {
    const lvIdx = levelIndex(ojtTotals(blob.ojt?.months).total);
    const prevEntryHash = prev.entries || {};
    const entryHash = {};
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
        entryHash[e.id] = h;
        if (prevEntryHash[e.id] !== h) await post("/api/entries", body);
      }
    }
    for (const id of removedIds(Object.keys(prevEntryHash), Object.keys(entryHash))) await del("/api/entries", { id });
    next.entries = entryHash;
    persist();
  } catch {}

  // ojt months — hash only the hours (m/a/b/c/d), never `status`. status is
  // admin-owned (approve/reject); this route always forces the row back to
  // 'pending' on any write, so if `status` were part of the hash, an admin
  // approving a month would make the very next unrelated save() see a
  // "changed" row, re-POST it, and silently flip it back to pending again.
  try {
    const prevMonthHash = prev.ojtMonths || {};
    const monthHash = {};
    for (const m of blob.ojt?.months || []) {
      const body = { m: m.m, a: m.a, b: m.b, c: m.c, d: m.d };
      const h = hashOf(body);
      monthHash[m.m] = h;
      if (prevMonthHash[m.m] !== h) await post("/api/ojt-months", body);
    }
    for (const m of removedIds(Object.keys(prevMonthHash), Object.keys(monthHash))) await del("/api/ojt-months", { m });
    next.ojtMonths = monthHash;
    persist();
  } catch {}

  // bookings
  try {
    const prevBookHash = prev.bookings || {};
    const bookHash = {};
    for (const b of blob.bookings || []) {
      const h = hashOf(b);
      bookHash[b.id] = h;
      if (prevBookHash[b.id] !== h) await post("/api/bookings", b);
    }
    for (const id of removedIds(Object.keys(prevBookHash), Object.keys(bookHash))) await del("/api/bookings", { id });
    next.bookings = bookHash;
    persist();
  } catch {}

  // classes
  try {
    const prevClassHash = prev.classes || {};
    const classHash = {};
    for (const c of blob.classes || []) {
      const h = hashOf(c);
      classHash[c.id] = h;
      if (prevClassHash[c.id] !== h) await post("/api/classes", c);
    }
    for (const id of removedIds(Object.keys(prevClassHash), Object.keys(classHash))) await del("/api/classes", { id });
    next.classes = classHash;
    persist();
  } catch {}

  // rates
  try {
    const rateCos = Object.keys(blob.rates || {}).filter((co) => blob.rates[co]);
    const prevRates = prev.rates || {};
    const rateMap = {};
    for (const co of rateCos) {
      rateMap[co] = blob.rates[co];
      if (prevRates[co] !== blob.rates[co]) await post("/api/rates", { co, level: blob.rates[co] });
    }
    for (const co of removedIds(Object.keys(prevRates), rateCos)) await del("/api/rates", { co });
    next.rates = rateMap;
    persist();
  } catch {}

  // pins
  try {
    const pins = blob.pins || [];
    for (const name of pins) if (!(prev.pins || []).includes(name)) await post("/api/pins", { name, pinned: true });
    for (const name of removedIds(prev.pins, pins)) await post("/api/pins", { name, pinned: false });
    next.pins = pins;
    persist();
  } catch {}

  // custom companies — additive only, the app never removes one
  try {
    const customCos = blob.customCos || [];
    for (const name of customCos) if (!(prev.customCos || []).includes(name)) await post("/api/custom-companies", { name });
    next.customCos = customCos;
    persist();
  } catch {}

  // shows: shared fields (admin only) + per-user status/note (everyone) —
  // last on purpose (see comment above) and only pushes what actually
  // changed, but a real season still runs into dozens of shows, so this
  // route's rate limit is bumped well above the default (see app/api/shows
  // and app/api/show-flags).
  try {
    const prevShowHash = prev.shows || {};
    const prevFlagHash = prev.showFlags || {};
    const showHash = {};
    const flagHash = {};
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
  } catch {}
}

/* single-flight: overlapping calls drop and rely on the caller to retry —
   except signOut(), which awaits currentSync then flushes once more so a
   save() that lands right before logging out doesn't get dropped for good. */
function syncToRemote(blob, isAdmin) {
  if (typeof window === "undefined" || !navigator.onLine) return currentSync;
  if (syncing) return currentSync;
  syncing = true;
  currentSync = runSync(blob, isAdmin).finally(() => { syncing = false; });
  return currentSync;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (lastBlob) syncToRemote(lastBlob, lastBlob.__isAdmin); });
}

export const store = {
  backend: "none",
  savedAt: 0,
  isAdmin: false,
  email: null,
  hasPassword: false,

  async load() {
    if (typeof window === "undefined") return null;
    const cached = lsGet(STORE_KEY);
    let cachedData = null;
    try { cachedData = cached !== null ? JSON.parse(cached) : null; } catch {}

    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return cachedData;

      const [profileRes, showsRes, flagsRes, entriesRes, ojtRes, bookingsRes, classesRes, ratesRes, pinsRes, certsRes, notifsRes, companiesRes, jatcRes] = await Promise.all([
        supabase.from("profiles").select("is_admin, has_password, custom_companies, name, member_id, ssn_last4, local, rsi_credits, joined_on").eq("id", user.id).single(),
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
      ]);

      const flagById = {};
      (flagsRes.data || []).forEach((f) => { flagById[f.show_id] = f; });

      const entries = {};
      (entriesRes.data || []).forEach((row) => {
        const k = row.worked_on;
        (entries[k] = entries[k] || []).push(entryFromRow(row));
      });

      const rates = {};
      (ratesRes.data || []).forEach((r) => { rates[r.company] = r.pay_level; });

      const blob = {
        shows: (showsRes.data || []).map((row) => showFromRow(row, flagById[row.id])),
        pins: (pinsRes.data || []).map((p) => p.company_name),
        entries,
        customCos: profileRes.data?.custom_companies || [],
        ojt: { months: (ojtRes.data || []).map((m) => ({ m: m.month, a: Number(m.cat_a), b: Number(m.cat_b), c: Number(m.cat_c), d: Number(m.cat_d), status: m.status || "approved" })) },
        rates,
        bookings: (bookingsRes.data || []).map(bookingFromRow),
        classes: (classesRes.data || []).map(classFromRow),
        certs: (certsRes.data || []).map((c) => ({ id: c.id, n: c.name, exp: c.exp })),
        notifications: (notifsRes.data || []).map((n) => ({ id: n.id, type: n.type, message: n.message, at: n.created_at })),
        // shared directory data — same shape the app has always used ({n, city, st, tel, fm})
        companies: (companiesRes.data || []).map((c) => ({ n: c.name, city: c.city || "", st: c.state || "", tel: c.labor_line || "", fm: c.foreman || "" })),
        jatcContacts: (jatcRes.data || []).map((c) => ({ n: c.name, tel: c.tel || "", ext: c.ext || "", email: c.email || "", sms: c.sms || "" })),
        isAdmin: !!profileRes.data?.is_admin,
        hasPassword: !!profileRes.data?.has_password,
        email: user.email,
        profile: {
          name: profileRes.data?.name || "",
          memberId: profileRes.data?.member_id || "",
          last4: profileRes.data?.ssn_last4 || "",
          local: profileRes.data?.local || "IUPAT Local 831",
          rsiCredits: Number(profileRes.data?.rsi_credits || 0),
          joined: profileRes.data?.joined_on || "",
        },
      };

      store.backend = "supabase";
      store.isAdmin = blob.isAdmin;
      store.email = blob.email;
      store.hasPassword = blob.hasPassword;
      lsSet(STORE_KEY, JSON.stringify({ ...blob, updatedAt: Date.now() }));
      return blob;
    } catch {
      store.backend = cachedData ? "local" : "none";
      if (cachedData) { store.isAdmin = !!cachedData.isAdmin; store.email = cachedData.email || null; store.hasPassword = !!cachedData.hasPassword; }
      return cachedData;
    }
  },

  async save(data) {
    if (typeof window === "undefined") return false;
    const blob = { ...data, isAdmin: store.isAdmin, email: store.email };
    const ok = lsSet(STORE_KEY, JSON.stringify({ ...blob, updatedAt: Date.now() }));
    if (ok) store.savedAt = Date.now();
    lastBlob = { ...blob, __isAdmin: store.isAdmin };
    syncToRemote(blob, store.isAdmin); // fire-and-forget — never block the UI on the network
    return ok;
  },

  async wipe() {
    if (typeof window === "undefined") return;
    lsDel(STORE_KEY);
    lsDel(SYNC_KEY);
  },

  /* clears (deletes) one notification, or all of them with id: "all" —
     goes straight to the server, same reasoning as setPassword: this isn't
     part of the diffed shows/entries/etc. blob, no need to route it through save(). */
  async clearNotification(id) {
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

  async signOut() {
    if (typeof window === "undefined") return;
    // flush whatever's pending so a save() right before logout isn't lost:
    // wait out anything already in flight, then push the latest state once
    // more — capped, so a slow connection can't turn "sign out" into a hang.
    if (lastBlob && navigator.onLine) {
      const flush = currentSync.then(() => syncToRemote(lastBlob, lastBlob.__isAdmin));
      await Promise.race([flush, new Promise((resolve) => setTimeout(resolve, 4000))]);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  /* Sets/changes the password for the signed-in account. Needs an active
     session (magic link is still how you get the first one in the door).
     Goes through the server route (not supabase.auth.updateUser directly)
     so it can flip has_password and send the "your password changed" email. */
  async setPassword(password) {
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
  async exportJson() { return lsGet(STORE_KEY) || "{}"; },
  async importJson(json) { try { JSON.parse(json); return lsSet(STORE_KEY, json); } catch { return false; } },
};
