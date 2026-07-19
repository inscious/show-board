"use client";

/* First-login welcome — shown once per apprentice (see needsWelcome in
   lib/store.ts, gated on profiles.welcomed_at). Backfilled to "already
   seen" for every account that existed before this shipped, so this only
   ever fires for a genuinely new apprentice's first Home load. */
import { GraduationCap, Info, LayoutGrid, Calendar as CalendarIcon, HardHat } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { C } from "@/lib/core";

const TABS = [
    { Icon: LayoutGrid, name: "Home", desc: "Your hours, est. pay, and what's on the floor today." },
    { Icon: HardHat, name: "Board", desc: "The full show schedule — who's calling, when, and where." },
    { Icon: CalendarIcon, name: "Calendar", desc: "Every day you've logged, laid out by month." },
    { Icon: GraduationCap, name: "OJT", desc: "Your level, pay scale, and the paperwork the union sees." },
];

export function WelcomeModal({ onOpenOjtImport, onClose }) {
    return (
        <Modal title="Welcome to L831 Tracker" sub="A quick rundown before you start logging" onClose={onClose}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {TABS.map(({ Icon, name, desc }) => (
                    <div
                        key={name}
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 10,
                            padding: "10px 12px",
                        }}
                    >
                        <Icon size={16} color={C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: C.hi }}>{name}</div>
                            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.4, marginTop: 1 }}>{desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                className="foc"
                onClick={onOpenOjtImport}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "13px",
                    borderRadius: 10,
                    background: C.brand,
                    color: C.ink,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 14,
                    marginBottom: 8,
                }}
            >
                <GraduationCap size={16} /> Add your OJT history
            </button>
            <div style={{ fontSize: 11, color: C.lo, lineHeight: 1.5, marginBottom: 16 }}>
                If you've already got hours on file with the union from before you started using this app,
                add them now — your level and pay scale won't be right until they're in.
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    background: "rgba(127,178,255,0.07)",
                    border: "1px solid rgba(127,178,255,0.3)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 18,
                }}
            >
                <Info size={13} color={C.gc} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5 }}>
                    One thing worth knowing early: if you only log total hours (no start/end time), the
                    app assumes a standard 8:00am start. Worked a short Friday call that actually started
                    at 8:00pm? Use the clock in/out fields on that day instead, or your overtime and
                    double-time — and your estimated pay — will be off.
                </div>
            </div>

            <button
                className="foc"
                onClick={onClose}
                style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: C.panel,
                    color: C.hi,
                    border: "1px solid " + C.edge,
                    fontWeight: 700,
                    fontSize: 13.5,
                }}
            >
                Got it
            </button>
        </Modal>
    );
}
