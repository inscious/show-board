"use client";

/* Photo(s) of the physical time ticket for one logged entry — opened from
   DaySheet's per-row camera button. Proof-of-work / accuracy record, kept
   private to the apprentice (own-rows RLS via work_entries.user_id) —
   deliberately a separate table/bucket from Portfolio's photos, which are
   a shareable career asset, not an internal verification record. Same
   full-swap pattern as PortfolioProjectPicker: replaces DaySheet's body
   while open, not a second modal. */
import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, fromKey, longDate } from "@/lib/core";

export function TimeTicketPhotoPicker({ dayKey, entry, onClose }) {
    const [photos, setPhotos] = useState(null); // null = loading
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    async function load() {
        const supabase = createClient();
        const { data } = await supabase
            .from("time_ticket_photos")
            .select("id, storage_path")
            .eq("work_entry_id", entry.id)
            .order("created_at", { ascending: true });
        const signed = [];
        for (const p of data || []) {
            const { data: s } = await supabase.storage.from("time_tickets").createSignedUrl(p.storage_path, 3600);
            signed.push({ id: p.id, url: s?.signedUrl || null });
        }
        setPhotos(signed);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function upload(file) {
        setUploading(true);
        setError("");
        try {
            const form = new FormData();
            form.append("workEntryId", entry.id);
            form.append("file", file);
            const res = await fetch("/api/time-tickets/photos", { method: "POST", body: form });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Upload failed");
            setPhotos((ps) => [...(ps || []), { id: json.id, url: json.url }]);
        } catch (err) {
            setError(err.message || "Couldn't upload — try again.");
        } finally {
            setUploading(false);
        }
    }

    async function remove(photoId) {
        setPhotos((ps) => (ps || []).filter((p) => p.id !== photoId));
        try {
            await fetch("/api/time-tickets/photos", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: photoId }),
            });
        } catch {
            // best-effort — a stale row left behind is harmless, RLS still hides it from anyone else
        }
    }

    return (
        <div>
            <div style={{ fontSize: 12, color: C.mid, marginBottom: 14, lineHeight: 1.5 }}>
                Time ticket for <b style={{ color: C.hi }}>{entry.co}</b> —{" "}
                {longDate(fromKey(dayKey))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {photos === null && (
                    <div style={{ fontSize: 12, color: C.lo, padding: "10px 0" }}>Loading…</div>
                )}
                {(photos || []).map((p) => (
                    <div
                        key={p.id}
                        style={{
                            position: "relative",
                            width: 84,
                            height: 84,
                            borderRadius: 9,
                            overflow: "hidden",
                            border: "1px solid " + C.line,
                            background: C.sunk,
                        }}
                    >
                        {p.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        <button
                            className="foc"
                            onClick={() => remove(p.id)}
                            style={{
                                position: "absolute",
                                top: 3,
                                right: 3,
                                background: "rgba(13,15,19,0.75)",
                                border: "none",
                                borderRadius: 6,
                                color: C.hi,
                                padding: 3,
                            }}
                        >
                            <X size={11} />
                        </button>
                    </div>
                ))}
                {photos !== null && (
                    <label
                        className="foc"
                        style={{
                            width: 84,
                            height: 84,
                            borderRadius: 9,
                            border: "1px dashed " + (uploading ? C.line : C.gc),
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            color: uploading ? C.lo : C.gc,
                            cursor: "pointer",
                        }}
                    >
                        <Camera size={18} />
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{uploading ? "…" : "Add"}</span>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            disabled={uploading}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) upload(f);
                            }}
                        />
                    </label>
                )}
            </div>

            {error && <div style={{ fontSize: 11.5, color: C.danger, marginBottom: 10 }}>{error}</div>}

            <div style={{ fontSize: 10.5, color: C.lo, marginBottom: 14, lineHeight: 1.45 }}>
                Kept private on your account — a record of what was actually
                on the paper ticket, not shared with anyone.
            </div>

            <button
                className="foc"
                onClick={onClose}
                style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: C.raise,
                    color: C.hi,
                    border: "1px solid " + C.line,
                    fontWeight: 700,
                    fontSize: 13.5,
                }}
            >
                Done
            </button>
        </div>
    );
}
