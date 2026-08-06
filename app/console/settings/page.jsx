"use client";

import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { C, SHADOW, FM } from "@/lib/core";
import { req } from "@/components/admin/shared";
import { usePlatform } from "@/lib/PlatformContext";

function PwInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
        aria-label={placeholder}
        style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 34px 10px 12px", color: C.hi, fontSize: 14 }} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: C.lo, padding: 2, display: "flex" }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function PasswordPanel() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | done | error
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setState("error"); setMsg("At least 8 characters."); return; }
    if (pw !== pw2) { setState("error"); setMsg("Passwords don't match."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/console/set-password", { password: pw });
      setState("done");
      setPw("");
      setPw2("");
      setMsg("Password changed. You'll get an email confirming it.");
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PASSWORD</div>
      <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
        Changes the password on your Platform Console account. This is separate from any apprentice or union-admin login you may also have.
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PwInput value={pw} onChange={(e) => { setPw(e.target.value); setState("idle"); }} placeholder="new password (8+ characters)" />
          <PwInput value={pw2} onChange={(e) => { setPw2(e.target.value); setState("idle"); }} placeholder="retype password" />
        </div>
        <button type="submit" disabled={state === "saving" || !pw || !pw2}
          style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14, opacity: state === "saving" ? 0.6 : 1 }}>
          {state === "done" && <Check size={15} />}
          {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Change password"}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: state === "error" ? C.danger : C.working }}>{msg}</div>}
      </form>
    </div>
  );
}

function RolesPanel() {
  const [targetEmail, setTargetEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCentralAdmin, setIsCentralAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [foremanOfCompanyId, setForemanOfCompanyId] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/console/set-roles", {
        email: targetEmail.trim(),
        isAdmin,
        isCentralAdmin,
        organizationId: organizationId === "" ? null : Number(organizationId),
        foremanOfCompanyId: foremanOfCompanyId === "" ? null : Number(foremanOfCompanyId),
      });
      setState("done");
      setMsg("Roles updated. Logged to platform_audit_log.");
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>ROLE ASSIGNMENT</div>
      <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
        Testing/troubleshooting only — sets any account's role directly, crossing every union boundary. Bypasses each union's own admin flow entirely. Every change is logged.
      </div>
      <form onSubmit={submit}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>ACCOUNT EMAIL</div>
        <input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="apprentice@example.com"
          aria-label="Account email"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.mid }}>
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> is_admin
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.mid }}>
            <input type="checkbox" checked={isCentralAdmin} onChange={(e) => setIsCentralAdmin(e.target.checked)} /> is_central_admin
          </label>
        </div>

        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>ORGANIZATION ID (blank clears it)</div>
        <input type="number" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="e.g. 2"
          aria-label="Organization ID (blank clears it)"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />

        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>FOREMAN OF COMPANY ID (blank clears it)</div>
        <input type="number" value={foremanOfCompanyId} onChange={(e) => setForemanOfCompanyId(e.target.value)} placeholder="e.g. 1"
          aria-label="Foreman of company ID (blank clears it)"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 14 }} />

        <button type="submit" disabled={state === "saving" || !targetEmail.trim()}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14, opacity: state === "saving" ? 0.6 : 1 }}>
          {state === "done" && <Check size={15} />}
          {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Set roles"}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: state === "error" ? C.danger : C.working }}>{msg}</div>}
      </form>
    </div>
  );
}

export default function ConsoleSettingsPage() {
  const { email } = usePlatform();

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, marginBottom: 8 }}>ACCOUNT</div>
      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>SIGNED IN AS</div>
        <div style={{ fontSize: 14, color: C.hi }}>{email}</div>
      </div>
      <PasswordPanel />

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, margin: "20px 0 8px" }}>TESTING &amp; TROUBLESHOOTING</div>
      <RolesPanel />
    </>
  );
}
