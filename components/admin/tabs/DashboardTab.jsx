"use client";

import { useState, useMemo } from "react";
import { ChevronRight, TrendingDown, Bell, Pencil } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import {
  C, SHADOW, FM, FS, hrsFmt, mMed, levelIndex, ojtTotals, LEVELS, certState, KLASS, todayMid, DOW,
  CATS_META, mKey, mParse, MONTHS, num, keyOf, fromKey, fmtClock, mAdd, showsOn,
} from "@/lib/core";
import { Avatar, Modal, req, Stat, ApprenticePicker, RosterCatTooltip } from "@/components/admin/shared";
import { PendingSignupsPanel } from "@/components/admin/PendingSignupsPanel";
import { OnTheFloorPanel } from "@/components/admin/OnTheFloorPanel";

// "Gerardo Cortes" -> "Gerardo C." — compact enough for the Y axis while
// still disambiguating apprentices who share a first name (full name +
// level + joined date live in the tooltip on hover)
function axisName(name, email) {
  const parts = (name || email || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "?";
  return parts[0] + " " + parts[parts.length - 1][0] + ".";
}

// "2024-08-15" -> "Aug 2024" — for the roster chart tooltip
function joinedLabel(dateStr) {
  if (!dateStr) return null;
  const mo = Number(String(dateStr).slice(5, 7));
  if (!mo) return null;
  return (MONTHS[mo - 1].charAt(0) + MONTHS[mo - 1].slice(1).toLowerCase()) + " " + dateStr.slice(0, 4);
}

/* ---------- roster hours by category — lifetime composition per apprentice,
   from months already loaded in state (no extra fetch) ---------- */
function RosterCategoryChart({ apprentices, monthsByUser }) {
  const data = useMemo(() => apprentices.map((a) => {
    const approved = (monthsByUser[a.id] || []).filter((m) => m.status === "approved");
    const t = ojtTotals(approved);
    return {
      name: axisName(a.name, a.email), fullName: a.name || a.email,
      level: LEVELS[levelIndex(t.total)].k, joined: joinedLabel(a.joined_on),
      a: t.a, b: t.b, c: t.c, d: t.d, total: t.total,
    };
  }).filter((d) => d.total > 0), [apprentices, monthsByUser]);

  if (data.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>ROSTER HOURS BY CATEGORY</div>
        <div style={{ display: "flex", gap: 9, marginLeft: "auto" }}>
          {["A", "B", "C", "D"].map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: CATS_META[k].color }} />
              <span style={{ fontSize: 9.5, fontFamily: FM, color: C.lo }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: Math.max(120, data.length * 42) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap="30%">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={88} tick={{ fill: C.mid, fontSize: 11, fontFamily: FS }} axisLine={{ stroke: C.line }} tickLine={false} />
            <Tooltip content={<RosterCatTooltip />} cursor={{ fill: C.line, fillOpacity: 0.35 }} />
            {["a", "b", "c", "d"].map((k, i) => (
              <Bar key={k} dataKey={k} stackId="hrs" fill={CATS_META[k.toUpperCase()].color} stroke={C.panel} strokeWidth={1}
                radius={i === 3 ? [0, 3, 3, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- upcoming classes across the whole roster — classes is one row
   PER APPRENTICE (no shared "session" id), so regroup by name+dates to
   reconstruct "who's in this class" from classesByUser, already loaded. ---------- */
function classSessionKey(c) { return c.name + "|" + (c.dates || []).slice().sort().join(","); }

/* ---------- add more apprentices to an already-assigned class session —
   same POST /api/admin/classes the initial assignment uses, just with the
   session's name/start/loc/note/dates carried over untouched and the
   apprentice picker narrowed to whoever isn't already in it ---------- */
function AddToClassForm({ session, candidates, onAdded, onClose }) {
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
      await req("POST", "/api/admin/classes", {
        userIds: Array.from(selected), name: session.name, loc: session.loc || undefined, note: session.note || undefined,
        start: session.start ?? undefined, dates: session.dates,
      });
      setState("done");
      onAdded();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {candidates.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.lo }}>Everyone on the active roster is already in this class.</div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>APPRENTICES NOT YET IN THIS CLASS</div>
          <ApprenticePicker apprentices={candidates} selected={selected} onToggle={toggle} maxHeight={260} />
          <button type="submit" disabled={state === "saving"}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14 }}>
            {state === "saving" ? "Adding…" : state === "done" ? "Added" : "Add " + selected.size + " apprentice" + (selected.size === 1 ? "" : "s")}
          </button>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

// "480" -> "08:00", for pre-filling the <input type="time">
function minToHHMM(m) {
  if (m == null) return "";
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

/* ---------- edit the date/time/location/note for every apprentice already
   in a session — one PUT hitting every row by its own {id, userId} pair,
   since classes has no shared session id to update against directly ---------- */
function EditClassForm({ session, onSaved, onClose }) {
  const [name, setName] = useState(session.name);
  const [loc, setLoc] = useState(session.loc || "");
  const [note, setNote] = useState(session.note || "");
  const [start, setStart] = useState(minToHHMM(session.start));
  const [from, setFrom] = useState(session.dates[0] || "");
  const [to, setTo] = useState(session.dates[session.dates.length - 1] || "");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

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
    if (!name.trim()) { setState("error"); setMsg("Class needs a name."); return; }
    if (dates.length === 0) { setState("error"); setMsg("Pick at least one date."); return; }
    setState("saving");
    setMsg("");
    try {
      const [h, m] = start ? start.split(":").map(Number) : [null, null];
      await req("PUT", "/api/admin/classes", {
        items: session.people.map((p) => ({ id: p.classId, userId: p.apprentice.id })),
        name: name.trim(), loc: loc.trim() || undefined, note: note.trim() || undefined,
        start: h != null ? h * 60 + m : undefined, dates,
      });
      setState("done");
      onSaved();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CLASS NAME</div>
      <input required value={name} onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>FROM</div>
          <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TO</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TIME</div>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13 }} />
        </div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>LOCATION</div>
      <input value={loc} onChange={(e) => setLoc(e.target.value)}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NOTE</div>
      <input value={note} onChange={(e) => setNote(e.target.value)}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 14 }} />

      <div style={{ fontSize: 11, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
        Updates all {session.people.length} apprentice{session.people.length === 1 ? "" : "s"} in this class — everyone gets a notification.
      </div>

      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Save changes"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

function UpcomingClasses({ apprentices, classesByUser, onOpenApprentice, onChanged }) {
  const sessions = useMemo(() => {
    const map = {};
    apprentices.forEach((a) => {
      (classesByUser[a.id] || []).forEach((c) => {
        const key = classSessionKey(c);
        if (!map[key]) map[key] = { name: c.name, start: c.start, loc: c.loc, note: c.note, dates: (c.dates || []).slice().sort(), people: [] };
        map[key].people.push({ apprentice: a, classId: c.id, missedCount: (c.missedDates || []).length });
      });
    });
    const todayKey = keyOf(todayMid());
    return Object.values(map)
      .filter((s) => s.dates.length && s.dates[s.dates.length - 1] >= todayKey)
      .sort((x, y) => x.dates[0].localeCompare(y.dates[0]));
  }, [apprentices, classesByUser]);

  const [openKey, setOpenKey] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const open = useMemo(() => openKey ? sessions.find((s) => classSessionKey(s) === openKey) || null : null, [openKey, sessions]);
  const candidates = useMemo(() => open ? apprentices.filter((a) => !open.people.some((p) => p.apprentice.id === a.id)) : [], [open, apprentices]);
  if (sessions.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: KLASS, fontFamily: FM, marginBottom: 9 }}>UPCOMING CLASSES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sessions.map((s, i) => {
          const days = Math.round((fromKey(s.dates[0]) - todayMid()) / 86400000);
          const soon = days <= 3;
          return (
            <button key={i} className="foc" onClick={() => setOpenKey(classSessionKey(s))}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{s.name}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>
                  {s.dates.length} day{s.dates.length === 1 ? "" : "s"} · {s.dates[0]}{s.loc ? " · " + s.loc : ""} · {s.people.length} apprentice{s.people.length === 1 ? "" : "s"}
                </div>
              </div>
              <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: soon ? C.brand : C.lo, border: "1px solid " + (soon ? "rgba(255,176,32,0.5)" : C.line), borderRadius: 5, padding: "2px 6px" }}>
                {days <= 0 ? "TODAY" : days === 1 ? "TOMORROW" : "IN " + days + "D"}
              </span>
              <ChevronRight size={14} color={C.lo} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {open && (
        <Modal title={open.name} onClose={() => setOpenKey(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <Stat label="DATES" value={open.dates.length + "d"} sub={open.dates[0] + (open.dates.length > 1 ? " – " + open.dates[open.dates.length - 1] : "")} />
            <Stat label="STARTS" value={open.start != null ? fmtClock(open.start) : "—"} sub={open.loc || "no location on file"} />
          </div>
          <button className="foc" onClick={() => setEditOpen(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, background: "transparent", border: "1px dashed " + C.line, color: C.mid, fontSize: 11.5, fontWeight: 700, marginBottom: 14 }}>
            <Pencil size={12} /> Edit date, time & location
          </button>
          {open.note && (
            <div style={{ fontSize: 12.5, color: C.mid, lineHeight: 1.5, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 11px", marginBottom: 14 }}>{open.note}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM }}>{open.people.length} APPRENTICE{open.people.length === 1 ? "" : "S"} SCHEDULED</div>
            <button className="foc" onClick={() => setAddOpen(true)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: KLASS, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Add apprentices</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {open.people.map(({ apprentice: a, missedCount }) => (
              <button key={a.id} className="foc" onClick={() => onOpenApprentice(a.id)}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} size={30} />
                <div className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
                {missedCount > 0 && (
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: C.danger, border: "1px solid " + C.danger + "55", borderRadius: 5, padding: "2px 6px" }}>{missedCount} MISSED</span>
                )}
                <ChevronRight size={13} color={C.lo} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {addOpen && open && (
        <Modal title={"Add apprentices — " + open.name} onClose={() => setAddOpen(false)}>
          <AddToClassForm session={open} candidates={candidates} onAdded={onChanged} onClose={() => setAddOpen(false)} />
        </Modal>
      )}
      {editOpen && open && (
        <Modal title={"Edit — " + open.name} onClose={() => setEditOpen(false)}>
          <EditClassForm session={open} onSaved={() => { onChanged(); setOpenKey(null); }} onClose={() => setEditOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- who's falling behind — no OJT submitted in 2+ months, or the
   last two months' pace has dropped hard against their own history. Pure
   client-side read of monthsByUser that's already loaded, no extra fetch. ---------- */
function fallingBehindInfo(months) {
  const approved = (months || []).filter((m) => m.status === "approved").sort((a, b) => (a.m < b.m ? -1 : 1));
  if (approved.length === 0) return null;

  const lastKey = approved[approved.length - 1].m;
  const nowKey = mKey(todayMid().getFullYear(), todayMid().getMonth());
  const expectedKey = mAdd(nowKey, -1); // most recent month that should be on file by now
  const gapMonths = (mParse(expectedKey).y * 12 + mParse(expectedKey).m) - (mParse(lastKey).y * 12 + mParse(lastKey).m);

  if (gapMonths >= 2) {
    return { lastKey, kind: "gap", detail: "Nothing submitted since " + mMed(lastKey) };
  }

  if (approved.length >= 4) {
    const totals = approved.map((m) => num(m.a) + num(m.b) + num(m.c) + num(m.d));
    const recent = totals.slice(-2);
    const prior = totals.slice(0, -2);
    const recentAvg = recent.reduce((s, x) => s + x, 0) / recent.length;
    const priorAvg = prior.reduce((s, x) => s + x, 0) / prior.length;
    if (priorAvg >= 20 && recentAvg < priorAvg * 0.5) {
      const pct = Math.round((1 - recentAvg / priorAvg) * 100);
      return { lastKey, kind: "pace", detail: "Pace down " + pct + "% — " + hrsFmt(recentAvg) + " avg/mo last 2mo vs " + hrsFmt(priorAvg) + " before" };
    }
  }
  return null;
}

function FallingBehindPanel({ apprentices, monthsByUser, onOpenApprentice }) {
  const rows = useMemo(() => apprentices
    .map((a) => ({ apprentice: a, info: fallingBehindInfo(monthsByUser[a.id]) }))
    .filter((r) => r.info)
    .sort((x, y) => (x.info.kind === y.info.kind ? 0 : x.info.kind === "gap" ? -1 : 1)),
    [apprentices, monthsByUser]);

  if (rows.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.brand, fontFamily: FM, marginBottom: 9 }}>FALLING BEHIND — {rows.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(({ apprentice: a, info }) => (
          <button key={a.id} className="foc" onClick={() => onOpenApprentice(a.id)}
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
            <TrendingDown size={15} color={info.kind === "gap" ? C.danger : C.brand} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
              <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>{info.detail}</div>
            </div>
            <ChevronRight size={14} color={C.lo} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- everyone currently on the do-not-hire list, across the whole
   roster — filters apprentices already loaded, no extra fetch ---------- */
function DoNotHirePanel({ apprentices, onOpenApprentice }) {
  const rows = useMemo(() => apprentices.filter((a) => a.do_not_hire_at)
    .sort((x, y) => (y.do_not_hire_at || "").localeCompare(x.do_not_hire_at || "")), [apprentices]);

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.danger + "44", borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.danger, fontFamily: FM, marginBottom: 9 }}>DO NOT HIRE — {rows.length}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.lo }}>Nobody on the list right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((a) => (
            <button key={a.id} className="foc" onClick={() => onOpenApprentice(a.id)}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
              <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>
                  since {a.do_not_hire_at.slice(0, 10)}{a.do_not_hire_reason ? " · " + a.do_not_hire_reason : ""}
                </div>
              </div>
              <ChevronRight size={14} color={C.lo} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- certs expiring across the whole roster — filters certsByUser
   that's already loaded, no extra fetch either ---------- */
function ExpiringCerts({ apprentices, certsByUser }) {
  const rows = useMemo(() => {
    const out = [];
    apprentices.forEach((a) => {
      (certsByUser[a.id] || []).forEach((c) => {
        const st = certState(c.exp);
        if (st.days <= 60) out.push({ userId: a.id, apprentice: a.name || a.email, cert: c.name, exp: c.exp, ...st });
      });
    });
    return out.sort((x, y) => x.days - y.days);
  }, [apprentices, certsByUser]);

  const [sendState, setSendState] = useState("idle");
  const sendReminders = async () => {
    setSendState("saving");
    try {
      await req("POST", "/api/admin/cert-reminder", {
        reminders: rows.map((r) => ({ userId: r.userId, certName: r.cert, exp: r.exp })),
      });
      setSendState("done");
    } catch {
      setSendState("error");
    }
  };

  if (rows.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>CERTIFICATIONS EXPIRING SOON</div>
        <button className="foc" onClick={sendReminders} disabled={sendState === "saving" || sendState === "done"}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: sendState === "done" ? C.working : C.gc, fontSize: 11.5, fontWeight: 700, padding: 0 }}>
          <Bell size={12} /> {sendState === "saving" ? "Sending…" : sendState === "done" ? "Sent" : "Send reminders"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
            <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: r.c, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{r.cert}</div>
              <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>{r.apprentice} · expires {r.exp}</div>
            </div>
            <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: r.c, border: "1px solid " + r.c + "55", borderRadius: 5, padding: "2px 6px" }}>{r.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- this week — read-only activity strip, no personal hours to show ---------- */
function ThisWeek({ shows, onOpenDay }) {
  const today = todayMid();
  const week = useMemo(() => {
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(sunday); d.setDate(sunday.getDate() + i); return d; });
  }, [today.getTime()]);

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "15px 16px", boxShadow: SHADOW, marginBottom: 16 }}>
      <div style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.lo, fontFamily: FM, marginBottom: 8 }}>THIS WEEK</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
        {week.map((d, i) => {
          const isToday = d.getTime() === today.getTime();
          const count = showsOn(shows, d).length;
          return (
            <button key={i} className="foc" onClick={onOpenDay}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 4px",
                borderRadius: 9, background: count ? "rgba(127,178,255,0.1)" : C.sunk,
                border: "1px solid " + (isToday ? C.brand : count ? "rgba(127,178,255,0.4)" : C.line),
              }}>
              <span style={{ fontFamily: FM, fontSize: 9, color: isToday ? C.brand : C.lo }}>{DOW[d.getDay()]}</span>
              <span style={{ fontFamily: FM, fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? C.brand : C.hi }}>{d.getDate()}</span>
              <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 800, color: count ? C.gc : C.lo }}>{count || "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- dashboard tab ---------- */
export function DashboardTab({ apprentices, monthsByUser, shows, classesByUser, certsByUser, onOpenApprentice, onOpenDay, onSelectShow, onChanged }) {
  // self-reported by PendingSignupsPanel below (it already fetches these
  // rows — this is a brand-new apprentice account waiting on approval, not
  // an OJT month waiting on review, so it gets its own stat rather than
  // folding into "PENDING APPROVALS" and reading as the same kind of thing.
  const [pendingSignups, setPendingSignups] = useState(null);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Stat label="APPRENTICES" value={String(apprentices.length)} color={C.gc} />
        <Stat label="NEW SIGNUPS" value={pendingSignups == null ? "—" : String(pendingSignups)}
          sub="to approve" color={pendingSignups ? C.brand : C.lo} />
        <Stat label="OJT PENDING" value={String(Object.values(monthsByUser).flat().filter((m) => m.status === "pending").length)}
          sub="months to review" color={C.brand} />
      </div>
      <PendingSignupsPanel onCountChange={setPendingSignups} />
      <ThisWeek shows={shows} onOpenDay={onOpenDay} />
      <OnTheFloorPanel shows={shows} onSelectShow={onSelectShow} />
      <RosterCategoryChart apprentices={apprentices} monthsByUser={monthsByUser} />
      <FallingBehindPanel apprentices={apprentices} monthsByUser={monthsByUser} onOpenApprentice={onOpenApprentice} />
      <DoNotHirePanel apprentices={apprentices} onOpenApprentice={onOpenApprentice} />
      <UpcomingClasses apprentices={apprentices} classesByUser={classesByUser} onOpenApprentice={onOpenApprentice} onChanged={onChanged} />
      <ExpiringCerts apprentices={apprentices} certsByUser={certsByUser} />
    </>
  );
}
