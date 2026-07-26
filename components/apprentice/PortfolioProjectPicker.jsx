"use client";

/* Opened from DaySheet's "Add Project" button on one logged entry — tags
   that single work_entries row (not the whole day, see DaySheet's own
   comment on this) onto a portfolio project, creating the project first if
   it's a new title. Deliberately narrow: no photo upload, no editing,
   no reordering here — that all lives in the Portfolio section of the OJT
   tab. Mirrors CoPicker's "search existing or create new" shape. */
import { useEffect, useState } from "react";
import { HardHat, ImagePlus, Plus, Wrench } from "lucide-react";
import { C, fromKey, longDate } from "@/lib/core";

export function PortfolioProjectPicker({ dayKey, entry, onClose, onDone }) {
    const [projects, setProjects] = useState(null); // null = loading
    const [q, setQ] = useState("");
    const [workType, setWorkType] = useState("install");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/portfolio/projects")
            .then((r) => r.json())
            .then((d) => setProjects(Array.isArray(d.projects) ? d.projects : []))
            .catch(() => setProjects([]));
    }, []);

    const norm = q.trim();
    const exact = (projects || []).some(
        (p) => p.title.toLowerCase() === norm.toLowerCase(),
    );
    const visible = (projects || []).filter(
        (p) => !norm || p.title.toLowerCase().includes(norm.toLowerCase()),
    );

    async function tag(projectId) {
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/portfolio/project-days", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    workEntryId: entry.id,
                    workType,
                }),
            });
            if (!res.ok) throw new Error();
            onDone();
        } catch {
            setError("Couldn't save — try again.");
            setSaving(false);
        }
    }

    async function createAndTag() {
        if (!norm || saving) return;
        setSaving(true);
        setError("");
        const id =
            "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        try {
            const res = await fetch("/api/portfolio/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, title: norm }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setError("Couldn't save — try again.");
            setSaving(false);
            return;
        }
        await tag(id);
    }

    const typeBtn = (val, label, Icon) => (
        <button
            className="foc"
            onClick={() => setWorkType(val)}
            style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px",
                borderRadius: 9,
                fontWeight: 800,
                fontSize: 12.5,
                background: workType === val ? C.folio : C.sunk,
                color: workType === val ? C.inkFolio : C.mid,
                border: "1px solid " + (workType === val ? C.folio : C.line),
            }}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    return (
        <div>
            <div
                style={{
                    fontSize: 12,
                    color: C.mid,
                    marginBottom: 14,
                    lineHeight: 1.5,
                }}
            >
                Add <b style={{ color: C.hi }}>{entry.co}</b> —{" "}
                {longDate(fromKey(dayKey))} to a portfolio project.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {typeBtn("install", "Install", HardHat)}
                {typeBtn("dismantle", "Dismantle", Wrench)}
            </div>

            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search or name a new project — e.g. the booth name"
                autoFocus
                style={{
                    width: "100%",
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 9,
                    padding: "11px 12px",
                    color: C.hi,
                    fontSize: 13,
                    marginBottom: 10,
                }}
            />

            {norm && !exact && (
                <button
                    className="foc"
                    disabled={saving}
                    onClick={createAndTag}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        background: "rgba(185,166,255,0.12)",
                        color: C.folio,
                        border: "1px dashed rgba(185,166,255,0.5)",
                        borderRadius: 9,
                        padding: "11px",
                        fontWeight: 800,
                        fontSize: 13,
                        marginBottom: 10,
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    <Plus size={15} />
                    New project "{norm}"
                </button>
            )}

            {error && (
                <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>
                    {error}
                </div>
            )}

            <div
                style={{
                    maxHeight: "40vh",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                }}
            >
                {projects === null && (
                    <div
                        style={{
                            fontSize: 12,
                            color: C.lo,
                            textAlign: "center",
                            padding: "14px 0",
                        }}
                    >
                        Loading your projects…
                    </div>
                )}
                {projects && projects.length === 0 && !norm && (
                    <div
                        style={{
                            fontSize: 12,
                            color: C.lo,
                            textAlign: "center",
                            padding: "14px 0",
                        }}
                    >
                        No projects yet — type a booth name above to start one.
                    </div>
                )}
                {visible.map((p) => (
                    <button
                        key={p.id}
                        className="foc"
                        disabled={saving}
                        onClick={() => tag(p.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            textAlign: "left",
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "10px 12px",
                            opacity: saving ? 0.6 : 1,
                        }}
                    >
                        <ImagePlus size={15} color={C.folio} />
                        <span
                            className="truncate"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                fontWeight: 700,
                                fontSize: 13,
                                color: C.hi,
                            }}
                        >
                            {p.title}
                        </span>
                    </button>
                ))}
            </div>

            <button
                className="foc"
                onClick={onClose}
                style={{
                    width: "100%",
                    marginTop: 14,
                    padding: "12px",
                    borderRadius: 10,
                    background: C.raise,
                    color: C.hi,
                    border: "1px solid " + C.line,
                    fontWeight: 700,
                    fontSize: 13.5,
                }}
            >
                Cancel
            </button>
        </div>
    );
}
