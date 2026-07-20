"use client";

/* Live on/off switch for OJT auto-approve — backed by
   app_settings.ojt_auto_approve, same pattern as SelfSignupPanel. When on,
   an apprentice's own submitted or uploaded OJT hours land approved
   immediately instead of sitting in the review queue — the DB trigger
   protect_ojt_months_status() (supabase/schema.sql) is the actual
   enforcement point, not this route; flipping this off always falls back
   to the normal review-then-approve flow with zero data loss either way. */
import { useState, useEffect } from "react";
import { C, SHADOW, FM } from "@/lib/core";
import { req, ConfirmModal } from "@/components/admin/shared";

export function OjtAutoApprovePanel() {
  const [enabled, setEnabled] = useState(null); // null = loading
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/ojt-auto-approve")
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setMsg("");
    try {
      await req("POST", "/api/admin/ojt-auto-approve", { enabled: next });
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
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>OJT auto-approve</div>
        <div style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>Submitted/uploaded hours skip the review queue</div>
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
          title={enabled ? "Turn off OJT auto-approve?" : "Turn on OJT auto-approve?"}
          message={
            enabled
              ? "New OJT submissions and uploads will go back to sitting in the review queue until an admin approves them."
              : "Every OJT month an apprentice submits or uploads from now on lands approved immediately — no review queue. They're warned to double-check their numbers first, since there's no admin backstop catching a typo before it counts. You can still open any month and fix or reject it after the fact, and this can be flipped back off anytime."
          }
          confirmLabel={enabled ? "Turn off" : "Turn on"}
          danger={!enabled}
          onClose={() => setConfirming(false)}
          onConfirm={toggle}
        />
      )}
    </div>
  );
}
