"use client";

/* Union dates & dues — the holiday/meeting/dues-deadline lines printed on
   the monthly union sheet, shown on both the apprentice Board and Home
   tabs (BoardTab.jsx / HomeTab.jsx read the same union_notices table via
   lib/store.ts). Used to be a hardcoded JULY_NOTES constant in lib/core.ts
   that only ever showed July and needed a code deploy to update — this
   panel is the replacement: read the new sheet each month, delete last
   month's rows here, type in the new ones. Same shared/admin-write shape
   and same list-with-modal-form pattern as JatcContactsPanel.jsx. */
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, NOTICE_COLOR } from "@/lib/core";
import { Modal, ConfirmModal, req } from "@/components/admin/shared";
import { getCached, setCached } from "@/lib/clientCache";

const KINDS = [
  { k: "meeting", label: "Meeting" },
  { k: "dues", label: "Dues" },
  { k: "holiday", label: "Holiday" },
  { k: "notice", label: "Other" },
];

const curMonthStr = () => {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
};

/* exported so the "Import schedule" flow (ScheduleTab.jsx) can chain
   straight into adding this same sheet's notices — same monthly sheet as
   the shows, per union_notices.sql's own comment, so one import session
   should be able to cover both instead of the admin having to remember a
   second trip to Settings. resetAfterSave keeps the form open and blanks
   it for the next row instead of closing, for that quick-add flow. */
export function NoticeForm({ onSaved, onClose, initial, resetAfterSave, defaultSheetMonth }) {
  const blank = { dateLabel: "", noticeDate: "", body: "", kind: "meeting", sheetMonth: defaultSheetMonth || curMonthStr() };
  const [form, setForm] = useState(() => initial
    ? { dateLabel: initial.date_label || "", noticeDate: initial.notice_date || "", body: initial.body || "", kind: initial.kind || "notice", sheetMonth: initial.sheet_month || curMonthStr() }
    : blank);
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  const fieldStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14 };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.dateLabel.trim() || !form.body.trim()) { setState("error"); setMsg("Needs a date and a description."); return; }
    if (!form.noticeDate) { setState("error"); setMsg("Pick the actual calendar date — that's what puts the dot on the right day."); return; }
    setState("saving");
    setMsg("");
    try {
      const saved = {
        id: initial?.id || "un" + Date.now().toString(36),
        dateLabel: form.dateLabel.trim(),
        noticeDate: form.noticeDate,
        body: form.body.trim(),
        kind: form.kind,
        sheetMonth: form.sheetMonth || null,
        sortOrder: initial?.sort_order ?? Date.now(),
      };
      await req("POST", "/api/union-notices", saved);
      setState("done");
      onSaved(saved);
      if (resetAfterSave) {
        setTimeout(() => {
          setForm({ ...blank, sheetMonth: form.sheetMonth });
          setState("idle");
        }, 500);
      } else {
        setTimeout(onClose, 700);
      }
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>DATE, AS PRINTED</div>
          <input required autoFocus value={form.dateLabel} onChange={(e) => setForm((f) => ({ ...f, dateLabel: e.target.value }))}
            placeholder="WED AUG 19" aria-label="Date, as printed" style={{ ...fieldStyle, width: "100%" }} />
        </div>
        <div style={{ flex: "0 1 150px" }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CALENDAR DATE</div>
          <input required type="date" value={form.noticeDate} onChange={(e) => setForm((f) => ({ ...f, noticeDate: e.target.value }))} aria-label="Calendar date"
            style={{ ...fieldStyle, width: "100%", fontFamily: FM }} />
        </div>
      </div>
      <div style={{ flex: "0 1 140px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>SHEET MONTH</div>
        <input value={form.sheetMonth} onChange={(e) => setForm((f) => ({ ...f, sheetMonth: e.target.value }))}
          placeholder="2026-08" aria-label="Sheet month" style={{ ...fieldStyle, width: "100%", fontFamily: FM, maxWidth: 150 }} />
      </div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>DESCRIPTION</div>
      <input required value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        placeholder="Monthly meeting · 6:00 PM · 14930 Marquardt Ave, Santa Fe Springs"
        aria-label="Description"
        style={{ ...fieldStyle, width: "100%", marginBottom: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>KIND</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {KINDS.map(({ k, label }) => (
          <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, kind: k }))}
            style={{
              flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: form.kind === k ? NOTICE_COLOR[k] + "22" : C.sunk,
              color: form.kind === k ? NOTICE_COLOR[k] : C.mid,
              border: "1px solid " + (form.kind === k ? NOTICE_COLOR[k] + "66" : C.line),
            }}>
            {label}
          </button>
        ))}
      </div>
      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Saving…" : state === "done" ? "Saved" : initial ? "Save changes" : "Add notice"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

const CACHE_KEY = "admin:union-notices";

export function UnionNoticesPanel() {
  const [rows, setRows] = useState(() => getCached(CACHE_KEY));
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("union_notices").select("*").order("sort_order", { ascending: true });
    setRows(data || []);
    setCached(CACHE_KEY, data || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await req("DELETE", "/api/union-notices", { id });
    load();
  };
  const openAdd = () => { setEditingRow(null); setFormOpen(true); };
  const openEdit = (row) => { setEditingRow(row); setFormOpen(true); };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>UNION DATES &amp; DUES{rows ? " — " + rows.length : ""}</div>
        <button className="foc" onClick={openAdd} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.gc, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Add</button>
      </div>
      <div style={{ fontSize: 11, color: C.lo, lineHeight: 1.5, marginBottom: 10 }}>
        Every apprentice sees this on Home and Board. When the new sheet comes out, delete last
        month's rows and add this month's — nothing here updates itself.
      </div>
      {rows === null ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((n) => (
            <div key={n.id} className="foc" role="button" tabIndex={0}
              onClick={() => openEdit(n)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(n); } }}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
              <div style={{ flexShrink: 0, width: 78, fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: NOTICE_COLOR[n.kind] || C.mid }}>
                {n.date_label}
              </div>
              <div className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>{n.body}</div>
              {!n.notice_date && (
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.danger }}>no calendar date</span>
              )}
              <button className="foc icon-btn" onClick={(e) => { e.stopPropagation(); setRemoving(n); }} aria-label="Remove notice" style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0 }}><Trash2 size={13} /></button>
            </div>
          ))}
          {rows.length === 0 && <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on file — add this month's meeting/dues lines off the printed sheet.</div>}
        </div>
      )}
      {formOpen && (
        <Modal title={editingRow ? "Edit notice" : "Add notice"} onClose={() => setFormOpen(false)}>
          <NoticeForm initial={editingRow} onSaved={load} onClose={() => setFormOpen(false)} />
        </Modal>
      )}
      {removing && (
        <ConfirmModal
          title="Remove this notice?"
          message={<>This removes <strong style={{ color: C.hi }}>{removing.body}</strong> from what apprentices see on Home and Board.</>}
          confirmLabel="Remove notice"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { await remove(removing.id); setRemoving(null); }}
        />
      )}
    </div>
  );
}
