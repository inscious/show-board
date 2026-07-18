"use client";

/* Company directory — shared I&D labor-shop list. Fetches its own data,
   same reasoning as AuditLogPanel: Settings-only content nobody needs on
   every load(). name is the primary key (unique in supabase/schema.sql) and
   the API POST is a true upsert on it — editing an existing row keeps name
   locked, since typing a different name there would insert a second row
   under the new name rather than rename the original, orphaning it. */
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, coColor } from "@/lib/core";
import { Modal, ConfirmModal, req } from "@/components/admin/shared";

function CompanyForm({ onSaved, onClose, initial }) {
  const [form, setForm] = useState(() => initial
    ? { name: initial.name || "", city: initial.city || "", state: initial.state || "", laborLine: initial.labor_line || "", foreman: initial.foreman || "" }
    : { name: "", city: "", state: "", laborLine: "", foreman: "" });
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  const fieldStyle = { flex: "1 1 120px", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14 };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setState("error"); setMsg("Company needs a name."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/companies", form);
      setState("done");
      onSaved();
      setTimeout(onClose, 900);
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>COMPANY NAME</div>
      <input required autoFocus={!initial} disabled={!!initial} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: initial ? 4 : 12, opacity: initial ? 0.6 : 1 }} />
      {initial && <div style={{ fontSize: 10.5, color: C.lo, marginBottom: 12 }}>Name can't be changed here — delete and re-add to rename.</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CITY</div>
          <input autoFocus={!!initial} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={{ ...fieldStyle, width: "100%" }} />
        </div>
        <div style={{ flex: "0 1 80px" }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>STATE</div>
          <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={{ ...fieldStyle, width: "100%" }} />
        </div>
      </div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>LABOR LINE</div>
      <input value={form.laborLine} onChange={(e) => setForm((f) => ({ ...f, laborLine: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>FOREMAN</div>
      <input value={form.foreman} onChange={(e) => setForm((f) => ({ ...f, foreman: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: 14 }} />
      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Saving…" : state === "done" ? "Saved" : initial ? "Save changes" : "Save company"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

export function CompanyDirectoryPanel() {
  const [rows, setRows] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [removing, setRemoving] = useState(null); // company row, or null

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("companies").select("*").order("name");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (name) => {
    await req("DELETE", "/api/admin/companies", { name });
    load();
  };
  const openAdd = () => { setEditingRow(null); setFormOpen(true); };
  const openEdit = (row) => { setEditingRow(row); setFormOpen(true); };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>COMPANY DIRECTORY{rows ? " — " + rows.length : ""}</div>
        <button className="foc" onClick={openAdd} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.gc, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Add</button>
      </div>
      {rows === null ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {rows.map((c) => {
            const accent = coColor(c.name);
            return (
            <div key={c.name} className="foc" role="button" tabIndex={0}
              onClick={() => openEdit(c)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(c); } }}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px 8px 0" }}>
              <span style={{ width: 3, alignSelf: "stretch", borderRadius: "0 2px 2px 0", background: accent, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{c.name}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>
                  {[c.city && c.state ? c.city + ", " + c.state : c.city || c.state, c.labor_line, c.foreman].filter(Boolean).join(" · ") || "no details on file"}
                </div>
              </div>
              <button className="foc icon-btn" onClick={(e) => { e.stopPropagation(); setRemoving(c); }}
                style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0, marginRight: 4 }}><Trash2 size={13} /></button>
            </div>
            );
          })}
          {rows.length === 0 && <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on file yet.</div>}
        </div>
      )}
      {formOpen && (
        <Modal title={editingRow ? "Edit company" : "Add company"} onClose={() => setFormOpen(false)}>
          <CompanyForm initial={editingRow} onSaved={load} onClose={() => setFormOpen(false)} />
        </Modal>
      )}
      {removing && (
        <ConfirmModal
          title="Remove this company?"
          message={<>This permanently deletes <strong style={{ color: C.hi }}>{removing.name}</strong> from the directory. It's not recoverable — you'd need to re-enter it from scratch.</>}
          confirmLabel="Remove company"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { await remove(removing.name); setRemoving(null); }}
        />
      )}
    </div>
  );
}
