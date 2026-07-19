"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { C, SHADOW, FM } from "@/lib/core";
import { req, PwField } from "@/components/admin/shared";

/* ---------- settings: create a brand-new admin account. Admins are always
   their own accounts — never an apprentice promoted in place — so this
   mirrors NewApprenticeForm but hits create-admin, which sets is_admin from
   the moment the account exists. It never touches (or appears on) the
   roster, since load() only ever pulls is_admin = false profiles. ---------- */
export function NewAdminForm({ onCreated }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setState("error"); setMsg("Password needs 8+ characters."); return; }
    setState("saving");
    setMsg("");
    try {
      await req("POST", "/api/admin/create-admin", { email: email.trim().toLowerCase(), password: pw, name: name.trim() || undefined });
      setState("done");
      setEmail(""); setName(""); setPw("");
      onCreated();
    } catch (e2) {
      setState("error");
      setMsg(e2.message);
    }
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>CREATE ADMIN ACCOUNT</div>
      <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
        Admins are always their own separate account, never an apprentice promoted in place — this one won't appear on the roster or have OJT hours of its own.
      </div>
      <form onSubmit={submit}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NAME (optional)</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Admin"
          style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", color: C.hi, fontSize: 14, marginBottom: 12 }} />
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>TEMP PASSWORD</div>
        <div style={{ marginBottom: 14 }}>
          <PwField value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters — tell them this directly" />
        </div>
        <button type="submit" disabled={state === "saving" || !email.trim() || !pw}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 14 }}>
          <ShieldCheck size={15} /> {state === "saving" ? "Creating…" : state === "done" ? "Admin account created" : "Create admin account"}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
      </form>
    </div>
  );
}
