"use client";

/* Small pieces shared across the admin console's own panel files —
   Modal/ConfirmModal/Avatar/req are used well beyond the panels that have
   been pulled out of AdminBoard.jsx so far (roster, schedule, class
   assignment, ...), so they live here rather than inside any one panel. */
import { useState } from "react";
import { X } from "lucide-react";
import { C, SHADOW, FM } from "@/lib/core";

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
          style={{ flex: 1, padding: "10px", borderRadius: 9, background: danger ? C.danger : C.brand, color: danger ? "#2A0E0A" : "#1A1206", border: "none", fontWeight: 800, fontSize: 13, opacity: busy ? 0.7 : 1 }}>
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
