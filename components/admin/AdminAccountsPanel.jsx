"use client";

/* Current admin accounts — revoke-only mirror of NewAdminForm (still in
   AdminBoard.jsx). Self-fetches (Settings-only content). Can't revoke your
   own session or drop the last admin — both enforced server-side too, this
   is just the UI-level version of the same guardrails. */
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM } from "@/lib/core";
import { Avatar, ConfirmModal, req } from "@/components/admin/shared";

export function AdminAccountsPanel({ currentEmail }) {
  const [rows, setRows] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null); // admin row, or null
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("id,email,name").eq("is_admin", true).order("email");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const revoke = async () => {
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/revoke-admin", { userId: confirmFor.id });
      setConfirmFor(null);
      setState("idle");
      load();
    } catch (e) {
      setState("error");
      setMsg(e.message);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>ADMIN ACCOUNTS{rows ? " — " + rows.length : ""}</div>
      {rows === null ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((a) => {
            const isSelf = a.email === currentEmail;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                <Avatar name={a.name} email={a.email} avatarUrl={a.avatar_url} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
                  {a.name && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, fontFamily: FM }}>{a.email}</div>}
                </div>
                {isSelf ? (
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9.5, fontWeight: 800, color: C.lo, border: "1px solid " + C.line, borderRadius: 5, padding: "2px 6px" }}>YOU</span>
                ) : (
                  <button className="foc" onClick={() => setConfirmFor(a)}
                    style={{ flexShrink: 0, background: "transparent", border: "1px solid " + C.line, color: C.danger, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700 }}>
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {confirmFor && (
        <ConfirmModal
          title="Revoke admin access?"
          message={<>{confirmFor.name || confirmFor.email} loses admin console access immediately and becomes a normal (empty) apprentice profile. They can be granted admin access again later from here.</>}
          confirmLabel="Revoke"
          onClose={() => { setConfirmFor(null); setMsg(""); }}
          onConfirm={revoke}
        />
      )}
      {msg && <div style={{ marginTop: 8, fontSize: 11.5, color: C.danger }}>{msg}</div>}
    </div>
  );
}
