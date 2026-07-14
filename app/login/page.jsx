"use client";

import { useState } from "react";
import { Mail, HardHat, Lock, Eye, EyeOff } from "lucide-react";
import { C, SHADOW } from "@/lib/core";

export default function LoginPage() {
  const [mode, setMode] = useState("password"); // password | magiclink
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");

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

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, background: C.panel, border: "1px solid " + C.edge, borderRadius: 16, padding: 24, boxShadow: SHADOW }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <HardHat size={22} color={C.brand} />
          <div style={{ fontWeight: 800, fontSize: 18, color: C.hi }}>Show Board</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.mid, marginBottom: 18 }}>IUPAT Local 831</div>

        {state === "sent" ? (
          <div style={{ fontSize: 13.5, color: C.hi, lineHeight: 1.5 }}>
            Check <strong>{email.trim()}</strong> for a sign-in link. It expires shortly — request a new one if it's been a while.
          </div>
        ) : mode === "password" ? (
          <form onSubmit={submitPassword}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: "monospace", marginBottom: 4 }}>EMAIL</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
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
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: "monospace", marginBottom: 4 }}>PASSWORD</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
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
              type="submit"
              disabled={state === "sending" || !email.trim() || !password}
              style={{ width: "100%", padding: "11px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 14, opacity: state === "sending" ? 0.6 : 1 }}
            >
              {state === "sending" ? "Signing in…" : "Sign in"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
            <button type="button" onClick={() => switchMode("magiclink")}
              style={{ width: "100%", marginTop: 14, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              Email me a sign-in link instead
            </button>
          </form>
        ) : (
          <form onSubmit={submitMagicLink}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: "monospace", marginBottom: 4 }}>EMAIL</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
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
              type="submit"
              disabled={state === "sending" || !email.trim()}
              style={{ width: "100%", padding: "11px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 14, opacity: state === "sending" ? 0.6 : 1 }}
            >
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
            <button type="button" onClick={() => switchMode("password")}
              style={{ width: "100%", marginTop: 14, background: "transparent", border: "none", color: C.gc, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              Sign in with a password instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
