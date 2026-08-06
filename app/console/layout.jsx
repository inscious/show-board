"use client";

/* Shared shell for /console/** — mirrors app/admin/layout.jsx exactly: client-side
   auth guard (belt-and-suspenders alongside middleware.js's isConsolePath branch),
   one shared data load, nav chrome. Minimal for Stage 1: organizations list +
   account settings, no cross-tenant "view into a union" yet (that needs
   its own RLS bypass + audit logging — Phase B, see the plan). */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutGrid, ScrollText, Search, Settings as SettingsIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS } from "@/lib/core";
import { PlatformContext } from "@/lib/PlatformContext";

const CONSOLE_TABS = [
  ["/console", "Organizations", LayoutGrid],
  ["/console/accounts", "Accounts", Search],
  ["/console/audit", "Audit Log", ScrollText],
  ["/console/settings", "Settings", SettingsIcon],
];

export default function PlatformLayout({ children }) {
  const pathname = usePathname();
  const [state, setState] = useState("loading"); // loading | ready
  const [email, setEmail] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("organizations").select("*").order("id");
    setOrganizations(data || []);
  }, []);

  // Organizations/metrics/settings all live here, fetched once for the whole
  // console session, instead of each page's own component fetching them
  // fresh every time — /console, /console/accounts, /console/audit are
  // separate route segments, so navigating between them remounts the page
  // (this shared layout does not remount), and a component-local fetch on
  // mount was refiring — and re-flashing its skeleton — on every switch back.
  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      // the platform_admin check and every read below need nothing but the
      // session getUser() already confirmed (RLS handles auth.uid()
      // implicitly) — run them all concurrently instead of one after
      // another, cuts several round-trips off the critical path before this
      // page can render anything.
      const [{ data: platformAdmin }, { data: orgs }, metricsRes, { data: appSettings }] = await Promise.all([
        supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle(),
        supabase.from("organizations").select("*").order("id"),
        fetch("/api/console/metrics").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (!platformAdmin) { window.location.href = "/login"; return; }
      if (!live) return;
      setEmail(user.email);
      setOrganizations(orgs || []);
      setMetrics(metricsRes);
      setSettings(appSettings || null);
      setState("ready");
    })();
    return () => { live = false; };
  }, []);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const ctx = { email, organizations, metrics, settings, load };

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
          <div className="skeleton" style={{ width: 160, height: 20, marginBottom: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton" style={{ height: 68 }} />
            <div className="skeleton" style={{ height: 68 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FS }}>
      <style>{`
        body input, body button { font-family: ${FS}; }
        .console-signout:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
        .console-signout{ transition: background-color .12s, border-color .12s, filter .12s, opacity .12s; cursor: pointer; }
        .console-tab:hover:not([data-active="true"]){ background: rgba(255,255,255,0.04); color: ${C.hi}; }
        .skip-link{ position: absolute; top: -100px; left: 12px; z-index: 100; background: ${C.brand}; color: ${C.ink}; font-weight: 800; font-size: 13px; padding: 10px 16px; border-radius: 8px; text-decoration: none; transition: top 0.15s ease; }
        .skip-link:focus{ top: 12px; }
      `}</style>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Boxes size={20} color={C.brand} />
          <div style={{ fontSize: 17, fontWeight: 800, color: C.hi }}>Platform Console</div>
          <button className="console-signout" disabled={signingOut} onClick={signOut}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, opacity: signingOut ? 0.6 : 1 }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <div className="truncate" style={{ fontSize: 11.5, color: C.lo, fontFamily: FM, marginBottom: 14 }}>{email}</div>

        <nav aria-label="Primary" style={{ display: "flex", gap: 6, background: C.panel, borderRadius: 12, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, marginBottom: 16 }}>
          {CONSOLE_TABS.map(([href, label, Icon]) => {
            const on = href === "/console" ? pathname === "/console" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="console-tab" data-active={on}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 9, fontSize: 13, fontWeight: 800, background: on ? C.brand : "transparent", color: on ? C.ink : C.mid, textDecoration: "none" }}>
                <Icon size={15} /> {label}
              </Link>
            );
          })}
        </nav>

        <main id="main-content">
          <PlatformContext.Provider value={ctx}>{children}</PlatformContext.Provider>
        </main>
      </div>
    </div>
  );
}
