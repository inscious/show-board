"use client";

/* Shown on both the apprentice app (ShowBoard.jsx) and the union admin
   console (app/admin/layout.jsx) whenever the signed-in session is a
   platform admin's active impersonation of this account — reads
   impersonation_sessions via the normal RLS-scoped client (its "target can
   read own active session" policy, supabase/console_impersonation.sql).
   Ending the session hits /api/console/impersonate/end, which hands back a
   fresh magic link for the platform admin's own account — this component
   just navigates to it, landing back on /console already signed in. */
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function timeLeft(expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export function ImpersonationBanner() {
    const [session, setSession] = useState(null); // null = not checked yet / none active
    const [ending, setEnding] = useState(false);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        let live = true;
        (async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !live) return;
            const { data } = await supabase
                .from("impersonation_sessions")
                .select("*")
                .eq("target_user_id", user.id)
                .is("ended_at", null)
                .gt("expires_at", new Date().toISOString())
                .order("started_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (live) setSession(data || null);
        })();
        return () => { live = false; };
    }, []);

    useEffect(() => {
        if (!session) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [session]);

    if (!session) return null;
    // stop rendering once the clock actually runs out, rather than sitting
    // on a stale "0:00" banner until the next reload re-checks the DB.
    if (new Date(session.expires_at).getTime() <= now) return null;

    const end = async () => {
        if (ending) return;
        setEnding(true);
        try {
            const res = await fetch("/api/console/impersonate/end", { method: "POST" });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.tokenHash) {
                window.location.href = `/impersonate/verify?token_hash=${encodeURIComponent(json.tokenHash)}`;
                return;
            }
        } catch {
            // fall through to sign-out below
        }
        // best-effort fallback: just sign out so nobody is stuck mid-session,
        // even if the return link couldn't be generated.
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 40,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#2A1B06",
                borderBottom: "1px solid #7A4E12",
                color: "#F2C878",
                padding: "9px 14px",
                fontSize: 12.5,
                fontWeight: 700,
            }}
        >
            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
                Platform admin viewing as this account — ends in {timeLeft(session.expires_at)}
            </span>
            <button
                onClick={end}
                disabled={ending}
                style={{
                    marginLeft: "auto",
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid #7A4E12",
                    color: "#F2C878",
                    borderRadius: 7,
                    padding: "4px 10px",
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: ending ? "default" : "pointer",
                    opacity: ending ? 0.6 : 1,
                }}
            >
                {ending ? "Ending…" : "End session"}
            </button>
        </div>
    );
}
