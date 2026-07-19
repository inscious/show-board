"use client";

/* Category-hours progress bars on the OJT tab — pulled out on its own,
   same pattern as LevelList.jsx. */
import { C, CATS_META, CAT_TOTAL, FM, SHADOW, hrsFmt } from "@/lib/core";

export function CatBars({ t }) {
    return (
        <div
            style={{
                background: C.panel,
                border: "1px solid " + C.edge,
                borderRadius: 12,
                padding: "16px 17px",
                boxShadow: SHADOW,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 11,
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.6,
                        color: C.lo,
                        fontFamily: FM,
                    }}
                >
                    CATEGORY HOURS — FULL APPRENTICESHIP
                </div>
                <div
                    style={{
                        marginLeft: "auto",
                        fontFamily: FM,
                        fontSize: 10,
                        color: C.lo,
                    }}
                >
                    {hrsFmt(t.total)} / {CAT_TOTAL.toLocaleString()}
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["A", "B", "C", "D"].map((k) => {
                    const meta = CATS_META[k];
                    const v = t[k.toLowerCase()];
                    const p = Math.min(100, (v / meta.target) * 100);
                    return (
                        <div key={k}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        width: 18,
                                        height: 18,
                                        borderRadius: 5,
                                        background: meta.color + "22",
                                        border:
                                            "1px solid " + meta.color + "66",
                                        color: meta.color,
                                        fontFamily: FM,
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {k}
                                </span>
                                <span
                                    className="truncate"
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: C.hi,
                                    }}
                                >
                                    {meta.name}
                                </span>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontFamily: FM,
                                        fontSize: 11.5,
                                        color: C.mid,
                                    }}
                                >
                                    <span
                                        style={{
                                            color: v ? C.hi : C.lo,
                                            fontWeight: 800,
                                        }}
                                    >
                                        {hrsFmt(v)}
                                    </span>{" "}
                                    / {meta.target.toLocaleString()}
                                </span>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        width: 38,
                                        textAlign: "right",
                                        fontFamily: FM,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: v ? meta.color : C.lo,
                                    }}
                                >
                                    {p.toFixed(0)}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 7,
                                    borderRadius: 4,
                                    background: C.raise,
                                    overflow: "hidden",
                                    marginTop: 6,
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: Math.max(v ? 2 : 0, p) + "%",
                                        background: meta.color,
                                        borderRadius: 4,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 11,
                    lineHeight: 1.5,
                }}
            >
                Targets add up to {CAT_TOTAL.toLocaleString()} hrs — the same
                number as the EJ threshold. Extruded Metals and Miscellaneous
                are still untouched.
            </div>
        </div>
    );
}
