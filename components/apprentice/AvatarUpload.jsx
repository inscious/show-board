"use client";

/* An apprentice's own profile picture — read from profiles.avatar_url
   (lib/store.ts's profile.avatarUrl), written through POST/DELETE
   /api/profile/avatar. Whether uploading is even offered is an admin-
   controlled switch (app_settings.apprentice_avatar_upload_enabled,
   fetched once here) — the admin/avatar route apprentices can't reach
   still lets an admin set anyone's photo regardless of this toggle, same
   as before; this only adds the apprentice's own self-service path.

   Tapping the photo views it full-size (works even when upload is off —
   an admin-set photo should still be viewable); a separate pencil badge
   is the only way to replace or remove it, so a tap never accidentally
   opens the file picker over a photo someone just wanted to look at. */
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Pencil, X } from "lucide-react";
import { C, FM, SHADOW } from "@/lib/core";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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
    const [viewing, setViewing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const fileRef = useRef(null);

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
            setConfirmRemove(false);
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

    const openPicker = () => fileRef.current?.click();

    return (
        <div style={{ position: "relative", flexShrink: 0 }}>
            <button
                type="button"
                className="foc"
                onClick={() => (avatarUrl ? setViewing(true) : uploadEnabled && openPicker())}
                disabled={busy}
                style={{
                    display: "block",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    borderRadius: "50%",
                    cursor: avatarUrl || uploadEnabled ? "pointer" : "default",
                }}
            >
                {circle}
            </button>

            {uploadEnabled && !busy && (
                <button
                    type="button"
                    className="foc"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(true);
                    }}
                    style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: C.brand,
                        border: "2px solid " + C.panel,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Pencil size={12} color={C.ink} />
                </button>
            )}

            <input
                ref={fileRef}
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

            {error && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, fontSize: 10, color: C.danger, width: 130 }}>
                    {error}
                </div>
            )}

            {viewing && avatarUrl && (
                <div
                    onClick={() => setViewing(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 60,
                        background: "rgba(0,0,0,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                    }}
                >
                    <button
                        className="foc"
                        onClick={() => setViewing(false)}
                        style={{
                            position: "absolute",
                            top: 18,
                            right: 18,
                            background: C.raise,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: 8,
                            color: C.hi,
                        }}
                    >
                        <X size={18} />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarUrl}
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: "min(90vw, 480px)",
                            maxHeight: "80vh",
                            borderRadius: 16,
                            boxShadow: SHADOW,
                            objectFit: "contain",
                        }}
                    />
                </div>
            )}

            {menuOpen && (
                <Modal title="Profile photo" onClose={() => setMenuOpen(false)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                            className="foc"
                            onClick={() => {
                                setMenuOpen(false);
                                openPicker();
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 9,
                                padding: "13px 14px",
                                borderRadius: 10,
                                background: C.raise,
                                border: "1px solid " + C.line,
                                color: C.hi,
                                fontWeight: 700,
                                fontSize: 14,
                            }}
                        >
                            <Camera size={16} color={C.brand} />
                            {avatarUrl ? "Replace photo" : "Add a photo"}
                        </button>
                        {avatarUrl && (
                            <button
                                className="foc"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setConfirmRemove(true);
                                }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                    padding: "13px 14px",
                                    borderRadius: 10,
                                    background: "rgba(232,146,124,0.08)",
                                    border: "1px solid " + C.danger + "55",
                                    color: C.danger,
                                    fontWeight: 700,
                                    fontSize: 14,
                                }}
                            >
                                <X size={16} />
                                Remove photo
                            </button>
                        )}
                    </div>
                </Modal>
            )}

            {confirmRemove && (
                <ConfirmModal
                    title="Remove your photo?"
                    message="You can add a new one any time — this only removes what is showing now."
                    confirmLabel="Remove photo"
                    onClose={() => setConfirmRemove(false)}
                    onConfirm={remove}
                />
            )}
        </div>
    );
}
