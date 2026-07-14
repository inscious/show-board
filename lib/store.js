/* ============================================================
   store.js — the ONLY file in the app that touches persistence.

   Today: localStorage. Local-first on purpose — convention halls
   eat cell signal and the app has to work with no bars.

   Tomorrow: swap the bodies of load/save for Supabase calls and
   return the same shape. Nothing else in the app changes. That is
   the entire reason this file is 40 lines instead of scattered.
   ============================================================ */

export const STORE_KEY = "showboard_v2";

function lsGet(k) { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { if (window.localStorage) { window.localStorage.setItem(k, v); return true; } } catch {} return false; }
function lsDel(k) { try { if (window.localStorage) window.localStorage.removeItem(k); } catch {} }

export const store = {
  backend: "none",
  savedAt: 0,

  async load() {
    if (typeof window === "undefined") return null;      // server render — nothing to read
    const raw = lsGet(STORE_KEY);
    if (raw !== null) {
      store.backend = "local";
      try { return JSON.parse(raw); } catch { return null; }
    }
    store.backend = lsSet(STORE_KEY + ":probe", "1") ? "local" : "none";
    lsDel(STORE_KEY + ":probe");
    return null;
  },

  async save(data) {
    if (typeof window === "undefined") return false;
    const ok = lsSet(STORE_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
    if (ok) store.savedAt = Date.now();
    return ok;
  },

  async wipe() {
    if (typeof window === "undefined") return;
    lsDel(STORE_KEY);
  },

  /* Back up / restore the whole blob — useful before you break something. */
  async exportJson() { return lsGet(STORE_KEY) || "{}"; },
  async importJson(json) { try { JSON.parse(json); return lsSet(STORE_KEY, json); } catch { return false; } },
};
