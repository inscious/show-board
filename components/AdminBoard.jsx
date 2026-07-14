"use client";

/* Admin console — a genuinely separate experience from the apprentice
   dashboard (components/ShowBoard.jsx), not just extra buttons bolted onto
   it. Roster of apprentices (profile + OJT progress, editable), pending
   OJT-month approvals, and shared schedule management. */
import React, { useState, useEffect, useMemo } from "react";
import {
  HardHat, Users, CalendarDays, Plus, Upload, ChevronRight, ChevronLeft,
  Check, X, Trash2, Eye, EyeOff, Lock, Mail, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS, hrsFmt, mMed, levelIndex, ojtTotals, LEVELS, money, STATUS } from "@/lib/core";
import { ShowForm, ImportForm, EMPTY } from "@/components/ShowEditor";

/* ---------- small shared bits (duplicated from ShowBoard.jsx on purpose —
   this file is a separate surface, not worth wiring a shared-imports refactor for) ---------- */
function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "11px 12px", boxShadow: SHADOW, minWidth: 0 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", background: C.panel, border: "1px solid " + C.edge, borderRadius: "16px 16px 0 0", boxShadow: SHADOW, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + C.line }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.hi }}>{title}</span>
          <button className="foc" onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.lo, padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
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
function ApprenticeDetail({ apprentice, months, bookings, flags, shows, onBack, onChanged }) {
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

  return (
    <div>
      <button className="foc" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.gc, fontSize: 13, fontWeight: 700, padding: "6px 0", marginBottom: 10 }}>
        <ChevronLeft size={16} /> Roster
      </button>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: C.hi }}>{apprentice.name || apprentice.email}</div>
            <div className="truncate" style={{ fontSize: 11, color: C.lo, fontFamily: FM, marginTop: 2 }}>{apprentice.email}</div>
          </div>
          <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 12, fontWeight: 800, color: C.brand, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.4)", borderRadius: 6, padding: "4px 8px" }}>{lv.k}</span>
        </div>
      </div>

      <div className="m4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Stat label="TOTAL OJT" value={hrsFmt(total)} sub={lv.label} color={C.working} />
        <Stat label="PENDING REVIEW" value={String(pending.length)} sub={pending.length ? "needs a decision" : "all caught up"} color={pending.length ? C.brand : C.lo} />
      </div>

      {pending.length > 0 && (
        <div style={{ background: "rgba(255,176,32,0.07)", border: "1px solid rgba(255,176,32,0.3)", borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
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

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
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

      {(bookings.length > 0 || flaggedShows.length > 0) && (
        <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>ON THE SCHEDULE</div>
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
        </div>
      )}

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>PROFILE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["name", "Name"], ["memberId", "Member ID"], ["last4", "Last 4 SSN"], ["local", "Local"], ["joined", "Joined (YYYY-MM-DD)"], ["rsiCredits", "RSI credits"],
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

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW }}>
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
          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
            {a.name && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, fontFamily: FM, marginTop: 1 }}>{a.email}</div>}
            <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
              {hrsFmt(a.total)}h · {a.level.label}{a.lastMonth ? " · last " + mMed(a.lastMonth.m) : ""}
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

/* ---------- schedule ---------- */
function Schedule({ shows, onChanged }) {
  const [modal, setModal] = useState(null); // "add" | "edit" | "import"
  const [editing, setEditing] = useState(null);

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

  const sorted = useMemo(() => shows.slice().sort((a, b) => (a.start || a.mi || "").localeCompare(b.start || b.mi || "")), [shows]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="foc" onClick={() => { setEditing(null); setModal("add"); }}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px solid " + C.edge, fontWeight: 700, fontSize: 13.5 }}>
          <Plus size={15} /> Add show
        </button>
        <button className="foc" onClick={() => setModal("import")}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 13.5 }}>
          <Upload size={15} /> Import schedule
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.panel, border: "1px solid " + C.edge, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{s.name}</div>
              <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{s.mi} · {s.loc} · {s.co}</div>
            </div>
            <button className="foc" onClick={() => { setEditing(s); setModal("edit"); }} style={{ background: "transparent", border: "none", color: C.gc, padding: 4, fontSize: 12, fontWeight: 700 }}>Edit</button>
            <button className="foc" onClick={() => removeShow(s.id)} style={{ background: "transparent", border: "none", color: C.danger, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
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
  const [shows, setShows] = useState([]);
  const [tab, setTab] = useState("roster"); // roster | schedule
  const [selectedId, setSelectedId] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = async () => {
    const supabase = createClient();
    // bookings/show_flags need their own "admin read" RLS policy (see
    // supabase/schema.sql) — until that's applied these two just come back
    // empty and the "on the schedule" section quietly shows nothing.
    const [profilesRes, monthsRes, showsRes, bookingsRes, flagsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_admin", false),
      supabase.from("ojt_months").select("*"),
      supabase.from("shows").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("show_flags").select("*"),
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
    setShows((showsRes.data || []).map((r) => ({
      id: r.id, name: r.name, mi: r.move_in || "", start: r.starts_on || "", end: r.ends_on || "",
      loc: r.location || "", booth: r.booth || "", co: r.gc || "", region: r.region || "", src: r.source || "union",
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

  if (state === "loading") {
    return <div style={{ minHeight: "100dvh", background: C.bg, color: C.lo, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>Loading…</div>;
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
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
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
          <Stat label="APPRENTICES" value={String(apprentices.length)} color={C.gc} />
          <Stat label="PENDING APPROVALS" value={String(Object.values(monthsByUser).flat().filter((m) => m.status === "pending").length)}
            sub="across everyone" color={C.brand} />
        </div>

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
              bookings={bookingsByUser[selected.id] || []} flags={flagsByUser[selected.id] || []} shows={shows}
              onBack={() => setSelectedId(null)} onChanged={load} />
          ) : (
            <>
              <Roster apprentices={apprentices} monthsByUser={monthsByUser} onSelect={setSelectedId} />
              <button className="foc" onClick={() => setNewModal(true)}
                style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
                <Plus size={15} /> Add apprentice
              </button>
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
    </div>
  );
}
