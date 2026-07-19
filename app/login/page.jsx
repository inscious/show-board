"use client";

import { useEffect, useState } from "react";
import { Mail, HardHat, Lock, Eye, EyeOff, ArrowLeft, UserPlus } from "lucide-react";
import { C, SHADOW, FM, FS } from "@/lib/core";

export default function LoginPage() {
  const [mode, setMode] = useState("password"); // password | magiclink
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");
  // live admin toggle (Settings → Apprentice Sign-Up), fetched at runtime —
  // was a build-time env var, but that needed a redeploy to change.
  const [signupEnabled, setSignupEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/settings/self-signup")
      .then((r) => r.json())
      .then((d) => setSignupEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  const submitPassword = async (e) => {
    e.preventDefault();
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState("error");
        setMsg("Too many attempts. Wait a few minutes and try again.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMsg(body.error || "Couldn't sign in. Try again.");
        return;
      }
      window.location.href = "/";
    } catch {
      setState("error");
      setMsg("Network error — check your connection and try again.");
    }
  };

  const submitMagicLink = async (e) => {
    e.preventDefault();
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState("error");
        setMsg("Too many attempts. Wait a few minutes and try again.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMsg(body.error || "Couldn't send the link. Try again.");
        return;
      }
      setState("sent");
    } catch {
      setState("error");
      setMsg("Network error — check your connection and try again.");
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setState("idle");
    setMsg("");
  };

  // the "check your email" screen used to be a dead end — nothing on it
  // could get back to the form, only a hard refresh. This is that way back.
  const backToForm = () => {
    setState("idle");
    setMsg("");
  };

  return (
    <div className="login-shell" style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: FS, background: C.bg,
      backgroundImage: `radial-gradient(560px 420px at 50% 18%, rgba(255,176,32,0.10), transparent 65%)`,
    }}>
      {/* dangerouslySetInnerHTML, not a text child: FS/FM carry quoted font
          names ("Segoe UI"), and browsers parse <style> as RAWTEXT — they
          don't HTML-decode entities in it. A text child gets server-escaped
          to &quot;, which never decodes back on the client, so hydration
          sees mismatched text every load. Raw innerHTML skips the escaping
          step entirely. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .login-shell input, .login-shell button, .login-shell a { font-family: ${FS}; }
        .login-shell .login-field:focus-within{ border-color: ${C.brand}99 !important; box-shadow: 0 0 0 3px rgba(255,176,32,0.12); }
        .login-shell .login-submit:hover:not(:disabled){ filter: brightness(1.08); }
        .login-shell .login-signup-btn:hover{ background: ${C.brand}14 !important; border-color: ${C.brand} !important; }
        .login-shell .login-link:hover{ color: ${C.brand}; }
        .login-shell button{ transition: filter .12s, color .12s, box-shadow .15s, border-color .15s; }
      ` }} />
      <div style={{ width: "100%", maxWidth: 360, background: C.panel, border: "1px solid " + C.edge, borderRadius: 18, padding: "26px 24px", boxShadow: SHADOW + ", 0 0 60px rgba(255,176,32,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${C.brand}, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.35)", flexShrink: 0 }}>
            <HardHat size={18} color={C.brand} />
          </span>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.hi }}>L831 Tracker</div>
        </div>
        <div style={{ fontSize: 11.5, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 20 }}>IUPAT LOCAL 831</div>

        {state === "sent" ? (
          <div>
            <div style={{ fontSize: 13.5, color: C.hi, lineHeight: 1.5 }}>
              Check <strong>{email.trim()}</strong> for a sign-in link. It expires shortly — request a new one if it's been a while.
            </div>
            <button className="login-link" type="button" onClick={backToForm}
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        ) : mode === "password" ? (
          <form onSubmit={submitPassword}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <Mail size={15} color={C.lo} />
              <input
                type="email"
                required
                autoFocus
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                style={{ background: "transparent", border: "none", color: C.lo, padding: 2, display: "flex", flexShrink: 0 }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              className="login-submit"
              type="submit"
              disabled={state === "sending" || !email.trim() || !password}
              style={{ width: "100%", padding: "12px", borderRadius: 9, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 14, opacity: state === "sending" ? 0.6 : 1, boxShadow: "0 4px 14px rgba(255,176,32,0.22)" }}
            >
              {state === "sending" ? "Signing in…" : "Sign in"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
            <button className="login-link" type="button" onClick={() => switchMode("magiclink")}
              style={{ width: "100%", marginTop: 16, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              Email me a sign-in link instead
            </button>
            {signupEnabled && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                  <span style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM }}>NEW APPRENTICE</span>
                  <span style={{ flex: 1, height: 1, background: C.line }} />
                </div>
                <a href="/signup" className="login-signup-btn foc"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "10px", borderRadius: 9, background: "transparent", border: "1px solid " + C.brand + "55", color: C.brand, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                  <UserPlus size={15} /> Create an account
                </a>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={submitMagicLink}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>EMAIL</div>
            <div className="login-field" style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12, transition: "border-color .15s, box-shadow .15s" }}>
              <Mail size={15} color={C.lo} />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.hi, fontSize: 14 }}
              />
            </div>
            <button
              className="login-submit"
              type="submit"
              disabled={state === "sending" || !email.trim()}
              style={{ width: "100%", padding: "12px", borderRadius: 9, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 14, opacity: state === "sending" ? 0.6 : 1, boxShadow: "0 4px 14px rgba(255,176,32,0.22)" }}
            >
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
            <button className="login-link" type="button" onClick={() => switchMode("password")}
              style={{ width: "100%", marginTop: 16, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              Sign in with a password instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
