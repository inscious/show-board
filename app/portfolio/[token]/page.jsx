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
import { HardHat, MapPin, ShieldCheck, Wrench } from "lucide-react";

const PC = {
    bg: "#12151B",
    panel: "#1B2029",
    panelSoft: "#181C24",
    line: "#2A3140",
    hi: "#F5F3EE",
    mid: "#B7BCC6",
    lo: "#7B8290",
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
        <div className="pf" style={{ minHeight: "100vh", background: PC.bg }}>
            {/* dangerouslySetInnerHTML, not a JSX text child — a literal quote
                character inside a <style> text child gets escaped on the
                server and unescaped by the browser's HTML parser, which
                React's hydration then reads back as a text mismatch. */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .pf { color: ${PC.hi}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                .pf-serif { font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif; }
                .pf-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
                .pf-wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 70px; }
                .pf-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: ${PC.panelSoft}; }
                @media (max-width: 480px) { .pf-wrap { padding: 28px 16px 50px; } }
            `,
                }}
            />

            {state.status === "loading" && (
                <div style={{ padding: "80px 20px", textAlign: "center", color: PC.lo, fontSize: 13 }}>
                    Loading…
                </div>
            )}

            {state.status === "error" && (
                <div style={{ padding: "80px 20px", textAlign: "center" }}>
                    <div className="pf-serif" style={{ fontSize: 20, marginBottom: 8 }}>Link not available</div>
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
    const { displayName, bio, credentials, projects } = data;
    const years = credentials?.yearsInTrade;

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
                    className="pf-serif"
                >
                    {initials(displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                    <h1 className="pf-serif" style={{ fontSize: 26, fontWeight: 500, margin: 0, lineHeight: 1.15 }}>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
                {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
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
                    {project.photos.slice(0, 4).map((photo) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={photo.id} className="pf-photo" src={photo.url} alt={photo.caption || project.title} />
                    ))}
                </div>
            )}
            <div style={{ padding: "18px 20px 20px" }}>
                <h2 className="pf-serif" style={{ fontSize: 19, fontWeight: 500, margin: "0 0 6px" }}>{project.title}</h2>
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
                            <HardHat size={13} color={PC.gold} />
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
