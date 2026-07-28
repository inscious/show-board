"use client";

/* Live on/off switch for apprentices uploading their own profile picture —
   backed by app_settings.apprentice_avatar_upload_enabled, same pattern as
   SelfSignupPanel/OjtAutoApprovePanel. Turning this off doesn't touch
   photos already on file (app/api/profile/avatar checks it before a new
   upload, not on read) — an admin can still set anyone's photo either way
   via the Roster's existing admin avatar upload. */
import { useState, useEffect } from "react";
import { C, SHADOW, FM } from "@/lib/core";
import { req, ConfirmModal } from "@/components/admin/shared";
import { getCached, setCached } from "@/lib/clientCache";

const CACHE_KEY = "admin:apprentice-avatar-upload";

export function ApprenticeAvatarUploadPanel() {
  const [enabled, setEnabled] = useState(() => getCached(CACHE_KEY)); // null = loading
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/apprentice-avatar-upload")
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setCached(CACHE_KEY, !!d.enabled); })
      .catch(() => setEnabled(true));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setMsg("");
    try {
      await req("POST", "/api/admin/apprentice-avatar-upload", { enabled: next });
      setEnabled(next);
      setCached(CACHE_KEY, next);
      setConfirming(false);
    } catch (e) {
      setMsg(e.message);
      setConfirming(false);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 14px", boxShadow: SHADOW, display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>Apprentice profile pictures</div>
        <div style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>Let apprentices upload their own, from the OJT tab</div>
      </div>
      {enabled === null ? (
        <div className="skeleton" style={{ width: 52, height: 26, borderRadius: 13 }} />
      ) : (
        <button className="foc" onClick={() => setConfirming(true)}
          style={{
            flexShrink: 0, fontFamily: FM, fontSize: 9.5, fontWeight: 800,
            color: enabled ? C.working : C.lo,
            background: enabled ? "rgba(79,193,166,0.12)" : C.raise,
            border: "1px solid " + (enabled ? C.working + "55" : C.line),
            borderRadius: 20, padding: "6px 12px",
          }}>
          {enabled ? "ON" : "OFF"}
        </button>
      )}
      {msg && <div style={{ fontSize: 11.5, color: C.danger }}>{msg}</div>}
      {confirming && (
        <ConfirmModal
          title={enabled ? "Turn off profile picture uploads?" : "Let apprentices upload their own photo?"}
          message={
            enabled
              ? "Apprentices won't be able to upload or replace their own photo anymore. Photos already on file stay as they are — you can still set anyone's photo from Roster, and this can be flipped back on anytime."
              : "Every apprentice will see an upload option on their OJT tab and can set their own profile picture at any time, no review step."
          }
          confirmLabel={enabled ? "Turn it off" : "Turn it on"}
          danger={enabled}
          onClose={() => setConfirming(false)}
          onConfirm={toggle}
        />
      )}
    </div>
  );
}
