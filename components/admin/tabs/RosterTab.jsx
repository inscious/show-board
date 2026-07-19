"use client";

import { useState, useMemo } from "react";
import { Plus, Search, ChevronRight, GraduationCap, Ban, Archive as ArchiveIcon, Check, RotateCcw, Trash2 } from "lucide-react";
import { C, SHADOW, FM, FS, hrsFmt, mMed, levelIndex, ojtTotals, LEVELS } from "@/lib/core";
import { Avatar, PwField, ApprenticePicker, req, ConfirmModal } from "@/components/admin/shared";

/* ---------- new apprentice ---------- */
export function NewApprenticeForm({ onCreated, onClose }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setState("error"); setMsg("Password needs 8+ characters."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/apprentices", { email: email.trim().toLowerCase(), password: pw, name: name.trim() || undefined });
      setState("done");
      onCreated();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
      <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="apprentice@example.com"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NAME (optional)</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Apprentice"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TEMP PASSWORD</div>
      <div style={{ marginBottom: 14 }}>
        <PwField value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters — tell them this directly" />
      </div>
      <button type="submit" disabled={state === "saving" || !email.trim() || !pw}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Creating…" : state === "done" ? "Created" : "Create account"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

/* ---------- assign a class to one, several, or all apprentices ---------- */
export function AssignClassForm({ apprentices, preselected, onAssigned, onClose }) {
  const [selected, setSelected] = useState(() => new Set(preselected || []));
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const dateRange = (a, b) => {
    if (!a) return [];
    const out = [];
    const d = new Date(a + "T00:00:00");
    const end = new Date((b || a) + "T00:00:00");
    while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    return out;
  };

  const submit = async (e) => {
    e.preventDefault();
    const dates = dateRange(from, to);
    if (selected.size === 0) { setState("error"); setMsg("Pick at least one apprentice."); return; }
    if (!name.trim()) { setState("error"); setMsg("Class needs a name."); return; }
    if (dates.length === 0) { setState("error"); setMsg("Pick at least one date."); return; }
    setState("saving");
    setMsg("");
    try {
      const [h, m] = start ? start.split(":").map(Number) : [null, null];
      await req("POST", "/api/admin/classes", {
        userIds: Array.from(selected), name: name.trim(), loc: loc.trim() || undefined, note: note.trim() || undefined,
        start: h != null ? h * 60 + m : undefined, dates,
      });
      setState("done");
      onAssigned();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>APPRENTICES</div>
      <ApprenticePicker apprentices={apprentices} selected={selected} onToggle={toggle} maxHeight={160} />

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CLASS NAME</div>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. #39–43 Double Decker"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>FROM</div>
          <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TO (optional)</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TIME</div>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>LOCATION (optional)</div>
      <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="14930 Marquardt Ave"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NOTE (optional)</div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="bring tools + book"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 14 }} />

      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Assigning…" : state === "done" ? "Assigned" : "Assign class to " + selected.size + " apprentice" + (selected.size === 1 ? "" : "s")}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

/* ---------- put several apprentices on the do-not-hire list at once —
   loops the same POST /api/admin/do-not-hire the single-apprentice Danger
   Zone flow uses, one call per selected apprentice, same shared reason ---------- */
export function BulkDnhForm({ apprentices, onDone, onClose }) {
  const [selected, setSelected] = useState(() => new Set());
  const [reason, setReason] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    if (selected.size === 0) { setState("error"); setMsg("Pick at least one apprentice."); return; }
    if (!reason.trim()) { setState("error"); setMsg("Reason is required."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/do-not-hire", { userIds: Array.from(selected), onList: true, reason: reason.trim() });
      setState("done");
      onDone();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {apprentices.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.lo }}>Everyone active is already on the list.</div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>APPRENTICES</div>
          <ApprenticePicker apprentices={apprentices} selected={selected} onToggle={toggle} maxHeight={220} selectedColor={C.danger} checkColor="#2A0E0A" />
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>REASON (required, applies to everyone selected)</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. OJT turned in late for June" rows={2}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, fontFamily: FS, resize: "vertical", marginBottom: 14 }} />
          <button type="submit" disabled={state === "saving"}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.danger, color: "#2A0E0A", border: "none", fontWeight: 800, fontSize: 14 }}>
            {state === "saving" ? "Adding…" : state === "done" ? "Added" : "Add " + selected.size + " to do-not-hire list"}
          </button>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

/* ---------- archive several apprentices at once — loops the same PATCH
   /api/admin/apprentices the single-apprentice Danger Zone flow uses ---------- */
export function BulkArchiveForm({ apprentices, onDone, onClose }) {
  const [selected, setSelected] = useState(() => new Set());
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    if (selected.size === 0) { setState("error"); setMsg("Pick at least one apprentice."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("PATCH", "/api/admin/apprentices", { userIds: Array.from(selected), archived: true });
      setState("done");
      onDone();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {apprentices.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.lo }}>No active apprentices to archive.</div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>APPRENTICES</div>
          <ApprenticePicker apprentices={apprentices} selected={selected} onToggle={toggle} maxHeight={260} />
          <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
            Everyone selected drops off the active roster — everything on file stays put, and each can be restored anytime from the archive.
          </div>
          <button type="submit" disabled={state === "saving"}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
            {state === "saving" ? "Archiving…" : state === "done" ? "Archived" : "Archive " + selected.size + " apprentice" + (selected.size === 1 ? "" : "s")}
          </button>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

/* ---------- roster ---------- */
function Roster({ apprentices, monthsByUser, onSelect, onAddApprentice, onAssignClass, onDoNotHire, onBulkArchive }) {
  const roster = useMemo(() => apprentices.map((a) => {
    const months = monthsByUser[a.id] || [];
    const approved = months.filter((m) => m.status === "approved");
    const pendingCount = months.filter((m) => m.status === "pending").length;
    const total = ojtTotals(approved).total;
    const lastMonth = months.slice().sort((x, y) => (x.m < y.m ? 1 : -1))[0];
    return { ...a, total, level: LEVELS[levelIndex(total)], pendingCount, lastMonth };
  }).sort((x, y) => (x.name || x.email).localeCompare(y.name || y.email)), [apprentices, monthsByUser]);

  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [dnhOnly, setDnhOnly] = useState(false);

  const cities = useMemo(() => Array.from(new Set(roster.map((a) => a.city).filter(Boolean))).sort(), [roster]);
  const levelsPresent = useMemo(() => LEVELS.filter((lv) => roster.some((a) => a.level.k === lv.k)), [roster]);

  const filtered = useMemo(() => roster.filter((a) => {
    if (cityFilter && a.city !== cityFilter) return false;
    if (levelFilter && a.level.k !== levelFilter) return false;
    if (pendingOnly && a.pendingCount === 0) return false;
    if (dnhOnly && !a.do_not_hire_at) return false;
    if (q.trim()) {
      const hay = ((a.name || "") + " " + a.email).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [roster, cityFilter, levelFilter, pendingOnly, dnhOnly, q]);

  const anyFilterActive = cityFilter || levelFilter || pendingOnly || dnhOnly || q.trim();
  const inputStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px", color: C.hi, fontSize: 12.5, fontFamily: FS };

  if (roster.length === 0) {
    return (
      <div>
        <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No apprentices yet. Add one below.</div>
        <button className="foc" onClick={onAddApprentice}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
          <Plus size={15} /> Add apprentice
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 10 }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={14} color={C.lo} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…"
            style={{ ...inputStyle, width: "100%", padding: "8px 10px 8px 30px" }} />
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={{ ...inputStyle, flex: "1 1 100px" }}>
            <option value="">All levels</option>
            {levelsPresent.map((lv) => <option key={lv.k} value={lv.k}>{lv.k} — {lv.label}</option>)}
          </select>
          <button className="foc" onClick={() => setPendingOnly((v) => !v)}
            style={{ flexShrink: 0, fontFamily: FM, fontSize: 11.5, fontWeight: 800, padding: "8px 12px", borderRadius: 9, background: pendingOnly ? C.brand : "transparent", color: pendingOnly ? "#1A1206" : C.mid, border: "1px solid " + (pendingOnly ? C.brand : C.line) }}>
            Pending only
          </button>
          <button className="foc" onClick={() => setDnhOnly((v) => !v)}
            style={{ flexShrink: 0, fontFamily: FM, fontSize: 11.5, fontWeight: 800, padding: "8px 12px", borderRadius: 9, background: dnhOnly ? C.danger : "transparent", color: dnhOnly ? "#2A0E0A" : C.mid, border: "1px solid " + (dnhOnly ? C.danger : C.line) }}>
            Do not hire
          </button>
          {anyFilterActive && (
            <button className="foc" onClick={() => { setQ(""); setCityFilter(""); setLevelFilter(""); setPendingOnly(false); setDnhOnly(false); }}
              style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: "8px 12px", borderRadius: 9, background: "transparent", color: C.lo, border: "1px solid " + C.line }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="foc" onClick={onAddApprentice}
          style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
          <Plus size={15} /> Add apprentice
        </button>
        {apprentices.length > 0 && (
          <>
            <button className="foc" onClick={onAssignClass}
              style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
              <GraduationCap size={15} /> Assign class
            </button>
            <button className="foc" onClick={onDoNotHire}
              style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.danger, border: "1px dashed " + C.danger + "66", fontWeight: 700, fontSize: 13.5 }}>
              <Ban size={15} /> Do not hire
            </button>
            <button className="foc" onClick={onBulkArchive}
              style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.mid, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
              <ArchiveIcon size={15} /> Archive
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No apprentices match these filters.</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.map((a) => (
        <button key={a.id} className="foc roster-row" onClick={() => onSelect(a.id)}
          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
          <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
            {a.name && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, fontFamily: FM, marginTop: 1 }}>{a.email}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FM, fontSize: 13, fontWeight: 800, color: C.working }}>{hrsFmt(a.total)}h</span>
              <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 5, padding: "1px 6px" }}>{a.level.k}</span>
              {a.do_not_hire_at && <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, fontWeight: 800, color: C.danger, background: "rgba(232,146,124,0.14)", border: "1px solid " + C.danger + "66", borderRadius: 5, padding: "1px 6px" }}>DNH</span>}
              {a.city && <span className="truncate" style={{ fontSize: 10.5, color: C.mid }}>{a.city}</span>}
              {a.lastMonth && <span className="truncate" style={{ fontSize: 10.5, color: C.lo }}>last {mMed(a.lastMonth.m)}</span>}
            </div>
          </div>
          {a.pendingCount > 0 && (
            <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9.5, fontWeight: 800, color: C.brand, border: "1px solid rgba(255,176,32,0.5)", borderRadius: 5, padding: "2px 6px" }}>
              {a.pendingCount} PENDING
            </span>
          )}
          <ChevronRight size={16} color={C.lo} style={{ flexShrink: 0 }} />
        </button>
      ))}
      </div>
      )}
    </div>
  );
}

/* ---------- archived apprentices — off the active roster, kept for record.
   Deliberately lighter-weight than Roster (no OJT stats up front, this is a
   rarely-visited list) — archived date is the useful thing to see here.
   Select mode turns rows into checkboxes for bulk restore/delete instead of
   drilling into one at a time — the archive is often cleaned out in a
   batch (a season wrapping up, several no-shows at once), not one apprentice
   at a time the way the active roster usually is. ---------- */
function ArchivedRoster({ apprentices, onSelect, onChanged }) {
  const rows = useMemo(() => apprentices.slice()
    .sort((x, y) => (y.archived_at || "").localeCompare(x.archived_at || "")), [apprentices]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmAction, setConfirmAction] = useState(null); // "restore" | "delete" | null
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setMsg("");
  };

  const runBulkAction = async () => {
    setBusy(true);
    setMsg("");
    try {
      const userIds = Array.from(selected);
      if (confirmAction === "restore") {
        await req("PATCH", "/api/admin/apprentices", { userIds, archived: false });
      } else {
        await req("DELETE", "/api/admin/apprentices", { userIds });
      }
      setConfirmAction(null);
      exitSelectMode();
      onChanged();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedNames = useMemo(() =>
    rows.filter((a) => selected.has(a.id)).map((a) => a.name || a.email),
    [rows, selected]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.lo }}>
          {selectMode ? selected.size + " selected" : rows.length + " archived"}
        </div>
        {selectMode ? (
          <>
            <button className="foc" onClick={() => setConfirmAction("restore")} disabled={selected.size === 0}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid " + C.line, color: selected.size ? C.working : C.lo, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, opacity: selected.size ? 1 : 0.5 }}>
              <RotateCcw size={12} /> Restore
            </button>
            <button className="foc" onClick={() => setConfirmAction("delete")} disabled={selected.size === 0}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid " + C.line, color: selected.size ? C.danger : C.lo, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, opacity: selected.size ? 1 : 0.5 }}>
              <Trash2 size={12} /> Delete
            </button>
            <button className="foc" onClick={exitSelectMode}
              style={{ background: "transparent", border: "none", color: C.lo, fontSize: 11.5, fontWeight: 700, padding: "6px 4px" }}>
              Cancel
            </button>
          </>
        ) : (
          <button className="foc" onClick={() => setSelectMode(true)}
            style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.gc, fontSize: 11.5, fontWeight: 700, padding: "6px 4px" }}>
            Select
          </button>
        )}
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 11.5, color: C.danger }}>{msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((a) => {
          const isSelected = selected.has(a.id);
          return (
            <button key={a.id} className="foc roster-row" onClick={() => selectMode ? toggle(a.id) : onSelect(a.id)}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: C.sunk, border: "1px solid " + (selectMode && isSelected ? C.gc + "88" : C.line), borderRadius: 12, padding: "13px 15px", opacity: selectMode ? 1 : 0.8 }}>
              {selectMode && (
                <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: "1px solid " + C.line, background: isSelected ? C.gc : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <Check size={12} color="#0A1420" />}
                </span>
              )}
              <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.mid }}>{a.name || a.email}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>
                  archived {a.archived_at ? a.archived_at.slice(0, 10) : "—"}
                </div>
              </div>
              {!selectMode && <ChevronRight size={16} color={C.lo} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {confirmAction === "restore" && (
        <ConfirmModal
          title={"Restore " + selected.size + " apprentice" + (selected.size === 1 ? "" : "s") + "?"}
          message={<>{selectedNames.join(", ")} will show up in the active roster again, same as before they were archived.</>}
          confirmLabel="Restore"
          danger={false}
          onClose={() => !busy && setConfirmAction(null)}
          onConfirm={runBulkAction}
        />
      )}
      {confirmAction === "delete" && (
        <ConfirmModal
          title={"Delete " + selected.size + " apprentice" + (selected.size === 1 ? "" : "s") + " permanently?"}
          message={<>This permanently deletes {selectedNames.join(", ")} and every record on file — hours, classes, certs, bookings. <strong style={{ color: C.hi }}>This can't be undone.</strong></>}
          confirmLabel="Delete permanently"
          onClose={() => !busy && setConfirmAction(null)}
          onConfirm={runBulkAction}
        />
      )}
    </div>
  );
}

/* ---------- roster tab — the list view (drill-down into one apprentice is
   ApprenticeDetail, rendered by the shell instead, since selectedId lives
   there and the assign-class modal it opens is shell-level too). ---------- */
export function RosterTab({ apprentices, archivedApprentices, monthsByUser, onSelect, onAddApprentice, onAssignClass, onDoNotHire, onBulkArchive, onChanged }) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <>
      <Roster apprentices={apprentices} monthsByUser={monthsByUser} onSelect={onSelect}
        onAddApprentice={onAddApprentice} onAssignClass={onAssignClass} onDoNotHire={onDoNotHire}
        onBulkArchive={onBulkArchive} />

      {archivedApprentices.length > 0 && (
        <button className="foc" onClick={() => setShowArchived((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.panel, border: "1px solid " + C.edge, borderRadius: 10, padding: "11px 13px", color: C.mid, fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>
          <ChevronRight size={14} color={C.lo} style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
          {showArchived ? "Hide" : "Show"} {archivedApprentices.length} archived apprentice{archivedApprentices.length === 1 ? "" : "s"}
        </button>
      )}
      {showArchived && <ArchivedRoster apprentices={archivedApprentices} onSelect={onSelect} onChanged={onChanged} />}
    </>
  );
}
