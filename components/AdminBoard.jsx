"use client";

/* Admin console — a genuinely separate experience from the apprentice
   dashboard (components/ShowBoard.jsx), not just extra buttons bolted onto
   it. Roster of apprentices (profile + OJT progress, editable), pending
   OJT-month approvals, and shared schedule management. */
import React, { useState, useEffect, useMemo } from "react";
import {
  HardHat, Users, CalendarDays, Plus, Upload, ChevronRight, ChevronLeft, ChevronDown,
  Check, X, Trash2, Eye, EyeOff, Lock, Mail, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS, hrsFmt, mMed, levelIndex, ojtTotals, LEVELS, money, STATUS, REGION, sortDate, monthLabel, monthKey, isPast, certState, KLASS, todayMid, DOW, showsOn, CATS_META, countdown, mKey, mParse, MONTHS, num, CAT_TOTAL, projectMonth } from "@/lib/core";
import { ShowForm, ImportForm, EMPTY } from "@/components/ShowEditor";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

/* ---------- avatar placeholder — initials on a deterministic color, standing
   in for the ID-badge photo until real upload/storage exists ---------- */
const AVATAR_COLORS = ["#F2B441", "#4FC1A6", "#7FB2FF", "#F2789B", "#B49BF0", "#43BFB2", "#E8927C"];
function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
function avatarColor(key) {
  let h = 0;
  const s = key || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function Avatar({ name, email, size = 38 }) {
  const color = avatarColor(email || name);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size >= 48 ? 12 : 9, flexShrink: 0,
        background: color + "22", border: "1px solid " + color + "55", color,
        fontFamily: FM, fontWeight: 800, fontSize: Math.round(size * 0.36),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {initials(name, email)}
    </div>
  );
}

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

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", background: C.panel, border: "1px solid " + C.edge, borderRadius: 16, boxShadow: SHADOW, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + C.line }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.hi }}>{title}</span>
          <button className="foc" onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.lo, padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 19, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = true, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.5, marginBottom: 16 }}>{message}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="foc" onClick={onClose} disabled={busy}
          style={{ flex: 1, padding: "10px", borderRadius: 9, background: "transparent", color: C.mid, border: "1px solid " + C.line, fontWeight: 700, fontSize: 13 }}>
          Cancel
        </button>
        <button className="foc" onClick={go} disabled={busy}
          style={{ flex: 1, padding: "10px", borderRadius: 9, background: danger ? C.danger : C.brand, color: danger ? "#2A0E0A" : "#1A1206", border: "none", fontWeight: 800, fontSize: 13, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// "2026-07-27" -> "Jul 27" — compact date for the class chip grid, presentation-only
function shortDate(d) {
  const [, mo, day] = String(d).split("-").map(Number);
  return (MONTHS[mo - 1] || "").charAt(0) + MONTHS[mo - 1].slice(1).toLowerCase() + " " + day;
}

async function req(method, path, body) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function groupByUser(rows) {
  const m = {};
  (rows || []).forEach((r) => { (m[r.user_id] = m[r.user_id] || []).push(r); });
  return m;
}
function monthHours(m) { return Number(m.a || 0) + Number(m.b || 0) + Number(m.c || 0) + Number(m.d || 0); }

/* ---------- apprentice detail ---------- */
function ApprenticeDetail({ apprentice, months, bookings, flags, classes, certs, shows, onAssignClass, onBack, onChanged }) {
  const archived = !!apprentice.archived_at;
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
  const approved = useMemo(() => months.filter((m) => m.status === "approved").sort((a, b) => (a.m < b.m ? 1 : -1)), [months]);
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
          <Avatar name={apprentice.name} email={apprentice.email} size={52} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: C.hi }}>{apprentice.name || apprentice.email}</div>
            <div className="truncate" style={{ fontSize: 11, color: C.lo, fontFamily: FM, marginTop: 2 }}>{apprentice.email}</div>
            {apprentice.city && <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{apprentice.city}</div>}
          </div>
          {archived && (
            <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.mid, background: C.raise, border: "1px solid " + C.line, borderRadius: 6, padding: "4px 8px" }}>ARCHIVED</span>
          )}
          <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 12, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 6, padding: "4px 8px" }}>{lv.k}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, background: C.panel, borderRadius: 11, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, marginBottom: 12, overflowX: "auto" }}>
        {[
          ["overview", "Overview"],
          ["history", "History"],
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
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>APPROVED HISTORY — {approved.length} MONTHS</div>
        {approved.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo }}>Nothing approved yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {approved.map((m) => (
              <div key={m.m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span style={{ fontFamily: FM, color: C.hi, width: 74, flexShrink: 0 }}>{mMed(m.m)}</span>
                <span style={{ fontFamily: FM, color: C.mid, flex: 1 }}>A{hrsFmt(m.a)} B{hrsFmt(m.b)} C{hrsFmt(m.c)} D{hrsFmt(m.d)}</span>
                <span style={{ fontFamily: FM, color: C.working, fontWeight: 800 }}>{hrsFmt(monthHours(m))}h</span>
                <button className="foc icon-btn" onClick={() => removeMonth(m.m)} style={{ background: "transparent", border: "none", color: C.lo, padding: 2, borderRadius: 5 }}><Trash2 size={13} /></button>
              </div>
            ))}
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
function Roster({ apprentices, monthsByUser, onSelect }) {
  const roster = useMemo(() => apprentices.map((a) => {
    const months = monthsByUser[a.id] || [];
    const approved = months.filter((m) => m.status === "approved");
    const pendingCount = months.filter((m) => m.status === "pending").length;
    const total = ojtTotals(approved).total;
    const lastMonth = months.slice().sort((x, y) => (x.m < y.m ? 1 : -1))[0];
    return { ...a, total, level: LEVELS[levelIndex(total)], pendingCount, lastMonth };
  }).sort((x, y) => (x.name || x.email).localeCompare(y.name || y.email)), [apprentices, monthsByUser]);

  if (roster.length === 0) {
    return <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No apprentices yet. Add one below.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {roster.map((a) => (
        <button key={a.id} className="foc roster-row" onClick={() => onSelect(a.id)}
          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
          <Avatar name={a.name} email={a.email} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
            {a.name && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, fontFamily: FM, marginTop: 1 }}>{a.email}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FM, fontSize: 13, fontWeight: 800, color: C.working }}>{hrsFmt(a.total)}h</span>
              <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 5, padding: "1px 6px" }}>{a.level.k}</span>
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
          <Avatar name={a.name} email={a.email} size={34} />
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
    const today = todayMid();
    const janKey = mKey(today.getFullYear(), 0);
    const out = [];
    for (let i = 0; i < 12; i++) {
      const k = (() => { const d = mParse(janKey); const nd = new Date(d.y, d.m + i, 1); return mKey(nd.getFullYear(), nd.getMonth()); })();
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
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 6 }}>MONTHLY HOURS · {todayMid().getFullYear()}</div>
        <div style={{ fontSize: 12.5, color: C.lo }}>Nothing approved this year yet.</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px 4px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>MONTHLY HOURS · {todayMid().getFullYear()}</div>
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

/* ---------- certs expiring across the whole roster — filters certsByUser
   that's already loaded, no extra fetch either ---------- */
function ExpiringCerts({ apprentices, certsByUser }) {
  const rows = useMemo(() => {
    const out = [];
    apprentices.forEach((a) => {
      (certsByUser[a.id] || []).forEach((c) => {
        const st = certState(c.exp);
        if (st.days <= 60) out.push({ apprentice: a.name || a.email, cert: c.name, exp: c.exp, ...st });
      });
    });
    return out.sort((x, y) => x.days - y.days);
  }, [apprentices, certsByUser]);

  if (rows.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>CERTIFICATIONS EXPIRING SOON</div>
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

/* ---------- schedule ---------- */
function Schedule({ shows, onChanged }) {
  const [modal, setModal] = useState(null); // "add" | "edit" | "import"
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // monthLabel -> bool, overrides the default
  const [expandedId, setExpandedId] = useState(null);
  const [showPast, setShowPast] = useState(false);

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
    const sorted = shows.slice().sort((a, b) => sortDate(a) - sortDate(b));
    const byMonth = {};
    sorted.forEach((s) => {
      const label = monthLabel(s);
      (byMonth[label] = byMonth[label] || { key: monthKey(s), label, list: [] }).list.push(s);
    });
    return Object.values(byMonth).sort((a, b) => a.key - b.key);
  }, [shows]);

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
                <div key={s.id} style={{ background: C.panel, border: "1px solid " + (open ? C.brand + "66" : C.edge), borderRadius: 10, opacity: past ? 0.55 : 1, overflow: "hidden" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
  const [tab, setTab] = useState("roster"); // roster | schedule
  const [selectedId, setSelectedId] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [classModal, setClassModal] = useState(false); // false | array of preselected userIds
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Stat label="APPRENTICES" value={String(activeApprentices.length)} color={C.gc} />
          <Stat label="PENDING APPROVALS" value={String(Object.values(monthsByUser).flat().filter((m) => m.status === "pending").length)}
            sub="across everyone" color={C.brand} />
        </div>

        <ThisWeek shows={shows} onOpenDay={() => setTab("schedule")} />

        <div style={{ display: "flex", gap: 6, background: C.panel, borderRadius: 12, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, marginBottom: 16 }}>
          <button className="foc tab-btn" data-active={tab === "roster"} onClick={() => { setTab("roster"); setSelectedId(null); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 4px", borderRadius: 9, fontSize: 13.5, fontWeight: 800, background: tab === "roster" ? C.brand : "transparent", color: tab === "roster" ? "#1A1206" : C.mid, border: "none" }}>
            <Users size={15} /> Roster
          </button>
          <button className="foc tab-btn" data-active={tab === "schedule"} onClick={() => setTab("schedule")}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 4px", borderRadius: 9, fontSize: 13.5, fontWeight: 800, background: tab === "schedule" ? C.brand : "transparent", color: tab === "schedule" ? "#1A1206" : C.mid, border: "none" }}>
            <CalendarDays size={15} /> Schedule
          </button>
        </div>

        {tab === "roster" ? (
          selected ? (
            <ApprenticeDetail apprentice={selected} months={monthsByUser[selected.id] || []}
              bookings={bookingsByUser[selected.id] || []} flags={flagsByUser[selected.id] || []}
              classes={classesByUser[selected.id] || []} certs={certsByUser[selected.id] || []} shows={shows}
              onAssignClass={() => setClassModal([selected.id])}
              onBack={() => setSelectedId(null)} onChanged={load} />
          ) : (
            <>
              <RosterCategoryChart apprentices={activeApprentices} monthsByUser={monthsByUser} />
              <ExpiringCerts apprentices={activeApprentices} certsByUser={certsByUser} />
              <Roster apprentices={activeApprentices} monthsByUser={monthsByUser} onSelect={setSelectedId} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="foc" onClick={() => setNewModal(true)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
                  <Plus size={15} /> Add apprentice
                </button>
                {activeApprentices.length > 0 && (
                  <button className="foc" onClick={() => setClassModal([])}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
                    <GraduationCap size={15} /> Assign class
                  </button>
                )}
              </div>

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
        ) : (
          <Schedule shows={shows} onChanged={load} />
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
    </div>
  );
}
