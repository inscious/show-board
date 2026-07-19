"use client";

import { useState } from "react";
import { Mail, HardHat, Lock, User, Eye, EyeOff } from "lucide-react";
import { C, SHADOW, FM, FS } from "@/lib/core";

// live admin toggle (Settings → Apprentice Sign-Up), not a build-time flag —
// middleware.js already fully gates this route server-side against
// app_settings before this page ever renders, so there's nothing to check
// here client-side anymore.

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | error
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().split(/\s+/).filter(Boolean).length < 2) {
      setState("error");
      setMsg("Enter your first and last name.");
      return;
    }
    if (password !== confirm) {
      setState("error");
      setMsg("Passwords don't match.");
      return;
    }
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState("error");
        setMsg("Too many attempts. Wait a while and try again.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMsg(body.error || "Couldn't create that account.");
        return;
      }
      // Confirmed live: this Supabase project has email confirmation OFF,
      // so signUp() already returned an active session — the route's
      // cookie-backed client set it on this response. Full navigation
      // (not client-side) so middleware re-reads it and routes to
      // /pending. (If that ever changes in the Supabase dashboard, this
      // will start silently bouncing to /login instead — the fix then is
      // a "check your email" step here, not this comment.)
      window.location.href = "/";
    } catch {
      setState("error");
      setMsg("Network error — check your connection and try again.");
    }
  };

  return (
    <div className="login-shell" style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: FS, background: C.bg,
      backgroundImage: `radial-gradient(560px 420px at 50% 18%, rgba(255,176,32,0.10), transparent 65%)`,
    }}>
      <style>{`
        .login-shell input, .login-shell button { font-family: ${FS}; }
        .login-shell .login-field:focus-within{ border-color: ${C.brand}99 !important; box-shadow: 0 0 0 3px rgba(255,176,32,0.12); }
        .login-shell .login-submit:hover:not(:disabled){ filter: brightness(1.08); }
        .login-shell .login-link:hover{ color: ${C.brand}; }
        .login-shell button{ transition: filter .12s, color .12s, box-shadow .15s, border-color .15s; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 360, background: C.panel, border: "1px solid " + C.edge, borderRadius: 18, padding: "26px 24px", boxShadow: SHADOW + ", 0 0 60px rgba(255,176,32,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${C.brand}, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.35)", flexShrink: 0 }}>
            <HardHat size={18} color={C.brand} />
          </span>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.hi }}>L831 Tracker</div>
        </div>
        <div style={{ fontSize: 11.5, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 20 }}>CREATE AN ACCOUNT</div>

        <form onSubmit={submit}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>NAME</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <User size={15} color={C.lo} />
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Apprentice"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <Mail size={15} color={C.lo} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PASSWORD</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <Lock size={15} color={C.lo} />
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ characters"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                style={{ background: "transparent", border: "none", color: C.lo, padding: 2, display: "flex", flexShrink: 0 }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>RETYPE PASSWORD</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <Lock size={15} color={C.lo} />
              <input
                type={showPw ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="8+ characters"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
            </div>
            <button
              className="login-submit"
              type="submit"
              disabled={state === "sending" || !name.trim() || !email.trim() || !password || !confirm}
              style={{ width: "100%", padding: "12px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 14, opacity: state === "sending" ? 0.6 : 1, boxShadow: "0 4px 14px rgba(255,176,32,0.22)" }}
            >
              {state === "sending" ? "Creating account…" : "Create account"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
            <div style={{ fontSize: 11, color: C.lo, lineHeight: 1.5, marginTop: 14 }}>
              Your account still needs an admin to approve it before you get full access — that's normal, not an error.
            </div>
            <a className="login-link" href="/login"
              style={{ display: "block", textAlign: "center", width: "100%", marginTop: 16, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              Already have an account? Sign in
            </a>
        </form>
      </div>
    </div>
  );
}
