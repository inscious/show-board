"use client";

/* Admin console — a genuinely separate experience from the apprentice
   dashboard (components/ShowBoard.jsx), not just extra buttons bolted onto
   it. Roster of apprentices (profile + OJT progress, editable), pending
   OJT-month approvals, and shared schedule management. */
import React, { useState, useEffect, useMemo } from "react";
import {
  HardHat, Users, CalendarDays, Plus, Upload, ChevronRight, ChevronLeft, ChevronDown,
  Check, X, Trash2, Eye, EyeOff, Lock, Mail, GraduationCap, LayoutDashboard, Settings as SettingsIcon, ShieldCheck,
  Search, AlertTriangle, Ban, Archive as ArchiveIcon, TrendingDown, Bell, Pencil, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS, hrsFmt, mMed, mShort, levelIndex, ojtTotals, ojtRows, rollupEntries, LEVELS, money, STATUS, REGION, sortDate, monthLabel, monthKey, isPast, certState, KLASS, todayMid, DOW, showsOn, CATS_META, countdown, mKey, mParse, MONTHS, num, CAT_TOTAL, projectMonth, keyOf, fromKey, fmtClock, mAdd, monthGrid, sameDay, bookingOn, classOn, BOOKED } from "@/lib/core";
import { ShowForm, ImportForm, EMPTY } from "@/components/ShowEditor";
import { OnTheFloorPanel } from "@/components/admin/OnTheFloorPanel";
import { AdminAccountsPanel } from "@/components/admin/AdminAccountsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { CompanyDirectoryPanel } from "@/components/admin/CompanyDirectoryPanel";
import { JatcContactsPanel } from "@/components/admin/JatcContactsPanel";
import { Avatar, Modal, ConfirmModal, req } from "@/components/admin/shared";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

/* ---------- small shared bits (duplicated from ShowBoard.jsx on purpose —
   this file is a separate surface, not worth wiring a shared-imports refactor for) ---------- */
function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "15px 16px", boxShadow: SHADOW, minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: 0.8, color: C.lo, fontFamily: FM }}>{label}</div>
      <div className="truncate" style={{ fontFamily: FM, fontSize: 22, fontWeight: 800, color: color || C.hi, lineHeight: 1.2, marginTop: 1 }}>{value}</div>
      {sub && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PwField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 34px 9px 10px", color: C.hi, fontSize: 12.5 }} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide" : "Show"}
        style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: C.lo, padding: 2, display: "flex" }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// "2026-07-27" -> "Jul 27" — compact date for the class chip grid, presentation-only
function shortDate(d) {
  const [, mo, day] = String(d).split("-").map(Number);
  return (MONTHS[mo - 1] || "").charAt(0) + MONTHS[mo - 1].slice(1).toLowerCase() + " " + day;
}

function groupByUser(rows) {
  const m = {};
  (rows || []).forEach((r) => { (m[r.user_id] = m[r.user_id] || []).push(r); });
  return m;
}
function monthHours(m) { return Number(m.a || 0) + Number(m.b || 0) + Number(m.c || 0) + Number(m.d || 0); }

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

/* ---------- apprentice detail ---------- */
function ApprenticeDetail({ apprentice, months, bookings, flags, classes, certs, shows, onAssignClass, onBack, onChanged }) {
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
                    <button className="foc icon-btn" onClick={() => removeMonth(r.m)} style={{ background: "transparent", border: "none", color: C.lo, padding: 2, borderRadius: 5 }}><Trash2 size={13} /></button>
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
                  <button className="foc icon-btn" onClick={() => removeCert(c.id)} style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0 }}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
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
              <button className="foc" onClick={removeAvatar} disabled={avatarState === "saving"}
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

/* ---------- new apprentice ---------- */
function NewApprenticeForm({ onCreated, onClose }) {
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
function AssignClassForm({ apprentices, preselected, onAssigned, onClose }) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
        {apprentices.map((a) => (
          <button key={a.id} type="button" onClick={() => toggle(a.id)}
            style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: C.sunk, border: "1px solid " + (selected.has(a.id) ? C.brand + "88" : C.line), borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid " + C.line, background: selected.has(a.id) ? C.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {selected.has(a.id) && <Check size={11} color="#1A1206" />}
            </span>
            <span className="truncate" style={{ fontSize: 13, color: C.hi }}>{a.name || a.email}</span>
          </button>
        ))}
      </div>

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
function BulkDnhForm({ apprentices, onDone, onClose }) {
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
      await Promise.all(Array.from(selected).map((userId) =>
        req("POST", "/api/admin/do-not-hire", { userId, onList: true, reason: reason.trim() })));
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
            {apprentices.map((a) => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: C.sunk, border: "1px solid " + (selected.has(a.id) ? C.danger + "88" : C.line), borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid " + C.line, background: selected.has(a.id) ? C.danger : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.has(a.id) && <Check size={11} color="#2A0E0A" />}
                </span>
                <span className="truncate" style={{ fontSize: 13, color: C.hi }}>{a.name || a.email}</span>
              </button>
            ))}
          </div>
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
function BulkArchiveForm({ apprentices, onDone, onClose }) {
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
      await Promise.all(Array.from(selected).map((userId) =>
        req("PATCH", "/api/admin/apprentices", { userId, archived: true })));
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 260, overflowY: "auto" }}>
            {apprentices.map((a) => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: C.sunk, border: "1px solid " + (selected.has(a.id) ? C.brand + "88" : C.line), borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid " + C.line, background: selected.has(a.id) ? C.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.has(a.id) && <Check size={11} color="#1A1206" />}
                </span>
                <span className="truncate" style={{ fontSize: 13, color: C.hi }}>{a.name || a.email}</span>
              </button>
            ))}
          </div>
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
   rarely-visited list) — archived date is the useful thing to see here. ---------- */
function ArchivedRoster({ apprentices, onSelect }) {
  const rows = useMemo(() => apprentices.slice()
    .sort((x, y) => (y.archived_at || "").localeCompare(x.archived_at || "")), [apprentices]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {rows.map((a) => (
        <button key={a.id} className="foc roster-row" onClick={() => onSelect(a.id)}
          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: C.sunk, border: "1px solid " + C.line, borderRadius: 12, padding: "13px 15px", opacity: 0.8 }}>
          <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} size={34} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.mid }}>{a.name || a.email}</div>
            <div className="truncate" style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>
              archived {a.archived_at ? a.archived_at.slice(0, 10) : "—"}
            </div>
          </div>
          <ChevronRight size={16} color={C.lo} style={{ flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}

/* ---------- roster hours by category — lifetime composition per apprentice,
   from months already loaded in state (no extra fetch) ---------- */
function RosterCatTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: C.raise, border: "1px solid " + C.line, borderRadius: 8, padding: "8px 10px", boxShadow: SHADOW }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.hi, marginBottom: row.level || row.joined ? 0 : 4 }}>{row.fullName || label}</div>
      {(row.level || row.joined) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: FM, color: C.mid, marginBottom: 5, marginTop: 1 }}>
          {row.level && <span style={{ color: C.brand, fontWeight: 800 }}>{row.level}</span>}
          {row.joined && <span>joined {row.joined}</span>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {["a", "b", "c", "d"].filter((k) => row[k] > 0).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: FM }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: CATS_META[k.toUpperCase()].color, flexShrink: 0 }} />
            <span style={{ color: C.mid, flex: 1 }}>{k.toUpperCase()}</span>
            <span style={{ color: C.hi, fontWeight: 700 }}>{hrsFmt(row[k])}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

/* ---------- one apprentice's own monthly hours, current year, by category —
   same shape as the chart on their own dashboard, so admin sees exactly
   what they see ---------- */
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 260, overflowY: "auto" }}>
            {candidates.map((a) => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: C.sunk, border: "1px solid " + (selected.has(a.id) ? C.brand + "88" : C.line), borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid " + C.line, background: selected.has(a.id) ? C.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.has(a.id) && <Check size={11} color="#1A1206" />}
                </span>
                <span className="truncate" style={{ fontSize: 13, color: C.hi }}>{a.name || a.email}</span>
              </button>
            ))}
          </div>
          <button type="submit" disabled={state === "saving"}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
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
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
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

/* ---------- certs expiring across the whole roster — filters certsByUser
   that's already loaded, no extra fetch either ---------- */
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

/* ---------- settings: create a brand-new admin account. Admins are always
   their own accounts — never an apprentice promoted in place — so this
   mirrors NewApprenticeForm but hits create-admin, which sets is_admin from
   the moment the account exists. It never touches (or appears on) the
   roster, since load() only ever pulls is_admin = false profiles. ---------- */
function NewAdminForm({ onCreated }) {
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
      await req("POST", "/api/admin/create-admin", { email: email.trim().toLowerCase(), password: pw, name: name.trim() || undefined });
      setState("done");
      setEmail(""); setName(""); setPw("");
      onCreated();
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CREATE ADMIN ACCOUNT</div>
      <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
        Admins are always their own separate account, never an apprentice promoted in place — this one won't appear on the roster or have OJT hours of its own.
      </div>
      <form onSubmit={submit}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NAME (optional)</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Admin"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TEMP PASSWORD</div>
        <div style={{ marginBottom: 14 }}>
          <PwField value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters — tell them this directly" />
        </div>
        <button type="submit" disabled={state === "saving" || !email.trim() || !pw}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
          <ShieldCheck size={15} /> {state === "saving" ? "Creating…" : state === "done" ? "Admin account created" : "Create admin account"}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
      </form>
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

/* ---------- schedule ---------- */
function Schedule({ shows, onChanged, focusId, onFocusHandled }) {
  const [modal, setModal] = useState(null); // "add" | "edit" | "import"
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // monthLabel -> bool, overrides the default
  const [expandedId, setExpandedId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  /* landing here from "On the floor today" (a show tapped on the dashboard)
     — clear any filter that could be hiding it, force its month group open
     even if it was previously collapsed, expand the show itself, and scroll
     it into view once the DOM reflects that. */
  useEffect(() => {
    if (!focusId) return;
    const target = shows.find((s) => s.id === focusId);
    if (target) {
      setQ("");
      setRegionFilter("");
      setCollapsed((prev) => ({ ...prev, [monthLabel(target)]: false }));
      setExpandedId(focusId);
      requestAnimationFrame(() => {
        document.getElementById("show-" + focusId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    onFocusHandled?.();
  }, [focusId]);

  const regionsPresent = useMemo(() => Array.from(new Set(shows.map((s) => s.region).filter(Boolean))), [shows]);
  const filteredShows = useMemo(() => shows.filter((s) => {
    if (regionFilter && s.region !== regionFilter) return false;
    if (q.trim()) {
      const hay = (s.name + " " + (s.loc || "") + " " + (s.co || "")).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [shows, regionFilter, q]);
  const anyFilterActive = regionFilter || q.trim();
  const inputStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px", color: C.hi, fontSize: 12.5, fontFamily: FS };

  const genId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const saveOne = async (d) => {
    await req("POST", "/api/shows", { id: editing?.id || genId("u"), ...d });
    setModal(null);
    setEditing(null);
    onChanged();
  };
  const removeShow = async (id) => {
    await req("DELETE", "/api/shows", { id });
    onChanged();
  };
  const addImported = async (rows) => {
    const withIds = rows.map((r, i) => ({ id: genId("i") + i, ...r }));
    await req("POST", "/api/shows/import", { shows: withIds });
    onChanged();
  };

  // grouped by month, chronological — past months start collapsed so a
  // season's worth of history doesn't bury what's coming up.
  const groups = useMemo(() => {
    const sorted = filteredShows.slice().sort((a, b) => sortDate(a) - sortDate(b));
    const byMonth = {};
    sorted.forEach((s) => {
      const label = monthLabel(s);
      (byMonth[label] = byMonth[label] || { key: monthKey(s), label, list: [] }).list.push(s);
    });
    return Object.values(byMonth).sort((a, b) => a.key - b.key);
  }, [filteredShows]);

  // one toggle for the whole block of past months instead of a wall of
  // individually-collapsed rows — each stays independently expandable once revealed
  const { pastGroups, currentGroups } = useMemo(() => {
    const past = [], current = [];
    groups.forEach((g) => (g.list.every(isPast) ? past : current).push(g));
    return { pastGroups: past, currentGroups: current };
  }, [groups]);
  const pastShowCount = useMemo(() => pastGroups.reduce((s, g) => s + g.list.length, 0), [pastGroups]);

  const renderGroup = (g) => {
    const allPast = g.list.every(isPast);
    const isOpen = !(collapsed[g.label] ?? allPast);
    return (
      <div key={g.label}>
        <button className="foc tab-btn" onClick={() => setCollapsed((p) => ({ ...p, [g.label]: !(p[g.label] ?? allPast) }))}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "6px 2px", color: allPast ? C.lo : C.hi }}>
          <ChevronRight size={14} color={C.lo} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, fontFamily: FM }}>{g.label.toUpperCase()}</span>
          <span style={{ fontSize: 10.5, color: C.lo, fontFamily: FM }}>{g.list.length}</span>
          {allPast && <span style={{ fontSize: 9.5, fontFamily: FM, color: C.lo, marginLeft: "auto" }}>PAST</span>}
        </button>
        {isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {g.list.map((s) => {
              const past = isPast(s);
              const region = REGION[s.region] || REGION.OTHER;
              const open = expandedId === s.id;
              const cd = !past ? countdown(s) : null;
              return (
                <div key={s.id} id={"show-" + s.id} style={{ background: C.panel, border: "1px solid " + (open ? C.brand + "66" : C.edge), borderRadius: 10, opacity: past ? 0.55 : 1, overflow: "hidden" }}>
                  <button className="foc" onClick={() => setExpandedId(open ? null : s.id)}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: "10px 12px" }}>
                    <div style={{ flexShrink: 0, width: 38, textAlign: "center" }}>
                      <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 800, color: past ? C.mid : C.brand, lineHeight: 1.1 }}>{s.mi || s.start || "—"}</div>
                      <div style={{ fontFamily: FM, fontSize: 7.5, color: C.mid, marginTop: 1 }}>{s.mi ? "MOVE IN" : "START"}</div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: past ? C.mid : C.hi }}>{s.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 800, color: region.color, background: region.color + "1C", border: "1px solid " + region.color + "55", borderRadius: 5, padding: "1px 5px" }}>{region.label}</span>
                        <span className="truncate" style={{ fontSize: 10.5, color: C.mid }}>{s.loc}{s.co ? " · " + s.co : ""}</span>
                      </div>
                    </div>
                    {cd && (
                      <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: cd.c, border: "1px solid " + cd.c + "55", borderRadius: 5, padding: "2px 6px" }}>
                        {cd.t}
                      </span>
                    )}
                    <ChevronRight size={15} color={C.mid} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                  </button>
                  {open && (
                    <div style={{ padding: "0 12px 12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <Stat label="MOVE IN" value={s.mi || "—"} />
                        <Stat label="START" value={s.start || "—"} />
                        <Stat label="END" value={s.end || "—"} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: C.mid, marginBottom: 12 }}>
                        <div><span style={{ color: C.lo }}>Location</span> · {s.loc || "—"}{s.booth ? " · Booth " + s.booth : ""}</div>
                        <div><span style={{ color: C.lo }}>General contractor</span> · {s.co || "—"}</div>
                        <div><span style={{ color: C.lo }}>Source</span> · {s.src || "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="foc" onClick={() => { setEditing(s); setModal("edit"); }}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontSize: 13, fontWeight: 700 }}>Edit</button>
                        <button className="foc" onClick={() => removeShow(s.id)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "transparent", color: C.danger, border: "1px solid " + C.line, fontSize: 13, fontWeight: 700 }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="foc" onClick={() => { setEditing(null); setModal("add"); }}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
          <Plus size={15} /> Add show
        </button>
        <button className="foc" onClick={() => setModal("import")}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 13.5, boxShadow: "0 4px 14px rgba(255,176,32,0.22)" }}>
          <Upload size={15} /> Import schedule
        </button>
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ position: "relative", marginBottom: regionsPresent.length > 0 ? 8 : 0 }}>
          <Search size={14} color={C.lo} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search show, location, or company…"
            style={{ ...inputStyle, width: "100%", padding: "8px 10px 8px 30px" }} />
        </div>
        {regionsPresent.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }}>
              <option value="">All regions</option>
              {regionsPresent.map((r) => <option key={r} value={r}>{(REGION[r] || REGION.OTHER).label}</option>)}
            </select>
            {anyFilterActive && (
              <button className="foc" onClick={() => { setQ(""); setRegionFilter(""); }}
                style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: "8px 12px", borderRadius: 9, background: "transparent", color: C.lo, border: "1px solid " + C.line }}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {currentGroups.length === 0 && pastGroups.length === 0 && (
          <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No shows match these filters.</div>
        )}
        {currentGroups.map(renderGroup)}

        {pastGroups.length > 0 && (
          <button className="foc" onClick={() => setShowPast((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.panel, border: "1px solid " + C.edge, borderRadius: 10, padding: "11px 13px", color: C.mid, fontSize: 12.5, fontWeight: 700 }}>
            <ChevronRight size={14} color={C.lo} style={{ transform: showPast ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
            {showPast ? "Hide" : "Show"} {pastGroups.length} past month{pastGroups.length === 1 ? "" : "s"}
            <span style={{ marginLeft: "auto", fontFamily: FM, fontSize: 11, color: C.lo }}>{pastShowCount} shows</span>
          </button>
        )}

        {showPast && pastGroups.map(renderGroup)}
      </div>

      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "edit" ? "Edit show" : "Add show"} onClose={() => setModal(null)}>
          <ShowForm initial={editing ? { ...EMPTY, ...editing } : undefined} onClose={() => setModal(null)} onSave={saveOne} />
        </Modal>
      )}
      {modal === "import" && (
        <Modal title="Import from schedule" onClose={() => setModal(null)}>
          <ImportForm onClose={() => setModal(null)} onAdd={addImported} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- shell ---------- */
export default function AdminBoard() {
  const [state, setState] = useState("loading"); // loading | ready
  const [email, setEmail] = useState(null);
  const [apprentices, setApprentices] = useState([]);
  const [monthsByUser, setMonthsByUser] = useState({});
  const [bookingsByUser, setBookingsByUser] = useState({});
  const [flagsByUser, setFlagsByUser] = useState({});
  const [classesByUser, setClassesByUser] = useState({});
  const [certsByUser, setCertsByUser] = useState({});
  const [shows, setShows] = useState([]);
  const [tab, setTab] = useState("dashboard"); // dashboard | roster | schedule | settings
  const [selectedId, setSelectedId] = useState(null);
  const [scheduleFocusId, setScheduleFocusId] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [classModal, setClassModal] = useState(false); // false | array of preselected userIds
  const [dnhModal, setDnhModal] = useState(false);
  const [bulkArchiveModal, setBulkArchiveModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = async () => {
    const supabase = createClient();
    // bookings/show_flags/classes each need their own "admin read"/"admin
    // write" RLS policy (see supabase/schema.sql) — until those are applied
    // they just come back empty and the relevant section quietly shows nothing.
    const [profilesRes, monthsRes, showsRes, bookingsRes, flagsRes, classesRes, certsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_admin", false),
      supabase.from("ojt_months").select("*"),
      supabase.from("shows").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("show_flags").select("*"),
      supabase.from("classes").select("*"),
      supabase.from("certifications").select("*"),
    ]);
    setApprentices(profilesRes.data || []);
    // normalize to the {m,a,b,c,d,status} shape lib/core.js's ojtTotals/etc.
    // expect — raw Supabase columns are cat_a/cat_b/cat_c/cat_d/month, and
    // passing those straight through silently zeroes every total (ojtTotals
    // reads m.a/m.b/m.c/m.d, not m.cat_a).
    const months = (monthsRes.data || []).map((r) => ({
      user_id: r.user_id, m: r.month,
      a: Number(r.cat_a) || 0, b: Number(r.cat_b) || 0, c: Number(r.cat_c) || 0, d: Number(r.cat_d) || 0,
      status: r.status,
    }));
    setMonthsByUser(groupByUser(months));
    setBookingsByUser(groupByUser(bookingsRes.data || []));
    setFlagsByUser(groupByUser((flagsRes.data || []).map((f) => ({ ...f, user_id: f.user_id }))));
    setClassesByUser(groupByUser((classesRes.data || []).map((c) => ({
      id: c.id, user_id: c.user_id, name: c.name, start: c.start_min, loc: c.location || "", note: c.note || "", dates: c.dates || [],
      missedDates: c.missed_dates || [],
    }))));
    setCertsByUser(groupByUser(certsRes.data || []));
    setShows((showsRes.data || []).map((r) => ({
      id: r.id, name: r.name, mi: r.move_in || "", start: r.starts_on || "", end: r.ends_on || "",
      loc: r.location || "", booth: r.booth || "", co: r.gc || "", region: r.region || "", src: r.source || "union",
      sheetMonth: r.sheet_month || "",
    })));
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!me?.is_admin) { window.location.href = "/"; return; }
      if (!live) return;
      setEmail(user.email);
      await load();
      if (!live) return;
      setState("ready");
    })();
    return () => { live = false; };
  }, []);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const selected = selectedId ? apprentices.find((a) => a.id === selectedId) : null;
  const goToApprentice = (id) => { setTab("roster"); setSelectedId(id); };
  const goToShow = (id) => { setTab("schedule"); setScheduleFocusId(id); };
  const activeApprentices = useMemo(() => apprentices.filter((a) => !a.archived_at), [apprentices]);
  const archivedApprentices = useMemo(() => apprentices.filter((a) => a.archived_at), [apprentices]);

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
          <div className="skeleton" style={{ width: 160, height: 20, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div className="skeleton" style={{ height: 64 }} />
            <div className="skeleton" style={{ height: 64 }} />
          </div>
          <div className="skeleton" style={{ height: 96, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 44, marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton" style={{ height: 68 }} />
            <div className="skeleton" style={{ height: 68 }} />
            <div className="skeleton" style={{ height: 68 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell" style={{ minHeight: "100dvh", background: C.bg, fontFamily: FS }}>
      <style>{`
        .admin-shell, .admin-shell input, .admin-shell button, .admin-shell textarea, .admin-shell select{ font-family: ${FS}; }
        .admin-shell .foc:focus-visible{ box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.brand}; }
        .admin-shell button{ transition: background-color .12s, border-color .12s, filter .12s, opacity .12s; cursor: pointer; }
        .admin-shell .signout-btn:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
        .admin-shell .approve-btn:hover:not(:disabled){ filter: brightness(1.12); }
        .admin-shell .reject-btn:hover:not(:disabled){ background: rgba(232,146,124,0.12); border-color: ${C.danger}88; }
        .admin-shell .icon-btn:hover{ background: ${C.raise}; color: ${C.hi}; }
        .admin-shell .roster-row:hover{ border-color: ${C.brand}66; background: ${C.raise}; }
        .admin-shell .tab-btn:hover:not([data-active="true"]){ background: rgba(255,255,255,0.04); color: ${C.hi}; }
        .admin-shell .wrap{ max-width: 720px; margin: 0 auto; padding: 24px 16px 60px; }
        @media (min-width: 900px){
          .admin-shell .wrap{ max-width: 1160px; }
        }
      `}</style>
      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <HardHat size={20} color={C.brand} />
          <div style={{ fontSize: 17, fontWeight: 800, color: C.hi }}>Local 831 Admin</div>
          <button className="foc signout-btn" disabled={signingOut} onClick={signOut}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, opacity: signingOut ? 0.6 : 1 }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <div className="truncate" style={{ fontSize: 11.5, color: C.lo, fontFamily: FM, marginBottom: 14 }}>{email}</div>

        <div style={{ display: "flex", gap: 6, background: C.panel, borderRadius: 12, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, marginBottom: 16, overflowX: "auto" }}>
          {[
            ["dashboard", "Dashboard", LayoutDashboard],
            ["roster", "Roster", Users],
            ["schedule", "Schedule", CalendarDays],
            ["settings", "Settings", SettingsIcon],
          ].map(([k, label, Icon]) => (
            <button key={k} className="foc tab-btn" data-active={tab === k}
              onClick={() => { setTab(k); if (k !== "roster") setSelectedId(null); }}
              style={{ flex: 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 9, fontSize: 13, fontWeight: 800, background: tab === k ? C.brand : "transparent", color: tab === k ? "#1A1206" : C.mid, border: "none" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <Stat label="APPRENTICES" value={String(activeApprentices.length)} color={C.gc} />
              <Stat label="PENDING APPROVALS" value={String(Object.values(monthsByUser).flat().filter((m) => m.status === "pending").length)}
                sub="across everyone" color={C.brand} />
            </div>
            <ThisWeek shows={shows} onOpenDay={() => setTab("schedule")} />
            <OnTheFloorPanel shows={shows} onSelectShow={goToShow} />
            <RosterCategoryChart apprentices={activeApprentices} monthsByUser={monthsByUser} />
            <FallingBehindPanel apprentices={activeApprentices} monthsByUser={monthsByUser} onOpenApprentice={goToApprentice} />
            <DoNotHirePanel apprentices={activeApprentices} onOpenApprentice={goToApprentice} />
            <UpcomingClasses apprentices={activeApprentices} classesByUser={classesByUser} onOpenApprentice={goToApprentice} onChanged={load} />
            <ExpiringCerts apprentices={activeApprentices} certsByUser={certsByUser} />
          </>
        )}

        {tab === "roster" && (
          selected ? (
            <ApprenticeDetail apprentice={selected} months={monthsByUser[selected.id] || []}
              bookings={bookingsByUser[selected.id] || []} flags={flagsByUser[selected.id] || []}
              classes={classesByUser[selected.id] || []} certs={certsByUser[selected.id] || []} shows={shows}
              onAssignClass={() => setClassModal([selected.id])}
              onBack={() => setSelectedId(null)} onChanged={load} />
          ) : (
            <>
              <Roster apprentices={activeApprentices} monthsByUser={monthsByUser} onSelect={setSelectedId}
                onAddApprentice={() => setNewModal(true)} onAssignClass={() => setClassModal([])} onDoNotHire={() => setDnhModal(true)}
                onBulkArchive={() => setBulkArchiveModal(true)} />

              {archivedApprentices.length > 0 && (
                <button className="foc" onClick={() => setShowArchived((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.panel, border: "1px solid " + C.edge, borderRadius: 10, padding: "11px 13px", color: C.mid, fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>
                  <ChevronRight size={14} color={C.lo} style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                  {showArchived ? "Hide" : "Show"} {archivedApprentices.length} archived apprentice{archivedApprentices.length === 1 ? "" : "s"}
                </button>
              )}
              {showArchived && <ArchivedRoster apprentices={archivedApprentices} onSelect={setSelectedId} />}
            </>
          )
        )}

        {tab === "schedule" && (
          <Schedule shows={shows} onChanged={load} focusId={scheduleFocusId} onFocusHandled={() => setScheduleFocusId(null)} />
        )}

        {tab === "settings" && (
          <>
            <NewAdminForm onCreated={load} />
            <AdminAccountsPanel currentEmail={email} />
            <CompanyDirectoryPanel />
            <JatcContactsPanel />
            <AuditLogPanel />
          </>
        )}
      </div>

      {newModal && (
        <Modal title="Add apprentice" onClose={() => setNewModal(false)}>
          <NewApprenticeForm onCreated={load} onClose={() => setNewModal(false)} />
        </Modal>
      )}
      {classModal !== false && (
        <Modal title="Assign class" onClose={() => setClassModal(false)}>
          <AssignClassForm apprentices={activeApprentices} preselected={classModal} onAssigned={load} onClose={() => setClassModal(false)} />
        </Modal>
      )}
      {dnhModal && (
        <Modal title="Add to do-not-hire list" onClose={() => setDnhModal(false)}>
          <BulkDnhForm apprentices={activeApprentices.filter((a) => !a.do_not_hire_at)} onDone={load} onClose={() => setDnhModal(false)} />
        </Modal>
      )}
      {bulkArchiveModal && (
        <Modal title="Archive apprentices" onClose={() => setBulkArchiveModal(false)}>
          <BulkArchiveForm apprentices={activeApprentices} onDone={load} onClose={() => setBulkArchiveModal(false)} />
        </Modal>
      )}
    </div>
  );
}
