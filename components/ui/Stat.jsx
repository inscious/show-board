"use client";

/* A small metric card (label/value/sub) — used by Home, Calendar, and OJT.
   Split into its own module (same reasoning as DirectoryContext) so the
   per-tab files under components/tabs/ can share it without a circular
   import back through ShowBoard.jsx. */
import { C, SHADOW, FM } from "@/lib/core";

export function Stat({ label, value, sub, color }) {
    return (
        <div
            style={{
                background: C.panel,
                border: "1px solid " + C.edge,
                borderRadius: 12,
                padding: "15px 16px",
                boxShadow: SHADOW,
                minWidth: 0,
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    letterSpacing: 0.8,
                    color: C.lo,
                    fontFamily: FM,
                }}
            >
                {label}
            </div>
            <div
                className="truncate"
                style={{
                    fontFamily: FM,
                    fontSize: 24,
                    fontWeight: 800,
                    color: color || C.hi,
                    lineHeight: 1.2,
                    marginTop: 1,
                }}
            >
                {value}
            </div>
            {sub && (
                <div
                    className="truncate"
                    style={{ fontSize: 10.5, color: C.lo, marginTop: 2 }}
                >
                    {sub}
                </div>
            )}
        </div>
    );
}
