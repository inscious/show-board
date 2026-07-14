"use client";

/* Admin-only schedule editing — add/edit a single show, or bulk-import from
   a pasted PDF table. Lives here (not components/ShowBoard.jsx) because only
   the admin dashboard (app/admin) uses it now; the apprentice board is read-only. */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { C, FM, FS, REGION_KEYS, detectRegion } from "@/lib/core";

export const EMPTY = { name: "", mi: "", start: "", end: "", loc: "", booth: "", co: "", region: "AUTO", status: null };

function Field({ label, value, onChange, ph, w }) {
  return (
    <div style={{ flex: w || 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>{label}</div>
      <input className="foc" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph}
        style={{ width: "100%", background: C.sunk, color: C.hi, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 10px", fontSize: 14, fontFamily: FS }} />
    </div>
  );
}

export function ShowForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || EMPTY);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const region = f.region === "AUTO" ? detectRegion(f.loc) : f.region;
    onSave({ ...f, region, name: f.name.trim() || "Untitled show" });
  };
  return (
    <div>
      <Field label="SHOW NAME" value={f.name} onChange={(v) => set("name", v)} ph="e.g. COMIC-CON" />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Field label="MOVE IN" value={f.mi} onChange={(v) => set("mi", v)} ph="7/8" />
        <Field label="START" value={f.start} onChange={(v) => set("start", v)} ph="7/13" />
        <Field label="END" value={f.end} onChange={(v) => set("end", v)} ph="7/17" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Field label="LOCATION" value={f.loc} onChange={(v) => set("loc", v)} ph="SDCC" w={2} />
        <Field label="HALL / BOOTH" value={f.booth} onChange={(v) => set("booth", v)} ph="300" w={1} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Field label="GENERAL (COMPANY)" value={f.co} onChange={(v) => set("co", v)} ph="FREEMAN / GES / SHEPARD" w={2} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>REGION</div>
          <select className="foc" value={f.region} onChange={(e) => set("region", e.target.value)}
            style={{ width: "100%", background: C.sunk, color: C.hi, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 8px", fontSize: 14, fontFamily: FS }}>
            <option value="AUTO">Auto</option>
            {REGION_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button className="foc" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontWeight: 600, fontSize: 14 }}>Cancel</button>
        <button className="foc" onClick={save} style={{ flex: 2, padding: "12px", borderRadius: 10, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>Save show</button>
      </div>
    </div>
  );
}

/* one show per line: move-in, start, end, name, location, booth, company —
   separated by a tab or 2+ spaces (how pasted PDF table columns line up).
   Lines that don't start with an M/D date are dropped, matching the hint text below. */
export function parseImport(text) {
  const dateRe = /^\d{1,2}\/\d{1,2}$/;
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+|\s{2,}/).map((f) => f.trim()).filter(Boolean))
    .filter((f) => f.length >= 4 && dateRe.test(f[0]))
    .map((f) => {
      const [mi, start, end, name, loc = "", booth = "", co = ""] = f;
      return { mi, start, end, name, loc, booth, co, region: detectRegion(loc) };
    });
}

export function ImportForm({ onAdd, onClose }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [skip, setSkip] = useState({});
  const parse = () => { const r = parseImport(text); setRows(r); setSkip({}); };
  const add = () => { onAdd(rows.filter((_, i) => !skip[i])); onClose(); };
  return (
    <div>
      <div style={{ color: C.mid, fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
        Paste rows straight from the schedule PDF (one show per line). It reads <span style={{ fontFamily: FM, color: C.hi }}>move-in · start · end · name · location · booth · company</span>. Review below, then add.
      </div>
      <textarea className="foc" value={text} onChange={(e) => setText(e.target.value)} rows={5}
        placeholder={"7/8  7/14  7/16  ESRI  SDCC  300  FREEMAN"}
        style={{ width: "100%", resize: "vertical", background: C.sunk, color: C.hi, border: "1px solid " + C.line, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: FM }} />
      <button className="foc" onClick={parse} disabled={!text.trim()}
        style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 10, background: text.trim() ? C.raise : C.panel, color: text.trim() ? C.hi : C.lo, border: "1px solid " + C.line, fontWeight: 700, fontSize: 14 }}>
        Preview
      </button>

      {rows && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: C.lo, fontFamily: FM, marginBottom: 8 }}>{rows.length} ROW{rows.length === 1 ? "" : "S"} FOUND</div>
          {rows.length === 0 && <div style={{ color: C.mid, fontSize: 13 }}>Nothing parsed. Make sure each line starts with dates like 7/8.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "34vh", overflowY: "auto" }}>
            {rows.map((r, i) => (
              <button key={i} className="foc" onClick={() => setSkip((p) => ({ ...p, [i]: !p[i] }))}
                style={{ textAlign: "left", display: "flex", gap: 8, alignItems: "center", background: C.sunk, borderRadius: 8, padding: "8px 10px", border: "1px solid " + C.line, opacity: skip[i] ? 0.4 : 1 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, border: "1px solid " + C.line, background: skip[i] ? "transparent" : C.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {!skip[i] && <Check size={13} color="#1A1206" />}
                </span>
                <span style={{ fontFamily: FM, fontSize: 12, color: C.brand, flexShrink: 0, width: 40 }}>{r.mi || r.start || "?"}</span>
                <span className="min-w-0" style={{ minWidth: 0 }}>
                  <span className="truncate" style={{ display: "block", fontWeight: 700, fontSize: 13, color: C.hi }}>{r.name}</span>
                  <span className="truncate" style={{ display: "block", fontSize: 11, color: C.mid }}>{r.loc} · {r.co}</span>
                </span>
              </button>
            ))}
          </div>
          {rows.length > 0 && (
            <button className="foc" onClick={add}
              style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 14 }}>
              Add {rows.filter((_, i) => !skip[i]).length} to board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
