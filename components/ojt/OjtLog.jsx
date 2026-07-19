"use client";

/* "Submitted to the union" monthly log table on the OJT tab — pulled out
   on its own, same pattern as LevelList.jsx/CatBars.jsx. */
import { C, FM, SHADOW, hrsFmt, mShort, num } from "@/lib/core";

export function OjtLog({ rows, roll, onEdit }) {
    const H = ({ children, w, right }) => (
        <div
            style={{
                width: w,
                flexShrink: 0,
                textAlign: right ? "right" : "left",
                fontFamily: FM,
                fontSize: 9,
                letterSpacing: 0.5,
                color: C.lo,
            }}
        >
            {children}
        </div>
    );
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
                    marginBottom: 9,
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
                    SUBMITTED TO THE UNION
                </div>
                <div
                    style={{
                        marginLeft: "auto",
                        fontFamily: FM,
                        fontSize: 10,
                        color: C.lo,
                    }}
                >
                    {rows.length} MONTHS
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    paddingBottom: 6,
                    borderBottom: "1px solid " + C.line,
                }}
            >
                <H w={54}>MONTH</H>
                <H w={30} right>
                    A
                </H>
                <H w={30} right>
                    B
                </H>
                <H w={26} right>
                    C
                </H>
                <H w={26} right>
                    D
                </H>
                <H w={40} right>
                    TOTAL
                </H>
                <div style={{ flex: 1 }} />
                <H w={44} right>
                    CUM
                </H>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
                {rows
                    .slice()
                    .reverse()
                    .map((r) => {
                        const app = roll[r.m];
                        const delta = app ? app.total - r.total : 0;
                        const cell = (v, w) => (
                            <div
                                style={{
                                    width: w,
                                    flexShrink: 0,
                                    textAlign: "right",
                                    fontFamily: FM,
                                    fontSize: 12,
                                    fontWeight: num(v) ? 700 : 400,
                                    color: num(v) ? C.hi : C.lo,
                                }}
                            >
                                {num(v) ? hrsFmt(v) : "–"}
                            </div>
                        );
                        return (
                            <button
                                key={r.m}
                                className="foc"
                                onClick={() => onEdit(r)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    background: "transparent",
                                    border: "none",
                                    borderBottom: "1px solid " + C.line,
                                    padding: "9px 0",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 54,
                                            flexShrink: 0,
                                            fontFamily: FM,
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            color: C.hi,
                                        }}
                                    >
                                        {mShort(r.m)}
                                    </div>
                                    {cell(r.a, 30)}
                                    {cell(r.b, 30)}
                                    {cell(r.c, 26)}
                                    {cell(r.d, 26)}
                                    <div
                                        style={{
                                            width: 40,
                                            flexShrink: 0,
                                            textAlign: "right",
                                            fontFamily: FM,
                                            fontSize: 12.5,
                                            fontWeight: 800,
                                            color: C.hi,
                                        }}
                                    >
                                        {hrsFmt(r.total)}
                                    </div>
                                    <div style={{ flex: 1 }} />
                                    <div
                                        style={{
                                            width: 44,
                                            flexShrink: 0,
                                            textAlign: "right",
                                            fontFamily: FM,
                                            fontSize: 11.5,
                                            color: C.mid,
                                        }}
                                    >
                                        {hrsFmt(r.run)}
                                    </div>
                                </div>
                                {(r.crossed.length > 0 ||
                                    (app && delta !== 0)) && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 5,
                                            marginTop: 6,
                                            paddingLeft: 0,
                                        }}
                                    >
                                        {r.crossed.map((lv) => (
                                            <span
                                                key={lv.k}
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    letterSpacing: 0.4,
                                                    color: C.brand,
                                                    background:
                                                        "rgba(255,176,32,0.13)",
                                                    border: "1px solid rgba(255,176,32,0.4)",
                                                    borderRadius: 5,
                                                    padding: "2px 5px",
                                                }}
                                            >
                                                CROSSED{" "}
                                                {lv.hrs.toLocaleString()} —{" "}
                                                {lv.k}
                                            </span>
                                        ))}
                                        {app && delta !== 0 && (
                                            <span
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    color: C.gc,
                                                    background:
                                                        "rgba(127,178,255,0.11)",
                                                    border: "1px solid rgba(127,178,255,0.32)",
                                                    borderRadius: 5,
                                                    padding: "2px 5px",
                                                }}
                                            >
                                                APP LOGGED {hrsFmt(app.total)} (
                                                {delta > 0 ? "+" : ""}
                                                {hrsFmt(delta)})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
            </div>

            {rows.length === 0 && (
                <div
                    style={{ color: C.mid, fontSize: 13, padding: "14px 2px" }}
                >
                    No months submitted yet.
                </div>
            )}
            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 10,
                    lineHeight: 1.5,
                }}
            >
                These are the hours the union has on file. Tap a month to fix
                it. App-logged hours are tracked separately and never overwrite
                this.
            </div>
        </div>
    );
}
