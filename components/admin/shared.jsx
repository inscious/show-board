"use client";

/* Small pieces shared across the admin console's own panel files —
   Modal/ConfirmModal/Avatar/req are used well beyond the panels that have
   been pulled out of AdminBoard.jsx so far (roster, schedule, class
   assignment, ...), so they live here rather than inside any one panel. */
import { useState, useMemo } from "react";
import { X, Eye, EyeOff, Search, Check } from "lucide-react";
import { C, SHADOW, FM, FS, MONTHS, CATS_META, hrsFmt } from "@/lib/core";

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
export function Avatar({ name, email, size = 38, avatarUrl }) {
  const color = avatarColor(email || name);
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name || email || "avatar"}
        style={{ width: size, height: size, borderRadius: size >= 48 ? 12 : 9, flexShrink: 0, objectFit: "cover", border: "1px solid " + C.line }} />
    );
  }
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

export function Modal({ title, onClose, children }) {
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

export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = true, onConfirm, onClose }) {
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
          style={{ flex: 1, padding: "10px", borderRadius: 9, background: danger ? C.danger : C.brand, color: danger ? C.inkBad : C.ink, border: "none", fontWeight: 800, fontSize: 13, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export async function req(method, path, body) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

/* ---------- small bits used by more than one tab file ---------- */
export function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "15px 16px", boxShadow: SHADOW, minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: 0.8, color: C.lo, fontFamily: FM }}>{label}</div>
      <div className="truncate" style={{ fontFamily: FM, fontSize: 22, fontWeight: 800, color: color || C.hi, lineHeight: 1.2, marginTop: 1 }}>{value}</div>
      {sub && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function PwField({ value, onChange, placeholder }) {
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
export function shortDate(d) {
  const [, mo, day] = String(d).split("-").map(Number);
  return (MONTHS[mo - 1] || "").charAt(0) + MONTHS[mo - 1].slice(1).toLowerCase() + " " + day;
}

export function groupByUser(rows) {
  const m = {};
  (rows || []).forEach((r) => { (m[r.user_id] = m[r.user_id] || []).push(r); });
  return m;
}
export function monthHours(m) { return Number(m.a || 0) + Number(m.b || 0) + Number(m.c || 0) + Number(m.d || 0); }

/* ---------- roster-hours-by-category tooltip — shared by RosterCategoryChart
   (Dashboard tab, whole roster) and ApprenticeMonthlyChart (ApprenticeDetail,
   one apprentice's last 12 months), same row shape either way. ---------- */
export function RosterCatTooltip({ active, payload, label }) {
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

/* ---------- multi-select apprentice list — assign-class, bulk-DNH, bulk-
   archive (Roster tab), and add-to-class-session (Dashboard tab's Upcoming
   Classes) all pick from the same roster the same way. ---------- */
export function ApprenticePicker({ apprentices, selected, onToggle, maxHeight = 260, selectedColor = C.brand, checkColor = C.ink }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return apprentices;
    return apprentices.filter((a) =>
      (a.name || "").toLowerCase().includes(s) || (a.email || "").toLowerCase().includes(s));
  }, [apprentices, q]);

  return (
    <>
      {apprentices.length > 6 && (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={13} color={C.lo} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…"
            style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "8px 10px 8px 28px", color: C.hi, fontSize: 12.5, fontFamily: FS }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.lo, padding: "8px 2px" }}>No matches.</div>
        ) : filtered.map((a) => (
          <button key={a.id} type="button" onClick={() => onToggle(a.id)}
            style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: C.sunk, border: "1px solid " + (selected.has(a.id) ? selectedColor + "88" : C.line), borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid " + C.line, background: selected.has(a.id) ? selectedColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {selected.has(a.id) && <Check size={11} color={checkColor} />}
            </span>
            <span className="truncate" style={{ fontSize: 13, color: C.hi }}>{a.name || a.email}</span>
          </button>
        ))}
      </div>
    </>
  );
}
