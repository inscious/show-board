"use client";

/* The one page in this app meant for someone who has never heard of it —
   a hiring manager following a link an apprentice sent them. No nav, no
   sign-in prompt, nothing that leads anywhere else in the product.
   Deliberately its own visual language, not a reskin of the app's dark
   utility palette (see PORTFOLIO_C below) — this is meant to read like a
   professional record, not a tool. Data comes from the one public route,
   app/api/portfolio/shared/[token]/route.js — everything this page shows
   is already scoped server-side to be safe to show a stranger. */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Work_Sans } from "next/font/google";
import { ChevronLeft, ChevronRight, Hammer, Loader2, Mail, MapPin, Phone, ShieldCheck, Wrench, X } from "lucide-react";

// Self-hosted at build time (no runtime font-CDN call) — this is the one page
// built to read as a professional credential document, not the app's own
// dark utility tool, so it earns a real chosen typeface instead of the
// system font stack everywhere else.
const sansFont = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--pf-sans-font" });

const PC = {
    bg: "#12151B",
    panel: "#1B2029",
    panelSoft: "#181C24",
    line: "#2A3140",
    hi: "#F5F3EE",
    mid: "#B7BCC6",
    lo: "#7F8795" /* was #7B8290 — 4.23:1 against panel, under WCAG AA's 4.5:1 floor. Same hue, lightened to 4.51:1. */,
    gold: "#D4A857",
    goldSoft: "rgba(212,168,87,0.14)",
};

function initials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateRange(days) {
    const dates = days.map((d) => d.date).filter(Boolean).sort();
    if (dates.length === 0) return "";
    if (dates.length === 1 || dates[0] === dates[dates.length - 1]) return fmtDate(dates[0]);
    return fmtDate(dates[0]) + " – " + fmtDate(dates[dates.length - 1]);
}

// groups consecutive-by-first-appearance, not alphabetically — projects keep
// the apprentice's own sort_order within and across groups; an ungrouped
// (section: null) project gets no header at all, not an "Other" label.
function groupProjects(projects) {
    const groups = [];
    const bySection = new Map();
    for (const p of projects) {
        const key = p.section || "";
        let group = bySection.get(key);
        if (!group) {
            group = { section: p.section || null, projects: [] };
            bySection.set(key, group);
            groups.push(group);
        }
        group.projects.push(p);
    }
    return groups;
}

export default function SharedPortfolioPage() {
    const params = useParams();
    const token = params?.token;
    const [state, setState] = useState({ status: "loading" });

    useEffect(() => {
        if (!token) return;
        fetch(`/api/portfolio/shared/${token}`)
            .then(async (r) => {
                const json = await r.json().catch(() => ({}));
                if (!r.ok) return setState({ status: "error", message: json.error || "This link isn't available." });
                setState({ status: "ready", data: json });
            })
            .catch(() => setState({ status: "error", message: "Couldn't load this page." }));
    }, [token]);

    return (
        <div className={`pf ${sansFont.variable}`} style={{ minHeight: "100vh", background: PC.bg }}>
            {/* dangerouslySetInnerHTML, not a JSX text child — a literal quote
                character inside a <style> text child gets escaped on the
                server and unescaped by the browser's HTML parser, which
                React's hydration then reads back as a text mismatch. */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .pf { color: ${PC.hi}; font-family: var(--pf-sans-font), -apple-system, sans-serif; }
                .pf-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
                .pf-wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 70px; }
                .pf-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: ${PC.panelSoft}; }
                @keyframes pf-pulse{ 0%, 100%{ opacity: 0.5; } 50%{ opacity: 0.9; } }
                .pf-skeleton { background: ${PC.panelSoft}; border-radius: 8px; animation: pf-pulse 1.5s ease-in-out infinite; }
                @keyframes pf-spin{ from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }
                .pf-spin { animation: pf-spin 0.8s linear infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .pf-skeleton { animation: none; }
                    .pf-spin { animation: none; }
                }
                @media (max-width: 480px) { .pf-wrap { padding: 28px 16px 50px; } }
            `,
                }}
            />

            {state.status === "loading" && (
                <div className="pf-wrap">
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
                        <div className="pf-skeleton" style={{ width: 62, height: 62, borderRadius: "50%" }} />
                        <div style={{ flex: 1 }}>
                            <div className="pf-skeleton" style={{ width: "60%", height: 20, marginBottom: 8 }} />
                            <div className="pf-skeleton" style={{ width: "40%", height: 13 }} />
                        </div>
                    </div>
                    <div style={{ height: 1, background: PC.line, margin: "0 0 28px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
                        <div className="pf-skeleton" style={{ height: 220, borderRadius: 13 }} />
                        <div className="pf-skeleton" style={{ height: 220, borderRadius: 13 }} />
                    </div>
                </div>
            )}

            {state.status === "error" && (
                <div style={{ padding: "80px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Link not available</div>
                    <div style={{ color: PC.mid, fontSize: 13.5 }}>{state.message}</div>
                </div>
            )}

            {state.status === "ready" && (
                <PortfolioContent data={state.data} />
            )}
        </div>
    );
}

function PortfolioContent({ data }) {
    const { displayName, bio, credentials, projects, contactEmail, contactPhone } = data;
    const years = credentials?.yearsInTrade;
    const groups = groupProjects(projects);

    return (
        <div className="pf-wrap">
            <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
                <div
                    style={{
                        width: 62,
                        height: 62,
                        borderRadius: "50%",
                        background: PC.goldSoft,
                        border: "1px solid rgba(212,168,87,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: PC.gold,
                        fontWeight: 700,
                        fontSize: 20,
                    }}
                >
                    {initials(displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
                        {displayName}
                    </h1>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12.5, color: PC.mid }}>
                        {credentials?.levelLabel && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, color: PC.gold, fontWeight: 700 }}>
                                <ShieldCheck size={13} />
                                {credentials.levelLabel}
                            </span>
                        )}
                        {credentials?.local && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <MapPin size={12} />
                                {credentials.local}
                            </span>
                        )}
                        {years != null && <span>{years === 0 ? "Under a year in the trade" : years + (years === 1 ? " year" : " years") + " in the trade"}</span>}
                    </div>
                </div>
            </header>

            {(contactEmail || contactPhone) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 18, fontSize: 13 }}>
                    {contactEmail && (
                        <a
                            href={`mailto:${contactEmail}`}
                            style={{ display: "flex", alignItems: "center", gap: 6, color: PC.gold, textDecoration: "none" }}
                        >
                            <Mail size={13} />
                            {contactEmail}
                        </a>
                    )}
                    {contactPhone && (
                        <a
                            href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}
                            style={{ display: "flex", alignItems: "center", gap: 6, color: PC.gold, textDecoration: "none" }}
                        >
                            <Phone size={13} />
                            {contactPhone}
                        </a>
                    )}
                </div>
            )}

            {bio && (
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: PC.mid, margin: "0 0 22px" }}>{bio}</p>
            )}

            {credentials?.certifications?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
                    {credentials.certifications.map((c, i) => (
                        <span
                            key={i}
                            className="pf-mono"
                            style={{
                                fontSize: 10.5,
                                letterSpacing: 0.3,
                                color: PC.mid,
                                background: PC.panelSoft,
                                border: "1px solid " + PC.line,
                                borderRadius: 6,
                                padding: "5px 9px",
                            }}
                        >
                            {c.name}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ height: 1, background: PC.line, margin: "0 0 28px" }} />

            {projects.length === 0 && (
                <div style={{ textAlign: "center", color: PC.lo, fontSize: 13, padding: "30px 0" }}>
                    Nothing shared here yet.
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                {groups.map((group, i) => (
                    <div key={group.section || `_ungrouped_${i}`} style={{ display: "flex", flexDirection: "column", gap: 34 }}>
                        {group.section && (
                            <h2
                                className="pf-mono"
                                style={{
                                    fontSize: 11.5,
                                    letterSpacing: 1.2,
                                    textTransform: "uppercase",
                                    color: PC.gold,
                                    margin: 0,
                                    paddingBottom: 8,
                                    borderBottom: "1px solid " + PC.line,
                                }}
                            >
                                {group.section}
                            </h2>
                        )}
                        {group.projects.map((p) => (
                            <ProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                ))}
            </div>

            <footer style={{ marginTop: 50, paddingTop: 20, borderTop: "1px solid " + PC.line, fontSize: 11, color: PC.lo, textAlign: "center" }}>
                Work history verified through {credentials?.local || "IUPAT Local 831"}'s own hours system.
            </footer>
        </div>
    );
}

function ProjectCard({ project }) {
    const install = project.days.filter((d) => d.workType === "install");
    const dismantle = project.days.filter((d) => d.workType === "dismantle");
    const companies = [...new Set(project.days.map((d) => d.company).filter(Boolean))];
    const [lightbox, setLightbox] = useState(null); // index into project.photos, or null
    const [loaded, setLoaded] = useState({}); // photo id -> true once its <img> has actually loaded
    const shown = project.photos.slice(0, 4);
    const extra = project.photos.length - shown.length;

    return (
        <div style={{ background: PC.panel, border: "1px solid " + PC.line, borderRadius: 14, overflow: "hidden" }}>
            {project.photos.length > 0 && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: project.photos.length === 1 ? "1fr" : "repeat(2, 1fr)",
                        gap: 2,
                    }}
                >
                    {shown.map((photo, i) => {
                        const isLast = i === shown.length - 1;
                        return (
                            <button
                                key={photo.id}
                                onClick={() => setLightbox(i)}
                                style={{
                                    position: "relative",
                                    padding: 0,
                                    border: "none",
                                    cursor: "pointer",
                                    display: "block",
                                }}
                            >
                                {!loaded[photo.id] && <div className="pf-skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    className="pf-photo"
                                    src={photo.url}
                                    alt={photo.caption || project.title}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => setLoaded((l) => ({ ...l, [photo.id]: true }))}
                                    style={{ opacity: loaded[photo.id] ? 1 : 0, transition: "opacity 0.25s ease" }}
                                />
                                {isLast && extra > 0 && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            background: "rgba(0,0,0,0.55)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#fff",
                                            fontSize: 16,
                                            fontWeight: 600,
                                        }}
                                    >
                                        +{extra}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {lightbox !== null && (
                <Lightbox
                    photos={project.photos}
                    index={lightbox}
                    title={project.title}
                    onIndexChange={setLightbox}
                    onClose={() => setLightbox(null)}
                />
            )}
            <div style={{ padding: "18px 20px 20px" }}>
                <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>{project.title}</h2>
                {project.location && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: PC.mid, marginBottom: 6 }}>
                        <MapPin size={12} color={PC.gold} />
                        {project.location}
                    </div>
                )}
                {companies.length > 0 && (
                    <div style={{ fontSize: 12, color: PC.gold, marginBottom: 8, fontWeight: 600 }}>
                        {companies.join(" · ")}
                    </div>
                )}
                {project.notes && (
                    <p style={{ fontSize: 13.5, color: PC.mid, lineHeight: 1.6, margin: "0 0 12px" }}>{project.notes}</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    {install.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: PC.mid }}>
                            <Hammer size={13} color={PC.gold} />
                            Install · {fmtDateRange(install)}
                        </div>
                    )}
                    {dismantle.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: PC.mid }}>
                            <Wrench size={13} color={PC.gold} />
                            Dismantle · {fmtDateRange(dismantle)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Lightbox({ photos, index, title, onIndexChange, onClose }) {
    const photo = photos[index];
    const hasPrev = index > 0;
    const hasNext = index < photos.length - 1;
    const [loaded, setLoaded] = useState(false);

    // full-res image, not the grid thumbnail — reset the spinner every time
    // the viewer moves to a different photo rather than carrying over the
    // previous one's loaded state.
    useEffect(() => setLoaded(false), [photo?.id]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
            else if (e.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [index, hasPrev, hasNext, onIndexChange, onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(8,9,12,0.94)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
            }}
        >
            <button
                onClick={onClose}
                aria-label="Close"
                style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    padding: 8,
                    cursor: "pointer",
                }}
            >
                <X size={20} />
            </button>

            {photos.length > 1 && (
                <div
                    className="pf-mono"
                    style={{
                        position: "absolute",
                        top: 20,
                        left: 20,
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 12,
                    }}
                >
                    {index + 1} / {photos.length}
                </div>
            )}

            {hasPrev && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onIndexChange(index - 1);
                    }}
                    aria-label="Previous photo"
                    style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        padding: 10,
                        cursor: "pointer",
                    }}
                >
                    <ChevronLeft size={22} />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onIndexChange(index + 1);
                    }}
                    aria-label="Next photo"
                    style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        padding: 10,
                        cursor: "pointer",
                    }}
                >
                    <ChevronRight size={22} />
                </button>
            )}

            {!loaded && <Loader2 className="pf-spin" size={28} color="rgba(255,255,255,0.6)" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={photo.url}
                alt={photo.caption || title}
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setLoaded(true)}
                decoding="async"
                style={{
                    maxWidth: "100%",
                    maxHeight: "88vh",
                    objectFit: "contain",
                    borderRadius: 6,
                    display: loaded ? "block" : "none",
                }}
            />
        </div>
    );
}
