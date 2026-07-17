"use client";

/* Audit log — archive/restore, permanent delete, do-not-hire, and new admin
   accounts. Append-only on the DB side (see supabase/schema.sql); fetches
   its own data since it's the one thing on the Settings page nobody looks
   at every load, no reason to make every AdminBoard load() call carry it. */
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM } from "@/lib/core";

const AUDIT_ACTION_META = {
  archive: { label: "Archived", color: C.mid },
  restore: { label: "Restored", color: C.working },
  delete: { label: "Deleted", color: C.danger },
  dnh_add: { label: "Do-not-hire", color: C.danger },
  dnh_remove: { label: "DNH cleared", color: C.working },
  admin_create: { label: "New admin", color: C.brand },
  admin_revoke: { label: "Admin revoked", color: C.danger },
};

export function AuditLogPanel() {
  const [rows, setRows] = useState(null); // null = loading
  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (live) setRows(data || []);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 9 }}>AUDIT LOG — LAST 50</div>
      {rows === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton" style={{ height: 40 }} />
          <div className="skeleton" style={{ height: 40 }} />
          <div className="skeleton" style={{ height: 40 }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.lo }}>Nothing logged yet — archive, delete, do-not-hire, and new admin accounts show up here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
          {rows.map((r) => {
            const meta = AUDIT_ACTION_META[r.action] || { label: r.action, color: C.mid };
            return (
              <div key={r.id} style={{ background: C.raise, border: "1px solid " + meta.color + "3A", borderRadius: 9, padding: "9px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: meta.color, border: "1px solid " + meta.color + "55", borderRadius: 5, padding: "2px 6px" }}>{meta.label.toUpperCase()}</span>
                  <span style={{ fontFamily: FM, fontSize: 10, color: C.lo, marginLeft: "auto", flexShrink: 0 }}>{r.created_at.slice(0, 16).replace("T", " ")}</span>
                </div>
                <div className="truncate" style={{ fontSize: 12.5, color: C.hi, marginTop: 5 }}>{r.message}</div>
                {r.actor_email && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, marginTop: 2 }}>by {r.actor_email}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
