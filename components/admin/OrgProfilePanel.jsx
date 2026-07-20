"use client";

/* Admin-editable org identity — union name, out-of-work line, JATC office
   address. First slice of the "union profile" concept (platform-vision
   memory): app_settings.org_profile is a single JSONB blob so future
   fields land here without another migration. Same self-fetch-on-mount
   pattern as SelfSignupPanel/OjtAutoApprovePanel, just a form instead of
   a toggle. The phone number is one input here — fmtTel() derives the
   display-formatted version before saving, so the admin isn't typing the
   same number twice in two formats. */
import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { C, SHADOW, FM, fmtTel } from "@/lib/core";
import { req } from "@/components/admin/shared";

const fieldStyle = { width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 };

export function OrgProfilePanel() {
  const [form, setForm] = useState(null); // null = loading
  const [state, setState] = useState("idle"); // idle | saving | done | error
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/org-profile")
      .then((r) => r.json())
      .then((d) => setForm({ unionName: d.unionName, outOfWorkLine: d.outOfWorkLinePretty || fmtTel(d.outOfWorkLine), jatcOfficeAddress: d.jatcOfficeAddress }))
      .catch(() => setForm({ unionName: "", outOfWorkLine: "", jatcOfficeAddress: "" }));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const digits = form.outOfWorkLine.replace(/\D/g, "");
    if (digits.length !== 10) { setState("error"); setMsg("Out-of-work line needs a 10-digit phone number."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/org-profile", {
        unionName: form.unionName.trim(),
        outOfWorkLine: digits,
        outOfWorkLinePretty: fmtTel(digits),
        jatcOfficeAddress: form.jatcOfficeAddress.trim(),
      });
      setState("done");
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  if (!form) {
    return (
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div className="skeleton" style={{ height: 90, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>ORG PROFILE</div>
      <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
        Shown throughout the app — login page, dashboard header, the out-of-work call button, JATC contacts. Takes effect immediately, no redeploy.
      </div>
      <form onSubmit={submit}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>UNION NAME</div>
        <input value={form.unionName} onChange={(e) => set("unionName", e.target.value)} placeholder="IUPAT Local 831"
          style={fieldStyle} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>OUT-OF-WORK LINE</div>
        <input value={form.outOfWorkLine} onChange={(e) => set("outOfWorkLine", e.target.value)} placeholder="(626) 296-8075"
          style={fieldStyle} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>JATC OFFICE ADDRESS</div>
        <input value={form.jatcOfficeAddress} onChange={(e) => set("jatcOfficeAddress", e.target.value)} placeholder="14930 Marquardt Ave, Santa Fe Springs, CA 90670"
          style={{ ...fieldStyle, marginBottom: 14 }} />
        <button type="submit" disabled={state === "saving" || !form.unionName.trim() || !form.outOfWorkLine.trim() || !form.jatcOfficeAddress.trim()}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14 }}>
          <Save size={15} /> {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Save org profile"}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
      </form>
    </div>
  );
}
