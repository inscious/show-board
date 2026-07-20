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
import { useState, useEffect } from "react";
import { Upload, Trash2, TriangleAlert, Plus, ShieldAlert } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { C, SHADOW, FM, CATS_META, num, mAdd, mKey, mMed, todayMid } from "@/lib/core";

const fieldStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13.5 };

function monthOptions() {
  const t = todayMid();
  const nowKey = mKey(t.getFullYear(), t.getMonth());
  const out = [];
  for (let i = 0; i < 36; i++) out.push(mAdd(nowKey, -i));
  return out;
}

export function OjtImportFlow({ onSubmit, onCancel }) {
  const [files, setFiles] = useState([]);
  const [state, setState] = useState("pick"); // pick | scanning | review | submitting | manual | error
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState([]); // [{ id, m, a, b, c, d, confidence }]
  // day-by-day rows — only populated when a slip actually has the real
  // union form's DATE/A-D/COMPANY columns filled in, not every upload has
  // these (a monthly-totals-only sheet won't). Reviewed the same way as
  // months: editable, removable, nothing saved until Submit.
  const [dailyRows, setDailyRows] = useState([]); // [{ id, date, cat, hrs, co, confidence }]
  const [manual, setManual] = useState({ m: monthOptions()[1] || "", a: "", b: "", c: "", d: "" });
  // when on, everything submitted here lands approved immediately (see
  // protect_ojt_months_status in supabase/schema.sql) — no admin review
  // backstop, so both submit paths below gate behind one extra "these are
  // right" tap instead of saving on the first click.
  const [autoApprove, setAutoApprove] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState(null); // null | "review" | "manual"

  useEffect(() => {
    fetch("/api/settings/ojt-auto-approve")
      .then((r) => r.json())
      .then((d) => setAutoApprove(!!d.enabled))
      .catch(() => {});
  }, []);

  const pickFiles = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;
    if (chosen.length > 10) {
      setMsg("Pick at most 10 files at a time — you can always run this again for the rest.");
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
      setDailyRows((body.entries || []).map((e, i) => ({
        id: "d" + e.date + "_" + i,
        date: e.date, cat: e.category, hrs: String(e.hours ?? 0), co: e.company || "",
        confidence: e.confidence || "high",
      })));
      setState("review");
    } catch {
      setState("pick");
      setMsg("Network error — check your connection and try again.");
    }
  };

  const editRow = (id, key, val) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));
  const editDaily = (id, key, val) => setDailyRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const removeDaily = (id) => setDailyRows((prev) => prev.filter((r) => r.id !== id));

  const submit = async () => {
    setConfirmingAction(null);
    setState("submitting");
    setMsg("");
    try {
      await onSubmit({
        months: rows.map((r) => ({ m: r.m, a: num(r.a), b: num(r.b), c: num(r.c), d: num(r.d) })),
        entries: dailyRows.map((r) => ({ dayKey: r.date, co: r.co.trim(), cat: r.cat, hrs: num(r.hrs) })).filter((e) => e.co && e.hrs > 0),
      });
    } catch {
      setState("review");
      setMsg("Couldn't save — try again.");
    }
  };

  const submitManual = async () => {
    if (!manual.m) return;
    setConfirmingAction(null);
    setMsg("");
    try {
      await onSubmit({ months: [{ m: manual.m, a: num(manual.a), b: num(manual.b), c: num(manual.c), d: num(manual.d) }], entries: [] });
    } catch {
      setMsg("Couldn't save — try again.");
    }
  };

  const trySubmit = () => (autoApprove ? setConfirmingAction("review") : submit());
  const trySubmitManual = () => (autoApprove ? setConfirmingAction("manual") : submitManual());

  if (state === "manual") {
    return (
      <div>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>MONTH</div>
        <select value={manual.m} onChange={(e) => setManual((f) => ({ ...f, m: e.target.value }))}
          style={{ ...fieldStyle, width: "100%", marginBottom: 12 }}>
          {monthOptions().map((k) => <option key={k} value={k}>{mMed(k)}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {(["a", "b", "c", "d"]).map((k) => (
            <div key={k}>
              <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>
                {k.toUpperCase()} · {CATS_META[k.toUpperCase()].name}
              </div>
              <input type="number" min="0" step="0.5" value={manual[k]} onChange={(e) => setManual((f) => ({ ...f, [k]: e.target.value }))}
                placeholder="0" style={{ ...fieldStyle, width: "100%" }} />
            </div>
          ))}
        </div>
        {autoApprove && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 14, background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.3)", borderRadius: 9, padding: "10px 11px", fontSize: 11.5, color: C.mid, lineHeight: 1.45 }}>
            <ShieldAlert size={13} color={C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>This lands approved right away — no admin review first. Double-check the numbers before saving.</div>
          </div>
        )}
        {msg && <div style={{ marginBottom: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setState("pick")} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "transparent", border: "1px solid " + C.line, color: C.mid, fontWeight: 700, fontSize: 13.5 }}>
            Back
          </button>
          <button type="button" onClick={trySubmitManual} disabled={!manual.m}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 9, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 13.5 }}>
            <Plus size={15} /> Add month
          </button>
        </div>
        {confirmingAction === "manual" && (
          <ConfirmModal
            title={"Approve " + mMed(manual.m) + " right now?"}
            message={<>
              A {manual.a || 0} · B {manual.b || 0} · C {manual.c || 0} · D {manual.d || 0} — will count toward your total immediately, with no admin review.{" "}
              <strong style={{ color: C.hi }}>Make sure these match your slip.</strong>
            </>}
            confirmLabel="Numbers are right — save"
            tone="confirm"
            onClose={() => setConfirmingAction(null)}
            onConfirm={submitManual}
          />
        )}
      </div>
    );
  }

  if (state === "review") {
    return (
      <div>
        <div style={{ fontSize: 12.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
          {autoApprove
            ? "These land approved right away — no admin review first. Check every number against your slips before submitting."
            : "Check these against your slips before submitting — fix anything that's off, or remove a month entirely."}
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

        {dailyRows.length > 0 && (
          <>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
              DAILY HOURS FOUND — {dailyRows.length} day{dailyRows.length === 1 ? "" : "s"}
            </div>
            <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
              Your slip had a day-by-day breakdown — these can also fill in your work calendar so it matches what you already turned in. Skip a row if it's wrong; you can always add or fix a day later.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {dailyRows.map((r) => (
                <div key={r.id} style={{ background: C.raise, border: "1px solid " + (r.confidence === "low" ? "rgba(255,176,32,0.4)" : C.line), borderRadius: 10, padding: "10px 11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="date" value={r.date} onChange={(e) => editDaily(r.id, "date", e.target.value)}
                      style={{ ...fieldStyle, flex: 1, fontSize: 12.5 }} />
                    <select value={r.cat} onChange={(e) => editDaily(r.id, "cat", e.target.value)}
                      style={{ ...fieldStyle, width: 56, flexShrink: 0 }}>
                      {(["A", "B", "C", "D"]).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    {r.confidence === "low" && (
                      <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <TriangleAlert size={13} color={C.brand} />
                      </span>
                    )}
                    <button type="button" onClick={() => removeDaily(r.id)} style={{ background: "transparent", border: "none", color: C.lo, padding: 3, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={r.co} onChange={(e) => editDaily(r.id, "co", e.target.value)} placeholder="Company"
                      style={{ ...fieldStyle, flex: 2 }} />
                    <input type="number" min="0" step="0.5" value={r.hrs} onChange={(e) => editDaily(r.id, "hrs", e.target.value)} placeholder="Hours"
                      style={{ ...fieldStyle, flex: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {msg && <div style={{ marginBottom: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "transparent", border: "1px solid " + C.line, color: C.mid, fontWeight: 700, fontSize: 13.5 }}>
            Cancel
          </button>
          <button type="button" onClick={trySubmit} disabled={rows.length === 0 || state === "submitting"}
            style={{ flex: 2, padding: "11px", borderRadius: 9, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 13.5, opacity: state === "submitting" ? 0.6 : 1 }}>
            {state === "submitting"
              ? "Saving…"
              : `Submit ${rows.length} month${rows.length === 1 ? "" : "s"}` + (dailyRows.length > 0 ? ` + ${dailyRows.length} day${dailyRows.length === 1 ? "" : "s"}` : "")}
          </button>
        </div>
        {confirmingAction === "review" && (
          <ConfirmModal
            title={`Approve ${rows.length} month${rows.length === 1 ? "" : "s"} right now?`}
            message={<>
              {rows.map((r) => mMed(r.m)).join(", ")} will count toward your total immediately, with no admin review.{" "}
              <strong style={{ color: C.hi }}>Make sure these match your slips.</strong>
            </>}
            confirmLabel="Numbers are right — save"
            tone="confirm"
            onClose={() => setConfirmingAction(null)}
            onConfirm={submit}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
        Photos or PDFs of your old OJT slips — up to 10 at a time. You'll review every number before anything is submitted. If a slip has the day-by-day columns filled in, those days can also fill in your work calendar.
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
          style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 9, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 13.5, opacity: state === "scanning" ? 0.6 : 1 }}>
          <Plus size={15} /> {state === "scanning" ? "Scanning…" : "Scan for hours"}
        </button>
      </div>
      <button type="button" onClick={() => setState("manual")}
        style={{ width: "100%", marginTop: 14, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
        No slip handy? Type a month in manually
      </button>
    </div>
  );
}
