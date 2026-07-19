"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Ban, Check, X, Trash2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  C, SHADOW, FM, FS, hrsFmt, mMed, mShort, levelIndex, ojtTotals, ojtRows, rollupEntries, LEVELS, STATUS,
  certState, KLASS, todayMid, DOW, CATS_META, mKey, mParse, MONTHS, num, CAT_TOTAL, projectMonth, keyOf,
  mAdd, monthGrid, sameDay, bookingOn, classOn, BOOKED,
} from "@/lib/core";
import { ClassCurriculum } from "@/components/ojt/ClassCurriculum";
import { Avatar, Modal, ConfirmModal, req, Stat, PwField, shortDate, RosterCatTooltip, monthHours } from "@/components/admin/shared";

/* ---------- read-only calendar for one apprentice — same fill logic and
   color language as the apprentice's own CalTab (ShowBoard.jsx), just
   view-only and self-fetching (work_entries isn't part of the roster-wide
   load(), only needed once someone actually opens this tab). ---------- */
function AdminApprenticeCalendar({ entries, bookings, classes }) {
  const t0 = todayMid();
  const [cur, setCur] = useState({ y: t0.getFullYear(), m: t0.getMonth() });
  const [selectedKey, setSelectedKey] = useState(null);

  const cells = useMemo(() => monthGrid(cur.y, cur.m), [cur]);
  const step = (n) => { setSelectedKey(null); setCur((p) => { const d = new Date(p.y, p.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const isNow = cur.y === t0.getFullYear() && cur.m === t0.getMonth();

  const monthStats = useMemo(() => {
    if (!entries) return { hrs: 0, days: 0 };
    const prefix = cur.y + "-" + String(cur.m + 1).padStart(2, "0");
    let hrs = 0, days = 0;
    Object.keys(entries).forEach((k) => {
      if (k.indexOf(prefix) !== 0) return;
      const list = entries[k];
      if (!list.length) return;
      days++;
      list.forEach((e) => { hrs += e.hrs; });
    });
    return { hrs, days };
  }, [entries, cur]);

  if (entries === null) {
    return (
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  const selectedList = selectedKey ? (entries[selectedKey] || []) : [];
  const selectedBookings = selectedKey ? bookingOn(bookings, selectedKey) : [];
  const selectedClasses = selectedKey ? classOn(classes, selectedKey) : [];

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button className="foc icon-btn" onClick={() => step(-1)} aria-label="Previous month"
          style={{ width: 32, height: 32, borderRadius: 8, background: C.sunk, border: "1px solid " + C.line, color: C.hi, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={15} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 800, letterSpacing: 1, color: C.hi }}>{MONTHS[cur.m]} {cur.y}</div>
          {!isNow && (
            <button className="foc" onClick={() => { setSelectedKey(null); setCur({ y: t0.getFullYear(), m: t0.getMonth() }); }}
              style={{ background: "transparent", border: "none", color: C.brand, fontSize: 10.5, fontWeight: 700, padding: 0 }}>
              jump to today
            </button>
          )}
        </div>
        <button className="foc icon-btn" onClick={() => step(1)} aria-label="Next month"
          style={{ width: 32, height: 32, borderRadius: 8, background: C.sunk, border: "1px solid " + C.line, color: C.hi, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Stat label="HOURS" value={hrsFmt(monthStats.hrs)} color={monthStats.hrs ? C.working : C.lo} />
        <Stat label="DAYS WORKED" value={String(monthStats.days)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 5 }}>
        {DOW.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5, fontFamily: FM, fontWeight: 700, color: i === 0 || i === 6 ? C.lo : C.mid }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cur.m;
          const k = keyOf(d);
          const list = entries[k] || [];
          const hrs = list.reduce((a, e) => a + e.hrs, 0);
          const isToday = sameDay(d, t0);
          const classesToday = classOn(classes, k);
          const hasClass = classesToday.length > 0;
          const missedClass = classesToday.some((c) => (c.missedDates || []).indexOf(k) !== -1);
          const bookingsToday = bookingOn(bookings, k);
          const hasBook = bookingsToday.length > 0;
          const fill = hrs ? C.working : hasBook ? BOOKED : hasClass ? (missedClass ? C.danger : KLASS) : null;
          const isSelected = selectedKey === k;
          const label = hrs > 0 ? hrsFmt(hrs)
            : hasBook ? bookingsToday[0].co
              : hasClass ? (missedClass ? "MISSED" : "CLASS")
                : null;
          return (
            <button key={i} type="button" disabled={!inMonth}
              onClick={() => setSelectedKey(k === selectedKey ? null : k)}
              style={{
                aspectRatio: "1", borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                background: isSelected ? (fill || C.line) + "33" : fill ? fill + "22" : inMonth ? C.sunk : "transparent",
                border: "1px solid " + (isSelected ? (fill || C.brand) : isToday ? C.brand : fill ? fill + "55" : inMonth ? C.line : "transparent"),
                cursor: inMonth ? "pointer" : "default", padding: "2px 2px 3px", overflow: "hidden",
              }}>
              <span style={{ fontSize: 10.5, fontFamily: FM, fontWeight: isToday ? 800 : 600, color: inMonth ? (fill ? C.hi : C.mid) : C.line }}>{d.getDate()}</span>
              {label && (
                <span className="truncate" style={{ maxWidth: "100%", fontSize: 7.5, fontFamily: FM, fontWeight: 800, color: hrs > 0 ? C.working : fill, lineHeight: 1.1, padding: "0 1px" }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        {[["Worked", C.working], ["Scheduled", BOOKED], ["Class", KLASS]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 10.5, color: C.mid }}>{label}</span>
          </div>
        ))}
      </div>

      {selectedKey && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.line }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 8 }}>{selectedKey}</div>
          {selectedList.length === 0 && selectedBookings.length === 0 && selectedClasses.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on file this day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedList.map((e, i) => (
                <div key={"e" + i} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                  {e.cat && <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: CATS_META[e.cat].color + "22", border: "1px solid " + CATS_META[e.cat].color + "66", color: CATS_META[e.cat].color, fontFamily: FM, fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{e.cat}</span>}
                  <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>{e.co}</span>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 12, fontWeight: 800, color: C.working }}>{hrsFmt(e.hrs)}h</span>
                </div>
              ))}
              {selectedBookings.map((b, i) => (
                <div key={"b" + i} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: BOOKED, border: "1px solid " + BOOKED + "66", borderRadius: 5, padding: "2px 6px" }}>SCHED</span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>{b.co}{b.show ? " — " + b.show : ""}</span>
                </div>
              ))}
              {selectedClasses.map((c, i) => {
                const missed = (c.missedDates || []).indexOf(selectedKey) !== -1;
                return (
                  <div key={"c" + i} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                    <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: missed ? C.danger : KLASS, border: "1px solid " + (missed ? C.danger : KLASS) + "66", borderRadius: 5, padding: "2px 6px" }}>{missed ? "MISSED" : "CLASS"}</span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>{c.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- level + category progress — same numbers the apprentice sees
   on their own OJT tab, condensed for the admin's one-glance view ---------- */
function LevelAndCategoryProgress({ approved }) {
  const t = useMemo(() => ojtTotals(approved), [approved]);
  const idx = levelIndex(t.total);
  const lv = LEVELS[idx];
  const nxt = LEVELS[idx + 1];
  const avg = approved.length ? t.total / approved.length : 0;
  const lastMonth = approved[0]?.m || null;
  const toNext = nxt ? nxt.hrs - t.total : 0;
  const projNext = nxt ? projectMonth(toNext, avg, lastMonth) : null;
  const pct = nxt ? Math.max(2, Math.min(100, ((t.total - lv.hrs) / (nxt.hrs - lv.hrs)) * 100)) : 100;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 12, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 6, padding: "3px 8px" }}>{lv.k}</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{lv.label}</div>
        <div style={{ marginLeft: "auto", fontFamily: FM, fontSize: 11, color: C.mid }}>
          {hrsFmt(t.total)}{nxt ? " / ~" + nxt.hrs.toLocaleString() : ""}
        </div>
      </div>
      {nxt && (
        <>
          <div style={{ height: 7, borderRadius: 4, background: C.raise, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: C.brand, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", fontSize: 11, color: C.lo, marginTop: 6 }}>
            <span>{hrsFmt(toNext)} hrs to {nxt.k}</span>
            <span style={{ marginLeft: "auto" }}>{avg ? hrsFmt(avg) + " avg/mo" : "no pace yet"}{projNext ? " · ~" + mMed(projNext) : ""}</span>
          </div>
        </>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.line }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>CATEGORY HOURS</div>
          <div style={{ marginLeft: "auto", fontFamily: FM, fontSize: 10, color: C.lo }}>{hrsFmt(t.total)} / {CAT_TOTAL.toLocaleString()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["A", "B", "C", "D"].map((k) => {
            const meta = CATS_META[k];
            const v = t[k.toLowerCase()];
            const p = Math.min(100, (v / meta.target) * 100);
            return (
              <div key={k}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 5, background: meta.color + "22", border: "1px solid " + meta.color + "66", color: meta.color, fontFamily: FM, fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{k}</span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.mid }}>{meta.name}</span>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 11, color: v ? C.hi : C.lo, fontWeight: 700 }}>{hrsFmt(v)}</span>
                  <span style={{ flexShrink: 0, width: 34, textAlign: "right", fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: v ? meta.color : C.lo }}>{p.toFixed(0)}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.raise, overflow: "hidden", marginTop: 5 }}>
                  <div style={{ height: "100%", width: Math.max(v ? 2 : 0, p) + "%", background: meta.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- one apprentice's own monthly hours, current year, by category —
   same shape as the chart on their own dashboard, so admin sees exactly
   what they see ---------- */
function ApprenticeMonthlyChart({ months }) {
  const data = useMemo(() => {
    const approved = (months || []).filter((m) => m.status === "approved");
    const byMonth = {};
    approved.forEach((m) => { byMonth[m.m] = m; });
    // rolling 12-month window ending at the current month, not a bare
    // calendar year — same fix as the apprentice's own chart, otherwise
    // half the bars sit empty until December every year.
    const nowKey = mKey(todayMid().getFullYear(), todayMid().getMonth());
    const startKey = mAdd(nowKey, -11);
    const out = [];
    for (let i = 0; i < 12; i++) {
      const k = mAdd(startKey, i);
      const row = byMonth[k];
      const a = num(row?.a), b = num(row?.b), c = num(row?.c), d = num(row?.d);
      out.push({ k, label: MONTHS[mParse(k).m], a, b, c, d, total: a + b + c + d });
    }
    return out;
  }, [months]);

  const hasAny = data.some((d) => d.total > 0);
  if (!hasAny) {
    return (
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 6 }}>MONTHLY HOURS · LAST 12 MONTHS</div>
        <div style={{ fontSize: 12.5, color: C.lo }}>Nothing approved in the last 12 months.</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px 4px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>MONTHLY HOURS · {data.length > 0 ? mShort(data[0].k) + " – " + mShort(data[data.length - 1].k) : ""}</div>
        <div style={{ display: "flex", gap: 9, marginLeft: "auto" }}>
          {["A", "B", "C", "D"].map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: CATS_META[k].color }} />
              <span style={{ fontSize: 9.5, fontFamily: FM, color: C.lo }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <XAxis dataKey="label" axisLine={{ stroke: C.line }} tickLine={false}
              tick={{ fill: C.lo, fontSize: 9, fontFamily: FM }} dy={6} interval={0} />
            <YAxis hide domain={[0, "dataMax + 10"]} />
            <Tooltip content={<RosterCatTooltip />} cursor={{ fill: C.line, fillOpacity: 0.35 }} />
            {["a", "b", "c", "d"].map((k, i) => (
              <Bar key={k} dataKey={k} stackId="hrs" fill={CATS_META[k.toUpperCase()].color} stroke={C.panel} strokeWidth={1}
                radius={i === 3 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AddCertForm({ userId, onAdded, onClose }) {
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !exp) { setState("error"); setMsg("Needs a name and expiration date."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/certs", { userId, id: "cert" + Date.now().toString(36), name: name.trim(), exp });
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
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CERTIFICATION NAME</div>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OSHA 10"
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EXPIRES</div>
      <input type="date" required value={exp} onChange={(e) => setExp(e.target.value)}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 14 }} />

      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Adding…" : state === "done" ? "Added" : "Add certification"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

/* ---------- apprentice detail ---------- */
export function ApprenticeDetail({ apprentice, months, bookings, flags, classes, certs, shows, completedClasses, onAssignClass, onBack, onChanged }) {
  const archived = !!apprentice.archived_at;
  const expiredCerts = useMemo(() => (certs || []).filter((c) => certState(c.exp).t === "EXPIRED"), [certs]);

  // this apprentice's own day-to-day log (work_entries) — not part of the
  // roster-wide load(), only needed once someone opens History or Calendar
  // for this one person. Shared by both tabs so switching between them
  // doesn't re-fetch.
  const [entries, setEntries] = useState(null); // null = loading
  useEffect(() => {
    let live = true;
    setEntries(null);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("work_entries").select("*").eq("user_id", apprentice.id).order("worked_on");
      if (!live) return;
      const map = {};
      (data || []).forEach((row) => {
        (map[row.worked_on] = map[row.worked_on] || []).push({ co: row.company, cat: row.category, hrs: Number(row.hours) });
      });
      setEntries(map);
    })();
    return () => { live = false; };
  }, [apprentice.id]);
  const entriesRoll = useMemo(() => rollupEntries(entries || {}), [entries]);
  const [archiveState, setArchiveState] = useState("idle");
  const [archiveMsg, setArchiveMsg] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false); // "archive" | "restore" | "delete" | false
  const runArchiveAction = async (action) => {
    setArchiveState("saving");
    setArchiveMsg("");
    try {
      if (action === "delete") {
        await req("DELETE", "/api/admin/apprentices", { userId: apprentice.id });
      } else {
        await req("PATCH", "/api/admin/apprentices", { userId: apprentice.id, archived: action === "archive" });
      }
      setConfirmArchive(false);
      onChanged();
      onBack();
    } catch (e) {
      setArchiveState("error");
      setArchiveMsg(e.message);
    }
  };

  const onDnhList = !!apprentice.do_not_hire_at;
  const [dnhReason, setDnhReason] = useState("");
  const [dnhState, setDnhState] = useState("idle");
  const [dnhMsg, setDnhMsg] = useState("");
  const [confirmDnhRemove, setConfirmDnhRemove] = useState(false);
  const setDnh = async (onList, reason) => {
    setDnhState("saving");
    setDnhMsg("");
    try {
      await req("POST", "/api/admin/do-not-hire", { userId: apprentice.id, onList, reason });
      setDnhReason("");
      setConfirmDnhRemove(false);
      setDnhState("idle");
      onChanged();
    } catch (e) {
      setDnhState("error");
      setDnhMsg(e.message);
    }
  };

  const approved = useMemo(() => months.filter((m) => m.status === "approved").sort((a, b) => (a.m < b.m ? 1 : -1)), [months]);
  // ojtRows wants ascending (it's computing a running total as it goes) —
  // reverse back to newest-first for display, same as `approved` above
  const historyRows = useMemo(() => ojtRows(approved).slice().reverse(), [approved]);
  const pending = useMemo(() => months.filter((m) => m.status === "pending").sort((a, b) => (a.m < b.m ? -1 : 1)), [months]);
  const total = useMemo(() => ojtTotals(approved).total, [approved]);
  const idx = levelIndex(total);
  const lv = LEVELS[idx];

  const showById = useMemo(() => { const m = {}; (shows || []).forEach((s) => { m[s.id] = s; }); return m; }, [shows]);
  const flaggedShows = useMemo(() => (flags || [])
    .filter((f) => f.status === "working" || f.status === "target")
    .map((f) => ({ flag: f, show: showById[f.show_id] }))
    .filter((x) => x.show), [flags, showById]);

  const [profile, setProfile] = useState({
    name: apprentice.name || "", memberId: apprentice.member_id || "", last4: apprentice.ssn_last4 || "",
    local: apprentice.local || "IUPAT Local 831", joined: apprentice.joined_on || "", rsiCredits: apprentice.rsi_credits || 0,
    city: apprentice.city || "",
  });
  const [profileState, setProfileState] = useState("idle");
  const [profileMsg, setProfileMsg] = useState("");

  const [avatarState, setAvatarState] = useState("idle");
  const [avatarMsg, setAvatarMsg] = useState("");
  const uploadAvatar = async (file) => {
    setAvatarState("saving");
    setAvatarMsg("");
    try {
      const body = new FormData();
      body.append("userId", apprentice.id);
      body.append("file", file);
      const res = await fetch("/api/admin/avatar", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setAvatarState("done");
      onChanged();
    } catch (e) {
      setAvatarState("error");
      setAvatarMsg(e.message);
    }
  };
  const removeAvatar = async () => {
    setAvatarState("saving");
    setAvatarMsg("");
    try {
      await req("DELETE", "/api/admin/avatar", { userId: apprentice.id });
      setAvatarState("idle");
      onChanged();
    } catch (e) {
      setAvatarState("error");
      setAvatarMsg(e.message);
    }
  };

  const saveProfile = async () => {
    setProfileState("saving");
    setProfileMsg("");
    try {
      await req("POST", "/api/admin/profile", { userId: apprentice.id, ...profile, rsiCredits: Number(profile.rsiCredits) || 0 });
      setProfileState("done");
      setProfileMsg("Saved.");
      onChanged();
    } catch (e) {
      setProfileState("error");
      setProfileMsg(e.message);
    }
  };

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwState, setPwState] = useState("idle");
  const [pwMsg, setPwMsg] = useState("");
  const savePassword = async () => {
    if (pw.length < 8) { setPwState("error"); setPwMsg("At least 8 characters."); return; }
    if (pw !== pw2) { setPwState("error"); setPwMsg("Passwords don't match."); return; }
    setPwState("saving");
    setPwMsg("");
    try {
      await req("POST", "/api/admin/set-password", { userId: apprentice.id, password: pw });
      setPwState("done");
      setPwMsg("Password changed — they'll get an email.");
      setPw("");
      setPw2("");
    } catch (e) {
      setPwState("error");
      setPwMsg(e.message);
    }
  };

  const [welcomeState, setWelcomeState] = useState("idle");
  const resetWelcome = async () => {
    setWelcomeState("saving");
    try {
      await req("POST", "/api/admin/reset-welcome", { userId: apprentice.id });
      setWelcomeState("done");
    } catch (e) {
      setWelcomeState("error");
    }
  };

  const decide = async (m, status) => {
    await req("PATCH", "/api/admin/ojt-months", { userId: apprentice.id, m, status });
    onChanged();
  };

  const [newMonth, setNewMonth] = useState({ m: "", a: 0, b: 0, c: 0, d: 0 });
  const [monthMsg, setMonthMsg] = useState("");
  const addMonth = async () => {
    if (!/^\d{4}-\d{2}$/.test(newMonth.m)) { setMonthMsg("Month format: YYYY-MM"); return; }
    try {
      await req("POST", "/api/admin/ojt-months", {
        userId: apprentice.id, m: newMonth.m,
        a: Number(newMonth.a) || 0, b: Number(newMonth.b) || 0, c: Number(newMonth.c) || 0, d: Number(newMonth.d) || 0,
      });
      setNewMonth({ m: "", a: 0, b: 0, c: 0, d: 0 });
      setMonthMsg("");
      onChanged();
    } catch (e) {
      setMonthMsg(e.message);
    }
  };
  const removeMonth = async (m) => {
    await req("DELETE", "/api/admin/ojt-months", { userId: apprentice.id, m });
    onChanged();
  };

  const removeClass = async (id) => {
    await req("DELETE", "/api/admin/classes", { userId: apprentice.id, id });
    onChanged();
  };
  const [confirmRemoveClass, setConfirmRemoveClass] = useState(null); // class row, or null
  const [expandedClassId, setExpandedClassId] = useState(null);
  const toggleMissed = async (c, date) => {
    const missed = new Set(c.missedDates || []);
    if (missed.has(date)) missed.delete(date);
    else missed.add(date);
    await req("PATCH", "/api/admin/classes", { userId: apprentice.id, id: c.id, missedDates: Array.from(missed) });
    onChanged();
  };

  const [certModal, setCertModal] = useState(false);
  const removeCert = async (id) => {
    await req("DELETE", "/api/admin/certs", { userId: apprentice.id, id });
    onChanged();
  };
  const [confirmRemoveCert, setConfirmRemoveCert] = useState(null); // cert row, or null
  const [confirmRemoveMonth, setConfirmRemoveMonth] = useState(null); // month row, or null
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);

  // which curriculum classes are marked complete — off the apprentice's
  // official JATC Student Progress Report, matched by courseId.
  const completedSet = useMemo(() => new Set((completedClasses || []).map((c) => c.course_id)), [completedClasses]);
  const toggleCompletedClass = async (courseId) => {
    if (completedSet.has(courseId)) {
      await req("DELETE", "/api/admin/completed-classes", { userId: apprentice.id, courseId });
    } else {
      await req("POST", "/api/admin/completed-classes", { userId: apprentice.id, courseId });
    }
    onChanged();
  };

  const [detailTab, setDetailTab] = useState("overview");

  return (
    <div>
      <button className="foc" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.gc, fontSize: 13, fontWeight: 700, padding: "6px 0", marginBottom: 10 }}>
        <ChevronLeft size={16} /> Roster
      </button>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={apprentice.name} email={apprentice.email} avatarUrl={apprentice.avatar_url} size={52} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: C.hi }}>{apprentice.name || apprentice.email}</div>
            <div className="truncate" style={{ fontSize: 11, color: C.lo, fontFamily: FM, marginTop: 2 }}>{apprentice.email}</div>
            {apprentice.city && <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{apprentice.city}</div>}
          </div>
          {archived && (
            <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.mid, background: C.raise, border: "1px solid " + C.line, borderRadius: 6, padding: "4px 8px" }}>ARCHIVED</span>
          )}
          {onDnhList && (
            <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.danger, background: "rgba(232,146,124,0.14)", border: "1px solid " + C.danger + "66", borderRadius: 6, padding: "4px 8px" }}>DO NOT HIRE</span>
          )}
          <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 12, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 6, padding: "4px 8px" }}>{lv.k}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, background: C.panel, borderRadius: 11, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, marginBottom: 12, overflowX: "auto" }}>
        {[
          ["overview", "Overview"],
          ["history", "History"],
          ["calendar", "Calendar"],
          ["classes", "Classes & Certs"],
          ["settings", "Settings"],
        ].map(([k, label]) => (
          <button key={k} className="foc tab-btn" data-active={detailTab === k} onClick={() => setDetailTab(k)}
            style={{ flex: 1, whiteSpace: "nowrap", padding: "9px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 800, background: detailTab === k ? C.brand : "transparent", color: detailTab === k ? "#1A1206" : C.mid, border: "none" }}>
            {label}
          </button>
        ))}
      </div>

      {detailTab === "overview" && (
      <>
      {expiredCerts.length > 0 && (
        <button className="foc" onClick={() => setDetailTab("classes")}
          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: "rgba(232,146,124,0.08)", border: "1px solid " + C.danger + "55", borderRadius: 12, padding: "13px 15px", boxShadow: SHADOW, marginBottom: 12 }}>
          <AlertTriangle size={16} color={C.danger} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.danger }}>
              {expiredCerts.length} certification{expiredCerts.length === 1 ? "" : "s"} expired
            </div>
            <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
              {expiredCerts.map((c) => c.name + " · expired " + c.exp).join(" · ")}
            </div>
          </div>
          <ChevronRight size={15} color={C.danger} style={{ flexShrink: 0 }} />
        </button>
      )}
      {onDnhList && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(232,146,124,0.08)", border: "1px solid " + C.danger + "55", borderRadius: 12, padding: "13px 15px", boxShadow: SHADOW, marginBottom: 12 }}>
          <Ban size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.danger }}>On the do-not-hire list</div>
            {apprentice.do_not_hire_reason && <div style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{apprentice.do_not_hire_reason}</div>}
            <div style={{ fontSize: 10.5, color: C.lo, marginTop: 3, fontFamily: FM }}>since {apprentice.do_not_hire_at.slice(0, 10)}</div>
          </div>
          <button className="foc" onClick={() => setConfirmDnhRemove(true)}
            style={{ flexShrink: 0, background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700 }}>
            Remove
          </button>
        </div>
      )}
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 10 }}>APPRENTICE INFO</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["Member ID", apprentice.member_id],
            ["Last 4 SSN", apprentice.ssn_last4],
            ["Local", apprentice.local],
            ["Joined", apprentice.joined_on],
            ["RSI credits", apprentice.rsi_credits != null ? String(apprentice.rsi_credits) : null],
            ["Email", apprentice.email],
          ].map(([label, value]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.4, color: C.lo, fontFamily: FM, marginBottom: 2 }}>{label.toUpperCase()}</div>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: value ? C.hi : C.lo, fontFamily: label === "Last 4 SSN" || label === "Member ID" ? FM : undefined }}>
                {value || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="m4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Stat label="TOTAL OJT" value={hrsFmt(total)} sub={lv.label} color={C.working} />
        <Stat label="PENDING REVIEW" value={String(pending.length)} sub={pending.length ? "needs a decision" : "all caught up"} color={pending.length ? C.brand : C.lo} />
      </div>

      <LevelAndCategoryProgress approved={approved} />
      <ApprenticeMonthlyChart months={months} />

      {pending.length > 0 && (
        <div style={{ background: "rgba(255,176,32,0.07)", border: "1px solid rgba(255,176,32,0.3)", borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.brand, fontFamily: FM, marginBottom: 8 }}>PENDING REVIEW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((m) => (
              <div key={m.m} style={{ background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: FM, fontSize: 12.5, fontWeight: 800, color: C.hi }}>{mMed(m.m)}</div>
                    <div style={{ fontFamily: FM, fontSize: 10.5, color: C.mid, marginTop: 2 }}>
                      A {hrsFmt(m.a)} · B {hrsFmt(m.b)} · C {hrsFmt(m.c)} · D {hrsFmt(m.d)} · {hrsFmt(monthHours(m))}h total
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <button className="foc approve-btn" onClick={() => decide(m.m, "approved")}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: C.working, color: "#06120C", border: "none", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 800 }}>
                    <Check size={13} /> Approve
                  </button>
                  <button className="foc reject-btn" onClick={() => decide(m.m, "rejected")}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "transparent", color: C.danger, border: "1px solid " + C.line, borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 700 }}>
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>ON THE SCHEDULE</div>
        {bookings.length === 0 && flaggedShows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on the books yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {flaggedShows.map(({ flag, show }) => {
              const st = STATUS[flag.status];
              return (
                <div key={"flag-" + show.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 9, background: st.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{show.name}</div>
                    <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>{show.loc} · {show.co}{show.mi ? " · move-in " + show.mi : ""}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: st.color, border: "1px solid " + st.color + "55", borderRadius: 5, padding: "2px 6px" }}>{st.label.toUpperCase()}</span>
                </div>
              );
            })}
            {bookings.map((b) => {
              const dates = (b.dates || []).slice().sort();
              return (
                <div key={"bk-" + b.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{b.company}{b.show ? " — " + b.show : ""}</div>
                    <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>{dates.length} day{dates.length === 1 ? "" : "s"}{dates[0] ? " · " + dates[0] + (dates.length > 1 ? "–" + dates[dates.length - 1] : "") : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </>
      )}

      {detailTab === "history" && (
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>APPROVED HISTORY — {approved.length} MONTHS</div>
          <div style={{ fontSize: 9.5, color: C.lo, fontFamily: FM, marginLeft: "auto" }}>UNION vs APP-LOGGED</div>
        </div>
        {approved.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo }}>Nothing approved yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {historyRows.map((r) => {
              const app = entriesRoll[r.m];
              const delta = app ? Math.round((app.total - r.total) * 10) / 10 : 0;
              return (
                <div key={r.m} style={{ paddingBottom: 6, borderBottom: "1px solid " + C.line }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span style={{ fontFamily: FM, color: C.hi, width: 74, flexShrink: 0 }}>{mMed(r.m)}</span>
                    <span style={{ fontFamily: FM, color: C.mid, flex: 1 }}>A{hrsFmt(r.a)} B{hrsFmt(r.b)} C{hrsFmt(r.c)} D{hrsFmt(r.d)}</span>
                    <span style={{ fontFamily: FM, color: C.working, fontWeight: 800 }}>{hrsFmt(r.total)}h</span>
                    <button className="foc icon-btn" onClick={() => setConfirmRemoveMonth(r)} style={{ background: "transparent", border: "none", color: C.lo, padding: 2, borderRadius: 5 }}><Trash2 size={13} /></button>
                  </div>
                  {(r.crossed.length > 0 || (app && delta !== 0)) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                      {r.crossed.map((lv) => (
                        <span key={lv.k} style={{ fontFamily: FM, fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: C.brand, background: "rgba(255,176,32,0.13)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 5, padding: "2px 5px" }}>
                          CROSSED {lv.hrs.toLocaleString()} — {lv.k}
                        </span>
                      ))}
                      {app && delta !== 0 && (
                        <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 800, color: C.gc, background: "rgba(127,178,255,0.11)", border: "1px solid rgba(127,178,255,0.32)", borderRadius: 5, padding: "2px 5px" }}>
                          APP LOGGED {hrsFmt(app.total)} ({delta > 0 ? "+" : ""}{hrsFmt(delta)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.line }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>ADD / CORRECT A MONTH (lands approved)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input value={newMonth.m} onChange={(e) => setNewMonth((p) => ({ ...p, m: e.target.value }))} placeholder="YYYY-MM"
              style={{ width: 90, background: C.sunk, border: "1px solid " + C.line, borderRadius: 7, padding: "7px 8px", color: C.hi, fontSize: 12, fontFamily: FM }} />
            {["a", "b", "c", "d"].map((k) => (
              <input key={k} type="number" value={newMonth[k]} onChange={(e) => setNewMonth((p) => ({ ...p, [k]: e.target.value }))} placeholder={k.toUpperCase()}
                style={{ width: 52, background: C.sunk, border: "1px solid " + C.line, borderRadius: 7, padding: "7px 8px", color: C.hi, fontSize: 12, fontFamily: FM }} />
            ))}
            <button className="foc" onClick={addMonth} style={{ background: C.raise, color: C.hi, border: "1px solid " + C.line, borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 700 }}>Add</button>
          </div>
          {monthMsg && <div style={{ marginTop: 6, fontSize: 11.5, color: C.danger }}>{monthMsg}</div>}
        </div>
      </div>
      )}

      {detailTab === "calendar" && (
        <AdminApprenticeCalendar entries={entries} bookings={bookings} classes={classes} />
      )}

      {detailTab === "classes" && (
      <>
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: KLASS, fontFamily: FM }}>CLASSES</div>
          <button className="foc" onClick={onAssignClass} style={{ marginLeft: "auto", background: "transparent", border: "none", color: KLASS, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Assign</button>
        </div>
        {classes.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo }}>Nothing assigned yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {classes.map((c) => {
              const dates = (c.dates || []).slice().sort();
              const missedCount = (c.missedDates || []).length;
              const open = expandedClassId === c.id;
              return (
                <div key={c.id} style={{ background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, overflow: "hidden" }}>
                  <button
                    className="foc"
                    onClick={() => setExpandedClassId(open ? null : c.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", padding: "9px 10px", textAlign: "left" }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{c.name}</div>
                      <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>
                        {dates.length} day{dates.length === 1 ? "" : "s"}{dates[0] ? " · " + dates[0] : ""}{c.loc ? " · " + c.loc : ""}
                        {missedCount > 0 && " · " + missedCount + " missed"}
                      </div>
                    </div>
                    <ChevronDown size={14} color={C.lo} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none" }} />
                  </button>
                  {open && (
                    <div style={{ padding: "0 10px 10px" }}>
                      <div style={{ fontSize: 9.5, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 6 }}>TAP A DATE TO TOGGLE MISSED</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))", gap: 5, marginBottom: 10 }}>
                        {dates.map((d) => {
                          const missed = (c.missedDates || []).indexOf(d) !== -1;
                          return (
                            <button
                              key={d}
                              className="foc"
                              onClick={() => toggleMissed(c, d)}
                              title={missed ? "Marked missed — tap to revert" : "Attended — tap to mark missed"}
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                                background: missed ? C.danger + "14" : C.panel, border: "1px solid " + (missed ? C.danger + "66" : C.line),
                                borderRadius: 8, padding: "6px 4px", fontFamily: FM,
                              }}
                            >
                              <span style={{ fontSize: 11, fontWeight: 800, color: missed ? C.danger : C.hi }}>{shortDate(d)}</span>
                              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.3, color: missed ? C.danger : C.working }}>
                                {missed ? "MISSED" : "OK"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button className="foc" onClick={() => setConfirmRemoveClass(c)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.danger, fontSize: 11.5, fontWeight: 700, padding: 0 }}>
                        <Trash2 size={13} /> Remove class
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.gc, fontFamily: FM }}>CERTIFICATIONS</div>
          <button className="foc" onClick={() => setCertModal(true)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.gc, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Add</button>
        </div>
        {certs.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on file yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {certs.map((c) => {
              const st = certState(c.exp);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
                  <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: st.c, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{c.name}</div>
                    <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>Expires {c.exp}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: st.c, border: "1px solid " + st.c + "55", borderRadius: 5, padding: "2px 6px" }}>{st.t}</span>
                  <button className="foc icon-btn" onClick={() => setConfirmRemoveCert(c)} style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0 }}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: KLASS, fontFamily: FM, marginBottom: 9 }}>CLASS CURRICULUM</div>
        <ClassCurriculum completed={completedSet} onToggle={toggleCompletedClass} />
      </div>

      {certModal && (
        <Modal title="Add certification" onClose={() => setCertModal(false)}>
          <AddCertForm userId={apprentice.id} onAdded={onChanged} onClose={() => setCertModal(false)} />
        </Modal>
      )}
      {confirmRemoveClass && (
        <ConfirmModal
          title="Remove class?"
          message={<>This removes <strong style={{ color: C.hi }}>{confirmRemoveClass.name}</strong> and its attendance record from {apprentice.name || apprentice.email}. If they just missed a day or two, mark those dates missed instead — that keeps the class on file.</>}
          confirmLabel="Remove class"
          onClose={() => setConfirmRemoveClass(null)}
          onConfirm={async () => { await removeClass(confirmRemoveClass.id); setConfirmRemoveClass(null); }}
        />
      )}
      {confirmRemoveMonth && (
        <ConfirmModal
          title="Remove this month?"
          message={<>This deletes the <strong style={{ color: C.hi }}>{mMed(confirmRemoveMonth.m)}</strong> OJT record ({hrsFmt(confirmRemoveMonth.total)}h) from {apprentice.name || apprentice.email}'s history — approved or not, it's gone.</>}
          confirmLabel="Remove month"
          onClose={() => setConfirmRemoveMonth(null)}
          onConfirm={async () => { await removeMonth(confirmRemoveMonth.m); setConfirmRemoveMonth(null); }}
        />
      )}
      {confirmRemoveCert && (
        <ConfirmModal
          title="Remove this certification?"
          message={<>This removes <strong style={{ color: C.hi }}>{confirmRemoveCert.name}</strong> (expires {confirmRemoveCert.exp}) from {apprentice.name || apprentice.email}'s record.</>}
          confirmLabel="Remove cert"
          onClose={() => setConfirmRemoveCert(null)}
          onConfirm={async () => { await removeCert(confirmRemoveCert.id); setConfirmRemoveCert(null); }}
        />
      )}
      {confirmRemoveAvatar && (
        <ConfirmModal
          title="Remove photo?"
          message={<>Removes {apprentice.name || apprentice.email}'s ID photo. They (or an admin) can upload a new one anytime.</>}
          confirmLabel="Remove photo"
          onClose={() => setConfirmRemoveAvatar(false)}
          onConfirm={async () => { await removeAvatar(); setConfirmRemoveAvatar(false); }}
        />
      )}
      </>
      )}

      {detailTab === "settings" && (
      <>
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>ID PHOTO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={apprentice.name} email={apprentice.email} avatarUrl={apprentice.avatar_url} size={56} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="foc" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.raise, color: C.hi, border: "1px solid " + C.line, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {avatarState === "saving" ? "Uploading…" : apprentice.avatar_url ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                disabled={avatarState === "saving"}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
            </label>
            {apprentice.avatar_url && (
              <button className="foc" onClick={() => setConfirmRemoveAvatar(true)} disabled={avatarState === "saving"}
                style={{ background: "transparent", color: C.danger, border: "1px solid " + C.line, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700 }}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        {avatarMsg && <div style={{ marginTop: 8, fontSize: 11.5, color: C.danger }}>{avatarMsg}</div>}
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>PROFILE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["name", "Name"], ["memberId", "Member ID"], ["last4", "Last 4 SSN"], ["local", "Local"], ["joined", "Joined (YYYY-MM-DD)"], ["rsiCredits", "RSI credits"], ["city", "Home city"],
          ].map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 110, flexShrink: 0, fontSize: 11.5, color: C.mid }}>{label}</span>
              <input value={profile[k]} onChange={(e) => setProfile((p) => ({ ...p, [k]: e.target.value }))}
                style={{ flex: 1, minWidth: 0, background: C.sunk, border: "1px solid " + C.line, borderRadius: 7, padding: "7px 9px", color: C.hi, fontSize: 12.5 }} />
            </div>
          ))}
        </div>
        <button className="foc" onClick={saveProfile} disabled={profileState === "saving"}
          style={{ width: "100%", marginTop: 12, background: profileState === "done" ? C.working : C.brand, color: profileState === "done" ? "#06120C" : "#1A1206", border: "none", borderRadius: 8, padding: "10px", fontWeight: 800, fontSize: 13 }}>
          {profileState === "saving" ? "Saving…" : profileState === "done" ? "Saved" : "Save profile"}
        </button>
        {profileMsg && <div style={{ marginTop: 7, fontSize: 11.5, color: profileState === "error" ? C.danger : C.working }}>{profileMsg}</div>}
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>CHANGE THEIR PASSWORD</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <PwField value={pw} onChange={(e) => { setPw(e.target.value); setPwState("idle"); }} placeholder="new password (8+ characters)" />
          <PwField value={pw2} onChange={(e) => { setPw2(e.target.value); setPwState("idle"); }} placeholder="retype password" />
          <button className="foc" onClick={savePassword} disabled={pwState === "saving" || !pw || !pw2}
            style={{ background: pwState === "done" ? C.working : C.raise, color: pwState === "done" ? "#06120C" : C.hi, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700 }}>
            {pwState === "saving" ? "Saving…" : pwState === "done" ? "Set" : "Set password"}
          </button>
        </div>
        {pwMsg && <div style={{ marginTop: 7, fontSize: 11.5, color: pwState === "error" ? C.danger : C.working }}>{pwMsg}</div>}
        <div style={{ fontSize: 10.5, color: C.lo, marginTop: 8, lineHeight: 1.5 }}>
          They'll get an email confirming the change. Use this for a forgotten password or their initial temp password.
        </div>
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginTop: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>WELCOME MESSAGE</div>
        <button className="foc" onClick={resetWelcome} disabled={welcomeState === "saving"}
          style={{ width: "100%", background: welcomeState === "done" ? C.working : C.raise, color: welcomeState === "done" ? "#06120C" : C.hi, border: "1px solid " + C.line, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, fontWeight: 700 }}>
          {welcomeState === "saving" ? "Resetting…" : welcomeState === "done" ? "They'll see it next login" : "Show welcome message again"}
        </button>
        {welcomeState === "error" && <div style={{ marginTop: 7, fontSize: 11.5, color: C.danger }}>Couldn't reset it — try again.</div>}
        <div style={{ fontSize: 10.5, color: C.lo, marginTop: 8, lineHeight: 1.5 }}>
          The 4-tab rundown and OJT-history nudge they saw on first login. Use this if they missed it, or need
          pointing back to the OJT-backfill upload after a support call.
        </div>
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.danger + "44", borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginTop: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.danger, fontFamily: FM, marginBottom: 9 }}>DO NOT HIRE LIST</div>
        {onDnhList ? (
          <>
            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 10 }}>
              On the list since {apprentice.do_not_hire_at.slice(0, 10)}{apprentice.do_not_hire_reason ? " — " + apprentice.do_not_hire_reason : ""}.
            </div>
            <button className="foc" onClick={() => setConfirmDnhRemove(true)} disabled={dnhState === "saving"}
              style={{ width: "100%", padding: "9px 14px", borderRadius: 8, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontSize: 12.5, fontWeight: 700 }}>
              Remove from do-not-hire list
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 10 }}>
              Late OJT paperwork, a missed mandatory class, or a Rules & Regs violation — puts them on the union's do-not-hire list. They'll see it on their own account and get a notification.
            </div>
            <textarea value={dnhReason} onChange={(e) => setDnhReason(e.target.value)} placeholder="Reason (required)" rows={2}
              style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 10px", color: C.hi, fontSize: 12.5, fontFamily: FS, resize: "vertical", marginBottom: 8 }} />
            <button className="foc" onClick={() => setDnh(true, dnhReason.trim())} disabled={dnhState === "saving" || !dnhReason.trim()}
              style={{ width: "100%", padding: "9px 14px", borderRadius: 8, background: "transparent", color: C.danger, border: "1px solid " + C.danger + "66", fontSize: 12.5, fontWeight: 700, opacity: dnhReason.trim() ? 1 : 0.6 }}>
              Put on do-not-hire list
            </button>
          </>
        )}
        {dnhMsg && <div style={{ marginTop: 8, fontSize: 11.5, color: C.danger }}>{dnhMsg}</div>}
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.danger + "44", borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginTop: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.danger, fontFamily: FM, marginBottom: 9 }}>DANGER ZONE</div>
        {archived ? (
          <>
            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 10 }}>
              Archived — hidden from the active roster. All their hours, classes, and history are still on file.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="foc" onClick={() => setConfirmArchive("restore")}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 8, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontSize: 12.5, fontWeight: 700 }}>
                Restore to roster
              </button>
              <button className="foc" onClick={() => setConfirmArchive("delete")}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "transparent", color: C.danger, border: "1px solid " + C.danger + "66", fontSize: 12.5, fontWeight: 700 }}>
                <Trash2 size={13} /> Delete permanently
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 10 }}>
              Archiving moves them off the active roster but keeps every record on file — restore anytime. Permanent deletion is only available once they're archived.
            </div>
            <button className="foc" onClick={() => setConfirmArchive("archive")}
              style={{ width: "100%", padding: "9px 14px", borderRadius: 8, background: "transparent", color: C.danger, border: "1px solid " + C.danger + "66", fontSize: 12.5, fontWeight: 700 }}>
              Archive apprentice
            </button>
          </>
        )}
        {archiveMsg && <div style={{ marginTop: 8, fontSize: 11.5, color: C.danger }}>{archiveMsg}</div>}
      </div>
      </>
      )}

      {confirmArchive === "archive" && (
        <ConfirmModal
          title="Archive apprentice?"
          message={<>{apprentice.name || apprentice.email} will drop off the active roster and out of class/booking assignment lists. Everything on file — hours, classes, certs — stays put, and you can restore them anytime from the archive.</>}
          confirmLabel="Archive"
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => runArchiveAction("archive")}
        />
      )}
      {confirmArchive === "restore" && (
        <ConfirmModal
          title="Restore to roster?"
          message={<>{apprentice.name || apprentice.email} will show up in the active roster again, same as before they were archived.</>}
          confirmLabel="Restore"
          danger={false}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => runArchiveAction("restore")}
        />
      )}
      {confirmArchive === "delete" && (
        <ConfirmModal
          title="Delete permanently?"
          message={<>This permanently deletes {apprentice.name || apprentice.email}'s account and every record — hours, classes, certs, bookings. <strong style={{ color: C.danger }}>This can't be undone.</strong></>}
          confirmLabel="Delete permanently"
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => runArchiveAction("delete")}
        />
      )}
      {confirmDnhRemove && (
        <ConfirmModal
          title="Remove from do-not-hire list?"
          message={<>{apprentice.name || apprentice.email} will be cleared from the do-not-hire list and notified.</>}
          confirmLabel="Remove"
          danger={false}
          onClose={() => setConfirmDnhRemove(false)}
          onConfirm={() => setDnh(false, null)}
        />
      )}
    </div>
  );
}
