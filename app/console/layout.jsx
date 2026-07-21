"use client";

/* Shared shell for /console/** — mirrors app/admin/layout.jsx exactly: client-side
   auth guard (belt-and-suspenders alongside middleware.js's isHqPath branch),
   one shared data load, nav chrome. Minimal for Stage 1: just the
   organizations list, no cross-tenant "view into a union" yet (that needs
   its own RLS bypass + audit logging — Phase B, see the plan). */
import React, { useState, useEffect, useCallback } from "react";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS } from "@/lib/core";
import { PlatformContext } from "@/lib/PlatformContext";

export default function PlatformLayout({ children }) {
  const [state, setState] = useState("loading"); // loading | ready
  const [email, setEmail] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("organizations").select("*").order("id");
    setOrganizations(data || []);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: platformAdmin } = await supabase.from("platform_admins").select("id").eq("id", user.id).maybeSingle();
      if (!platformAdmin) { window.location.href = "/login"; return; }
      if (!live) return;
      setEmail(user.email);
      await load();
      if (!live) return;
      setState("ready");
    })();
    return () => { live = false; };
  }, [load]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const ctx = { email, organizations, load };

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
        .hq-signout:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
        .hq-signout{ transition: background-color .12s, border-color .12s, filter .12s, opacity .12s; cursor: pointer; }
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Boxes size={20} color={C.brand} />
          <div style={{ fontSize: 17, fontWeight: 800, color: C.hi }}>Platform Console</div>
          <button className="hq-signout" disabled={signingOut} onClick={signOut}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, opacity: signingOut ? 0.6 : 1 }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <div className="truncate" style={{ fontSize: 11.5, color: C.lo, fontFamily: FM, marginBottom: 20 }}>{email}</div>

        <PlatformContext.Provider value={ctx}>{children}</PlatformContext.Provider>
      </div>
    </div>
  );
}
