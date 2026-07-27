"use client";

/* An apprentice's own profile picture — read from profiles.avatar_url
   (lib/store.ts's profile.avatarUrl), written through POST/DELETE
   /api/profile/avatar. Whether uploading is even offered is an admin-
   controlled switch (app_settings.apprentice_avatar_upload_enabled,
   fetched once here) — the admin/avatar route apprentices can't reach
   still lets an admin set anyone's photo regardless of this toggle, same
   as before; this only adds the apprentice's own self-service path. */
import { useState, useEffect } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { C, FM } from "@/lib/core";

function initials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || "?").slice(0, 2).toUpperCase();
}

const MAX_BYTES = 5_000_000;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function AvatarUpload({ name, avatarUrl, onChange, size = 52 }) {
    const [uploadEnabled, setUploadEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/settings/apprentice-avatar-upload")
            .then((r) => r.json())
            .then((d) => setUploadEnabled(!!d.enabled))
            .catch(() => setUploadEnabled(false));
    }, []);

    async function upload(file) {
        if (file.size > MAX_BYTES) {
            setError("Image too large (5MB max)");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Upload failed");
            onChange(json.url);
        } catch (err) {
            setError(err.message || "Couldn't upload — try again.");
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        setError("");
        try {
            await fetch("/api/profile/avatar", { method: "DELETE" });
            onChange(null);
        } catch {
            // best-effort — a stale photo left in storage is harmless
        } finally {
            setBusy(false);
        }
    }

    const circle = (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                flexShrink: 0,
                overflow: "hidden",
                background: C.sunk,
                border: "1px solid " + C.line,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
            }}
        >
            {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ fontFamily: FM, fontWeight: 800, fontSize: Math.round(size * 0.34), color: C.mid }}>
                    {initials(name)}
                </span>
            )}
            {busy && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(13,15,19,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 size={size * 0.34} color={C.hi} />
                </div>
            )}
        </div>
    );

    if (!uploadEnabled) return circle;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <label
                className="foc"
                style={{ position: "relative", cursor: busy ? "default" : "pointer", borderRadius: "50%" }}
            >
                {circle}
                {!busy && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: C.brand,
                            border: "2px solid " + C.panel,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Camera size={11} color={C.ink} />
                    </div>
                )}
                <input
                    type="file"
                    accept={ACCEPT}
                    style={{ display: "none" }}
                    disabled={busy}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) upload(f);
                    }}
                />
            </label>
            {avatarUrl && !busy && (
                <button
                    className="foc"
                    onClick={remove}
                    style={{ display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "none", color: C.lo, fontSize: 9.5, padding: 0 }}
                >
                    <X size={9} /> Remove
                </button>
            )}
            {error && <div style={{ fontSize: 9.5, color: C.danger, maxWidth: 90, textAlign: "center" }}>{error}</div>}
        </div>
    );
}
