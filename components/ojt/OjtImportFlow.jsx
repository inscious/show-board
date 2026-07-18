"use client";

/* Shared "upload OJT slips" flow — mounted from both app/pending/page.jsx
   (a self-signed-up apprentice waiting on approval) and the in-app OJT tab
   (components/ShowBoard.jsx, an already-approved apprentice backfilling
   history). Pure UI: picks files, calls /api/ojt-months/extract for a
   draft, lets the apprentice review/edit/remove rows, then hands the
   reviewed array to onSubmit — it does not persist anything itself, since
   the two call sites have different, already-correct ways to save (the
   in-app tab goes through the local-first store like every other OJT edit;
   /pending has no local store to go through, so it posts straight to the
   API, same as its existing manual form). Uploaded files never leave this
   one request — nothing is stored, nothing to clean up. */
import { useState } from "react";
import { Upload, Trash2, TriangleAlert, Plus } from "lucide-react";
import { C, SHADOW, FM, CATS_META, num } from "@/lib/core";

const fieldStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13.5 };

export function OjtImportFlow({ onSubmit, onCancel }) {
  const [files, setFiles] = useState([]);
  const [state, setState] = useState("pick"); // pick | scanning | review | submitting | error
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState([]); // [{ id, m, a, b, c, d, confidence }]

  const pickFiles = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;
    if (chosen.length > 4) {
      setMsg("Pick at most 4 files at a time — you can always run this again for the rest.");
      return;
    }
    setFiles(chosen);
    setMsg("");
  };

  const scan = async () => {
    if (files.length === 0) return;
    setState("scanning");
    setMsg("");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("file", f));
      const res = await fetch("/api/ojt-months/extract", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("pick");
        setMsg(body.error || "Couldn't scan those files.");
        return;
      }
      setRows(body.months.map((m, i) => ({
        id: m.month + "_" + i,
        m: m.month, a: String(m.cat_a ?? 0), b: String(m.cat_b ?? 0), c: String(m.cat_c ?? 0), d: String(m.cat_d ?? 0),
        confidence: m.confidence || "high",
      })));
      setState("review");
    } catch {
      setState("pick");
      setMsg("Network error — check your connection and try again.");
    }
  };

  const editRow = (id, key, val) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const submit = async () => {
    setState("submitting");
    setMsg("");
    try {
      await onSubmit(rows.map((r) => ({ m: r.m, a: num(r.a), b: num(r.b), c: num(r.c), d: num(r.d) })));
    } catch {
      setState("review");
      setMsg("Couldn't save — try again.");
    }
  };

  if (state === "review") {
    return (
      <div>
        <div style={{ fontSize: 12.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
          Check these against your slips before submitting — fix anything that's off, or remove a month entirely.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ background: C.raise, border: "1px solid " + (r.confidence === "low" ? "rgba(255,176,32,0.4)" : C.line), borderRadius: 10, padding: "11px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.hi, flex: 1 }}>{r.m}</div>
                {r.confidence === "low" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: C.brand, fontFamily: FM }}>
                    <TriangleAlert size={12} /> double-check
                  </span>
                )}
                <button type="button" onClick={() => removeRow(r.id)} style={{ background: "transparent", border: "none", color: C.lo, padding: 3, flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["a", "b", "c", "d"]).map((k) => (
                  <div key={k}>
                    <div style={{ fontSize: 9.5, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 3 }}>
                      {k.toUpperCase()} · {CATS_META[k.toUpperCase()].name}
                    </div>
                    <input type="number" min="0" step="0.5" value={r[k]} onChange={(e) => editRow(r.id, k, e.target.value)}
                      style={{ ...fieldStyle, width: "100%" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.lo }}>No months left to submit — go back and add one manually instead.</div>
          )}
        </div>
        {msg && <div style={{ marginBottom: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "transparent", border: "1px solid " + C.line, color: C.mid, fontWeight: 700, fontSize: 13.5 }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={rows.length === 0 || state === "submitting"}
            style={{ flex: 2, padding: "11px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 13.5, opacity: state === "submitting" ? 0.6 : 1 }}>
            {state === "submitting" ? "Saving…" : `Submit ${rows.length} month${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
        Photos or PDFs of your old OJT slips — up to 4 at a time. You'll review every number before anything is submitted.
      </div>
      <label style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        border: "1px dashed " + C.brand + "77", borderRadius: 12, padding: "26px 16px", cursor: "pointer",
        background: "rgba(255,176,32,0.05)", marginBottom: 12,
      }}>
        <Upload size={20} color={C.brand} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>
          {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose files"}
        </div>
        <div style={{ fontSize: 11, color: C.lo }}>JPG, PNG, or PDF · 8MB each</div>
        <input type="file" multiple accept="application/pdf,image/*" onChange={pickFiles} style={{ display: "none" }} />
      </label>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          {files.map((f, i) => (
            <div key={i} className="truncate" style={{ fontSize: 11.5, color: C.mid, fontFamily: FM }}>{f.name}</div>
          ))}
        </div>
      )}
      {msg && <div style={{ marginBottom: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "transparent", border: "1px solid " + C.line, color: C.mid, fontWeight: 700, fontSize: 13.5 }}>
          Cancel
        </button>
        <button type="button" onClick={scan} disabled={files.length === 0 || state === "scanning"}
          style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 13.5, opacity: state === "scanning" ? 0.6 : 1 }}>
          <Plus size={15} /> {state === "scanning" ? "Scanning…" : "Scan for hours"}
        </button>
      </div>
    </div>
  );
}
