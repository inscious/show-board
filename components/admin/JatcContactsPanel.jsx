"use client";

/* JATC office contacts — same shared/admin-write shape as the company
   directory (components/admin/CompanyDirectoryPanel.jsx). */
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM } from "@/lib/core";
import { Modal, ConfirmModal, Avatar, req } from "@/components/admin/shared";

function JatcContactForm({ onSaved, onClose }) {
  const [form, setForm] = useState({ name: "", tel: "", ext: "", email: "", sms: "" });
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  const fieldStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14 };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setState("error"); setMsg("Contact needs a name."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/jatc-contacts", { ...form, id: "jc" + Date.now().toString(36) });
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
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NAME</div>
      <input required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PHONE</div>
          <input value={form.tel} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} style={{ ...fieldStyle, width: "100%" }} />
        </div>
        <div style={{ flex: "0 1 80px" }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EXT</div>
          <input value={form.ext} onChange={(e) => setForm((f) => ({ ...f, ext: e.target.value }))} style={{ ...fieldStyle, width: "100%" }} />
        </div>
      </div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
      <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>SMS NUMBER</div>
      <input value={form.sms} onChange={(e) => setForm((f) => ({ ...f, sms: e.target.value }))}
        style={{ ...fieldStyle, width: "100%", marginBottom: 14 }} />
      <button type="submit" disabled={state === "saving"}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? "#06120C" : "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
        {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Save contact"}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
    </form>
  );
}

export function JatcContactsPanel() {
  const [rows, setRows] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState(null); // contact row, or null

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("jatc_contacts").select("*").order("name");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await req("DELETE", "/api/admin/jatc-contacts", { id });
    load();
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>JATC OFFICE CONTACTS{rows ? " — " + rows.length : ""}</div>
        <button className="foc" onClick={() => setFormOpen(true)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.gc, fontSize: 11.5, fontWeight: 700, padding: 0 }}>+ Add</button>
      </div>
      {rows === null ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
              <Avatar name={c.name} email={c.email} size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: C.hi }}>{c.name}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: C.mid, marginTop: 1 }}>
                  {[c.tel && c.ext ? c.tel + " ext " + c.ext : c.tel, c.email, c.sms ? "sms " + c.sms : null].filter(Boolean).join(" · ") || "no details on file"}
                </div>
              </div>
              <button className="foc icon-btn" onClick={() => setRemoving(c)} style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0 }}><Trash2 size={13} /></button>
            </div>
          ))}
          {rows.length === 0 && <div style={{ fontSize: 12.5, color: C.lo }}>Nothing on file yet.</div>}
        </div>
      )}
      {formOpen && (
        <Modal title="Add JATC contact" onClose={() => setFormOpen(false)}>
          <JatcContactForm onSaved={load} onClose={() => setFormOpen(false)} />
        </Modal>
      )}
      {removing && (
        <ConfirmModal
          title="Remove this contact?"
          message={<>This permanently deletes <strong style={{ color: C.hi }}>{removing.name}</strong> from the JATC office directory apprentices see. It's not recoverable — you'd need to re-enter their info from scratch.</>}
          confirmLabel="Remove contact"
          onClose={() => setRemoving(null)}
          onConfirm={async () => { await remove(removing.id); setRemoving(null); }}
        />
      )}
    </div>
  );
}
