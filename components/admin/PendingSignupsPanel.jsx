"use client";

/* Self-signed-up accounts (app/signup) waiting on admin approval —
   profiles.approved_at is null. Self-fetches, same reasoning as every other
   Settings-adjacent panel in this file's siblings: not part of the
   roster-wide load(), which deliberately excludes these (see AdminBoard.jsx's
   load() — .not("approved_at", "is", null)) so a pending signup doesn't
   clutter Falling Behind / Do Not Hire / the normal roster before it's real. */
import { useState, useEffect } from "react";
import { Check, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, mMed } from "@/lib/core";
import { Avatar, ConfirmModal, req } from "@/components/admin/shared";

export function PendingSignupsPanel({ onCountChange }) {
  const [rows, setRows] = useState(null); // null = loading
  const [monthsByUser, setMonthsByUser] = useState({});
  const [rejecting, setRejecting] = useState(null); // profile row, or null
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const supabase = createClient();
    const { data: profiles } = await supabase.from("profiles")
      .select("id, email, name")
      .eq("is_admin", false)
      .is("approved_at", null)
      .order("email");
    setRows(profiles || []);
    onCountChange?.(profiles?.length || 0);
    if (profiles?.length) {
      const { data: months } = await supabase.from("ojt_months")
        .select("user_id, month, cat_a, cat_b, cat_c, cat_d")
        .in("user_id", profiles.map((p) => p.id));
      const grouped = {};
      (months || []).forEach((m) => { (grouped[m.user_id] = grouped[m.user_id] || []).push(m); });
      setMonthsByUser(grouped);
    }
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setBusyId(id);
    try { await req("POST", "/api/admin/approve-signup", { userId: id }); await load(); }
    finally { setBusyId(null); }
  };
  const reject = async () => {
    await req("DELETE", "/api/admin/apprentices", { userId: rejecting.id });
    setRejecting(null);
    load();
  };

  if (rows !== null && rows.length === 0) return null; // nothing pending — don't take up space

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.brand + "44", borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.brand, fontFamily: FM, fontWeight: 800, marginBottom: 9 }}>
        PENDING SIGNUPS{rows ? " — " + rows.length : ""}
      </div>
      {rows === null ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((p) => {
            const months = (monthsByUser[p.id] || []).slice().sort((a, b) => (a.month < b.month ? -1 : 1));
            return (
              <div key={p.id} style={{ background: C.raise, border: "1px solid " + C.line, borderRadius: 10, padding: "11px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={p.name} email={p.email} size={34} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{p.name || "(no name given)"}</div>
                    <div className="truncate" style={{ fontSize: 11, color: C.lo, fontFamily: FM }}>{p.email}</div>
                  </div>
                  <button className="foc" onClick={() => approve(p.id)} disabled={busyId === p.id}
                    style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, background: C.working, color: C.inkGood, border: "none", borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 800, opacity: busyId === p.id ? 0.6 : 1 }}>
                    <Check size={13} /> Approve
                  </button>
                  <button className="foc icon-btn" onClick={() => setRejecting(p)} disabled={busyId === p.id}
                    style={{ flexShrink: 0, background: "transparent", border: "1px solid " + C.line, color: C.danger, borderRadius: 7, padding: 7 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                {months.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + C.line, fontSize: 11, color: C.mid, fontFamily: FM }}>
                    submitted: {months.map((m) => mMed(m.month) + " (" + (Number(m.cat_a) + Number(m.cat_b) + Number(m.cat_c) + Number(m.cat_d)) + "h)").join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {rejecting && (
        <ConfirmModal
          title="Reject this signup?"
          message={<>{rejecting.name || rejecting.email} and any OJT hours they entered are permanently deleted. They can sign up again later if this was a mistake.</>}
          confirmLabel="Reject & delete"
          onClose={() => setRejecting(null)}
          onConfirm={reject}
        />
      )}
    </div>
  );
}
