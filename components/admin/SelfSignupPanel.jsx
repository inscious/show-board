"use client";

/* Live on/off switch for apprentice self-signup (app/signup) — backed by
   app_settings.self_signup_enabled, not an env var, so this takes effect
   immediately with no redeploy. Self-fetches the current state via the
   same public GET /signup and /login both read from. Confirmed either
   direction, same as every other roster-affecting toggle in Settings —
   this one blocks or opens the door for every future apprentice, not just
   one row, so a stray tap shouldn't be able to flip it silently. */
import { useState, useEffect } from "react";
import { C, SHADOW, FM } from "@/lib/core";
import { req, ConfirmModal } from "@/components/admin/shared";

export function SelfSignupPanel() {
  const [enabled, setEnabled] = useState(null); // null = loading
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/self-signup")
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(true));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setMsg("");
    try {
      await req("POST", "/api/admin/self-signup", { enabled: next });
      setEnabled(next);
      setConfirming(false);
    } catch (e) {
      setMsg(e.message);
      setConfirming(false);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 14px", boxShadow: SHADOW, display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>Apprentice sign-up</div>
        <div style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>/signup — pending review either way</div>
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
          title={enabled ? "Close apprentice sign-up?" : "Open apprentice sign-up?"}
          message={
            enabled
              ? "New apprentices won't be able to create their own accounts anymore — /signup will send them to sign in instead. You can still add accounts yourself from Roster, and this can be flipped back on anytime."
              : "Anyone with the link will be able to create an account and land on pending review, same as any self-signup — you still approve every one individually before they get real access."
          }
          confirmLabel={enabled ? "Close it" : "Open it"}
          danger={enabled}
          onClose={() => setConfirming(false)}
          onConfirm={toggle}
        />
      )}
    </div>
  );
}
