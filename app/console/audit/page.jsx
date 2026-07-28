"use client";

/* Platform-level audit log — platform_audit_log has been written to since
   the role-assignment tool shipped, but nothing ever read it back (confirmed
   via grep before building this). Near-direct port of the union-level
   AuditLogPanel.jsx's card shape (colored action badge, timestamp, message,
   actor email) pointed at the platform table instead. Reads via the normal
   RLS-scoped client, not an API route — platform_audit_log's own "platform
   admin read" policy already gates this via is_platform_admin(), same as
   admin_audit_log's read policy does for the union-level panel. */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM } from "@/lib/core";

const AUDIT_ACTION_META = {
  platform_set_roles: { label: "Roles changed", color: C.brand },
  impersonate_start: { label: "Impersonation started", color: C.gc },
  impersonate_end: { label: "Impersonation ended", color: C.mid },
};

export default function ConsoleAuditPage() {
  const [rows, setRows] = useState(null); // null = loading

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("platform_audit_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (live) setRows(data || []);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, marginBottom: 8 }}>
        AUDIT LOG — LAST 50
      </div>
      {rows === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton" style={{ height: 56 }} />
          <div className="skeleton" style={{ height: 56 }} />
          <div className="skeleton" style={{ height: 56 }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, fontSize: 12.5, color: C.lo }}>
          Nothing logged yet — cross-tenant role changes and impersonation sessions show up here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const meta = AUDIT_ACTION_META[r.action] || { label: r.action, color: C.mid };
            return (
              <div key={r.id} style={{ background: C.panel, border: "1px solid " + meta.color + "3A", borderRadius: 12, padding: "12px 14px", boxShadow: SHADOW }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9.5, fontWeight: 800, color: meta.color, border: "1px solid " + meta.color + "55", borderRadius: 5, padding: "2px 6px" }}>
                    {meta.label.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: FM, fontSize: 10.5, color: C.lo, marginLeft: "auto", flexShrink: 0 }}>
                    {r.created_at.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <div className="truncate" style={{ fontSize: 13, color: C.hi, marginTop: 6 }}>{r.message}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                  {r.actor_email && <span className="truncate" style={{ fontSize: 10.5, color: C.lo }}>by {r.actor_email}</span>}
                  {r.target_email && <span className="truncate" style={{ fontSize: 10.5, color: C.lo }}>on {r.target_email}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
