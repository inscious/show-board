"use client";

/* The Portfolio section of the OJT tab — deliberately not another Fold
   styled like the reference panels around it (pay rules, curriculum,
   contacts). This is the one place in the app meant to be shown to someone
   outside the union, so it gets its own visual identity: a violet accent
   (C.folio) instead of the tab's usual brand/gc colors, and its own header
   treatment instead of Fold's plain chevron-button shell.

   Reads its own data straight from Supabase (own-rows RLS), same pattern as
   the admin panels under components/admin/ — this feature doesn't ride the
   big localStorage-synced blob in lib/store.ts, since photo uploads can't
   go through that offline-first diff/sync model anyway. Writes go through
   the guarded API routes under app/api/portfolio/. */
import { useEffect, useState } from "react";
import {
    Camera,
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    HardHat,
    Image as ImageIcon,
    Link2,
    Loader2,
    Trash2,
    Wrench,
    X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, FM, longDate, fromKey } from "@/lib/core";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

async function req(method, path, body) {
    const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
}

function shareUrl(token) {
    if (!token || typeof window === "undefined") return "";
    return window.location.origin + "/portfolio/" + token;
}

function CopyLink({ token }) {
    const [copied, setCopied] = useState(false);
    const url = shareUrl(token);
    if (!token) return null;
    return (
        <button
            className="foc"
            onClick={() => {
                navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                });
            }}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: C.sunk,
                border: "1px solid " + C.line,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                fontFamily: FM,
                color: copied ? C.working : C.mid,
                minWidth: 0,
            }}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span className="truncate">{copied ? "Copied" : url}</span>
        </button>
    );
}

function ProjectPhotos({ project, detail, onChange }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    async function upload(file) {
        setUploading(true);
        setError("");
        try {
            const form = new FormData();
            form.append("projectId", project.id);
            form.append("file", file);
            const res = await fetch("/api/portfolio/photos", { method: "POST", body: form });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Upload failed");
            onChange({ ...detail, photos: [...detail.photos, { id: json.id, url: json.url, caption: null }] });
        } catch (err) {
            setError(err.message || "Couldn't upload — try again.");
        } finally {
            setUploading(false);
        }
    }

    async function remove(photoId) {
        onChange({ ...detail, photos: detail.photos.filter((p) => p.id !== photoId) });
        try {
            await req("DELETE", "/api/portfolio/photos", { id: photoId });
        } catch {
            // best-effort — a stale row left behind is harmless, RLS still hides it from anyone else
        }
    }

    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {detail.photos.map((p) => (
                    <div
                        key={p.id}
                        style={{
                            position: "relative",
                            width: 76,
                            height: 76,
                            borderRadius: 9,
                            overflow: "hidden",
                            border: "1px solid " + C.line,
                            background: C.sunk,
                        }}
                    >
                        {p.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                            <ImageIcon size={18} color={C.lo} style={{ margin: "28px auto", display: "block" }} />
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
                <label
                    className="foc"
                    style={{
                        width: 76,
                        height: 76,
                        borderRadius: 9,
                        border: "1px dashed " + (uploading ? C.line : C.folio),
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        color: uploading ? C.lo : C.folio,
                        cursor: "pointer",
                    }}
                >
                    {uploading ? <Loader2 size={16} /> : <Camera size={16} />}
                    <span style={{ fontSize: 9.5, fontWeight: 700 }}>{uploading ? "…" : "Add"}</span>
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
            </div>
            {error && <div style={{ fontSize: 11.5, color: C.danger, marginBottom: 8 }}>{error}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {detail.days.map((d, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            fontSize: 11.5,
                            color: C.mid,
                        }}
                    >
                        {d.workType === "install" ? (
                            <HardHat size={12} color={C.folio} />
                        ) : (
                            <Wrench size={12} color={C.folio} />
                        )}
                        <span style={{ color: C.hi, fontWeight: 600 }}>{d.company}</span>
                        <span style={{ fontFamily: FM, fontSize: 10, color: C.lo }}>
                            {d.date ? longDate(fromKey(d.date)) : ""}
                        </span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontSize: 9,
                                letterSpacing: 0.4,
                                fontWeight: 800,
                                color: C.lo,
                            }}
                        >
                            {d.workType?.toUpperCase()}
                        </span>
                    </div>
                ))}
                {detail.days.length === 0 && (
                    <div style={{ fontSize: 11, color: C.lo }}>
                        No logged days tagged to this project yet — tag one from a
                        day's logged hours in your calendar.
                    </div>
                )}
            </div>
        </div>
    );
}

function ProjectRow({ project, index, count, detail, expanded, onToggle, onMove, onDelete, onIncludeToggle, onShareToggle, onDetailChange }) {
    const [busy, setBusy] = useState(false);
    return (
        <div
            style={{
                background: C.sunk,
                border: "1px solid " + C.line,
                borderRadius: 10,
                overflow: "hidden",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                        className="foc"
                        disabled={index === 0}
                        onClick={() => onMove(project, -1)}
                        style={{ background: "none", border: "none", color: index === 0 ? C.line : C.lo, padding: 1 }}
                    >
                        <ChevronUp size={13} />
                    </button>
                    <button
                        className="foc"
                        disabled={index === count - 1}
                        onClick={() => onMove(project, 1)}
                        style={{ background: "none", border: "none", color: index === count - 1 ? C.line : C.lo, padding: 1 }}
                    >
                        <ChevronDown size={13} />
                    </button>
                </div>
                <button
                    className="foc"
                    onClick={onToggle}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                    }}
                >
                    <div className="truncate" style={{ fontWeight: 700, fontSize: 13.5, color: C.hi }}>
                        {project.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.lo, marginTop: 1 }}>
                        {project.include_in_portfolio ? "shown in your portfolio" : "hidden from your portfolio"}
                        {project.share_token ? " · project link on" : ""}
                    </div>
                </button>
                <button className="foc" onClick={onToggle} style={{ background: "none", border: "none", color: C.lo, padding: 4 }}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {expanded && (
                <div style={{ padding: "0 12px 14px", borderTop: "1px solid " + C.line }}>
                    <div style={{ marginTop: 12 }}>
                        {detail ? (
                            <ProjectPhotos project={project} detail={detail} onChange={(d) => onDetailChange(project.id, d)} />
                        ) : (
                            <div style={{ fontSize: 12, color: C.lo, padding: "10px 0" }}>Loading…</div>
                        )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        <button
                            className="foc"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                await onIncludeToggle(project);
                                setBusy(false);
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: C.raise,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "8px 11px",
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: C.hi,
                            }}
                        >
                            {project.include_in_portfolio ? "Hide from portfolio" : "Show in portfolio"}
                        </button>
                        <button
                            className="foc"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                await onShareToggle(project);
                                setBusy(false);
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: project.share_token ? C.folio : C.raise,
                                border: "1px solid " + (project.share_token ? C.folio : C.line),
                                borderRadius: 8,
                                padding: "8px 11px",
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: project.share_token ? C.inkFolio : C.hi,
                            }}
                        >
                            <Link2 size={12} />
                            {project.share_token ? "Sharing this project" : "Share this project"}
                        </button>
                        <button
                            className="foc"
                            onClick={() => onDelete(project)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: "transparent",
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "8px 11px",
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: C.danger,
                                marginLeft: "auto",
                            }}
                        >
                            <Trash2 size={12} />
                            Delete
                        </button>
                    </div>
                    {project.share_token && (
                        <div style={{ marginTop: 8 }}>
                            <CopyLink token={project.share_token} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function PortfolioSection() {
    const [projects, setProjects] = useState(null); // null = loading
    const [settings, setSettings] = useState(null);
    const [detail, setDetail] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [settingsSaving, setSettingsSaving] = useState(false);

    async function loadAll() {
        const supabase = createClient();
        const [{ data: proj }, { data: sett }] = await Promise.all([
            supabase.from("portfolio_projects").select("*").order("sort_order", { ascending: true }),
            supabase.from("portfolio_settings").select("*").maybeSingle(),
        ]);
        setProjects(proj || []);
        setSettings(sett || null);
        setName(sett?.display_name || "");
        setBio(sett?.bio || "");
    }

    useEffect(() => {
        loadAll();
    }, []);

    async function loadDetail(projectId) {
        const supabase = createClient();
        const { data: days } = await supabase
            .from("portfolio_project_days")
            .select("work_type, work_entries(worked_on, company)")
            .eq("project_id", projectId);
        const { data: photos } = await supabase
            .from("portfolio_project_photos")
            .select("id, storage_path, caption, sort_order")
            .eq("project_id", projectId)
            .order("sort_order", { ascending: true });

        const signedPhotos = [];
        for (const p of photos || []) {
            const { data: signed } = await supabase.storage.from("portfolio").createSignedUrl(p.storage_path, 3600);
            signedPhotos.push({ id: p.id, url: signed?.signedUrl || null, caption: p.caption });
        }
        setDetail((d) => ({
            ...d,
            [projectId]: {
                days: (days || []).map((row) => ({
                    workType: row.work_type,
                    company: row.work_entries?.company || "",
                    date: row.work_entries?.worked_on || null,
                })),
                photos: signedPhotos,
            },
        }));
    }

    function toggleExpand(project) {
        const next = expandedId === project.id ? null : project.id;
        setExpandedId(next);
        if (next && !detail[project.id]) loadDetail(project.id);
    }

    async function moveProject(project, dir) {
        const idx = projects.findIndex((p) => p.id === project.id);
        const swapWith = projects[idx + dir];
        if (!swapWith) return;
        const a = { ...project, sort_order: swapWith.sort_order };
        const b = { ...swapWith, sort_order: project.sort_order };
        const next = [...projects];
        next[idx] = a;
        next[idx + dir] = b;
        next.sort((x, y) => x.sort_order - y.sort_order);
        setProjects(next);
        try {
            await Promise.all([
                req("POST", "/api/portfolio/projects", { id: a.id, title: a.title, sortOrder: a.sort_order }),
                req("POST", "/api/portfolio/projects", { id: b.id, title: b.title, sortOrder: b.sort_order }),
            ]);
        } catch {
            loadAll();
        }
    }

    async function toggleInclude(project) {
        const next = !project.include_in_portfolio;
        setProjects((ps) => ps.map((p) => (p.id === project.id ? { ...p, include_in_portfolio: next } : p)));
        try {
            await req("POST", "/api/portfolio/projects", { id: project.id, title: project.title, includeInPortfolio: next });
        } catch {
            loadAll();
        }
    }

    async function toggleShare(project) {
        const shared = !project.share_token;
        try {
            const res = await req("POST", "/api/portfolio/share", { projectId: project.id, shared });
            setProjects((ps) => ps.map((p) => (p.id === project.id ? { ...p, share_token: res.shareToken } : p)));
        } catch {
            loadAll();
        }
    }

    async function deleteProject(project) {
        setProjects((ps) => ps.filter((p) => p.id !== project.id));
        setConfirmDelete(null);
        try {
            await req("DELETE", "/api/portfolio/projects", { id: project.id });
        } catch {
            loadAll();
        }
    }

    async function saveSettings(patch) {
        setSettingsSaving(true);
        try {
            const res = await req("POST", "/api/portfolio/settings", patch);
            setSettings(res.settings);
        } catch {
            // keep whatever's locally typed — a retry on next save picks it back up
        } finally {
            setSettingsSaving(false);
        }
    }

    return (
        <div>
            {projects === null ? (
                <div style={{ fontSize: 12, color: C.lo, padding: "10px 0" }}>Loading…</div>
            ) : (
                <>
                    <div
                        style={{
                            background: "linear-gradient(160deg, rgba(185,166,255,0.08), rgba(185,166,255,0.02))",
                            border: "1px solid rgba(185,166,255,0.3)",
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                            YOUR PORTFOLIO
                        </div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => name !== (settings?.display_name || "") && saveSettings({ displayName: name })}
                            placeholder="Display name shown to hiring managers"
                            style={{
                                width: "100%",
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "9px 10px",
                                color: C.hi,
                                fontSize: 13,
                                marginBottom: 8,
                            }}
                        />
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            onBlur={() => bio !== (settings?.bio || "") && saveSettings({ bio })}
                            placeholder="A short intro — trade focus, specialties, what you're looking for"
                            rows={2}
                            style={{
                                width: "100%",
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "9px 10px",
                                color: C.hi,
                                fontSize: 12.5,
                                resize: "vertical",
                                marginBottom: 10,
                                fontFamily: "inherit",
                            }}
                        />
                        <button
                            className="foc"
                            disabled={settingsSaving}
                            onClick={() => saveSettings({ shared: !settings?.share_token })}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: settings?.share_token ? C.folio : C.raise,
                                border: "1px solid " + (settings?.share_token ? C.folio : C.line),
                                borderRadius: 8,
                                padding: "9px 12px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: settings?.share_token ? C.inkFolio : C.hi,
                            }}
                        >
                            <Link2 size={13} />
                            {settings?.share_token ? "Sharing your whole portfolio" : "Share your whole portfolio"}
                        </button>
                        {settings?.share_token && (
                            <div style={{ marginTop: 8 }}>
                                <CopyLink token={settings.share_token} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {projects.map((p, i) => (
                            <ProjectRow
                                key={p.id}
                                project={p}
                                index={i}
                                count={projects.length}
                                detail={detail[p.id]}
                                expanded={expandedId === p.id}
                                onToggle={() => toggleExpand(p)}
                                onMove={moveProject}
                                onDelete={setConfirmDelete}
                                onIncludeToggle={toggleInclude}
                                onShareToggle={toggleShare}
                                onDetailChange={(id, d) => setDetail((cur) => ({ ...cur, [id]: d }))}
                            />
                        ))}
                        {projects.length === 0 && (
                            <div style={{ fontSize: 12, color: C.lo, textAlign: "center", padding: "16px 0" }}>
                                No projects yet — tag a logged day to a booth from your
                                calendar to start one.
                            </div>
                        )}
                    </div>
                </>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="Delete project"
                    message={`Delete "${confirmDelete.title}"? This removes its photos and unlinks any logged days — the hours themselves stay on your calendar.`}
                    confirmLabel="Delete"
                    tone="danger"
                    onConfirm={() => deleteProject(confirmDelete)}
                    onClose={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
}
