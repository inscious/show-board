"use client";

/* Consumes a token_hash from admin.auth.admin.generateLink() via
   supabase.auth.verifyOtp() — deliberately NOT navigating the browser to
   the raw action_link Supabase's admin API also returns, since that link
   uses the implicit hash-fragment flow (#access_token=...), while this
   app's own /auth/callback route only handles the PKCE ?code= flow used by
   the existing self-service "email me a sign-in link" feature (server
   routes can never see a URL's hash fragment at all — it never leaves the
   browser). verifyOtp() sidesteps the mismatch entirely: it establishes the
   session directly through a normal request, no redirect-with-fragment
   involved. Used for both starting impersonation (token_hash for the
   target) and ending it (token_hash for the platform admin's own return). */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { C, FS } from "@/lib/core";

export default function ImpersonateVerifyPage() {
    const [error, setError] = useState("");

    useEffect(() => {
        // reading the query string directly rather than useSearchParams()
        // — this page has no SSR-sensitive content, so it skips the
        // Suspense-boundary requirement that hook needs in the app router.
        const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
        if (!tokenHash) {
            setError("Missing verification token.");
            return;
        }
        (async () => {
            const supabase = createClient();
            const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
            if (verifyError) {
                setError("This link is invalid or has expired.");
                return;
            }
            window.location.href = "/";
        })();
    }, []);

    return (
        <div style={{ minHeight: "100dvh", background: C.bg, color: C.hi, fontFamily: FS, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ textAlign: "center", maxWidth: 320 }}>
                {error ? (
                    <>
                        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Couldn't verify</div>
                        <div style={{ fontSize: 13, color: C.mid, marginBottom: 16 }}>{error}</div>
                        <a href="/login" style={{ color: C.brand, fontSize: 13, fontWeight: 700 }}>Back to sign in</a>
                    </>
                ) : (
                    <div style={{ fontSize: 13, color: C.mid }}>Signing you in…</div>
                )}
            </div>
        </div>
    );
}
