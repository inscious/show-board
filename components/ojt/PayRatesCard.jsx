"use client";

/* Per-company rate overrides, OT/DT rules, and level pay package —
   consolidated into one Fold (see the OJT-tab consolidation pass) so the
   reference list isn't three near-identical full-width rows back to back.
   Pulled into its own file the same way LevelList.jsx/CatBars.jsx were. */
import { Building2, Plus, X } from "lucide-react";
import { Fold } from "@/components/ui/Fold";
import {
    C,
    FM,
    L2_PACKAGE,
    LEVELS,
    PAY,
    PAY_COLOR,
    coColor,
    hrsFmt,
    num,
    rateFor,
} from "@/lib/core";

function money(n) {
    return "$" + num(n).toFixed(2);
}

export function PayRatesCard({
    lv,
    idx,
    entries,
    rates,
    onSetRate,
    onRemoveRate,
    onAddRateCo,
}) {
    return (
        <Fold icon={Building2} title="Pay & rates" color={C.brand}>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                WHAT EACH COMPANY PAYS YOU
            </div>
            <div
                style={{
                    fontSize: 11.5,
                    color: C.mid,
                    lineHeight: 1.5,
                    marginBottom: 10,
                }}
            >
                Default is your scale —{" "}
                <span
                    style={{ fontFamily: FM, fontWeight: 800, color: C.hi }}
                >
                    {lv.label} {money(lv.pay)}
                </span>
                . Set an override only where a shop pays above it. Overrides
                follow a level, not a dollar amount, so they move up with
                you.
            </div>
            <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
                {(() => {
                    const worked = {};
                    Object.keys(entries).forEach((k) =>
                        (entries[k] || []).forEach((e) => {
                            worked[e.co] = (worked[e.co] || 0) + num(e.hrs);
                        }),
                    );
                    const names = Array.from(
                        new Set(
                            Object.keys(rates || {}).concat(
                                Object.keys(worked),
                            ),
                        ),
                    ).sort();
                    if (!names.length)
                        return (
                            <div style={{ fontSize: 12.5, color: C.lo }}>
                                Nothing here yet — add a company below.
                            </div>
                        );
                    return names.map((n) => {
                        const r = rateFor(n, idx, rates);
                        const cur = (rates || {})[n] || "";
                        return (
                            <div
                                key={n}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    background: C.sunk,
                                    border:
                                        "1px solid " +
                                        (r.over
                                            ? "rgba(255,176,32,0.35)"
                                            : C.line),
                                    borderRadius: 9,
                                    padding: "9px 10px",
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 9,
                                        background: coColor(n),
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                        className="truncate"
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: C.hi,
                                        }}
                                    >
                                        {n}
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 10.5,
                                            color: r.over ? C.brand : C.lo,
                                            marginTop: 2,
                                        }}
                                    >
                                        {money(r.rate)}
                                        {r.over
                                            ? " · " + r.level + " rate"
                                            : " · scale"}
                                        {worked[n]
                                            ? " · " +
                                              hrsFmt(worked[n]) +
                                              "h logged"
                                            : ""}
                                    </div>
                                </div>
                                <select
                                    className="foc"
                                    value={cur}
                                    onChange={(e) =>
                                        onSetRate(n, e.target.value)
                                    }
                                    style={{
                                        flexShrink: 0,
                                        width: 92,
                                        background: C.raise,
                                        color: C.hi,
                                        border: "1px solid " + C.line,
                                        borderRadius: 8,
                                        padding: "7px 4px",
                                        fontSize: 12,
                                        fontFamily: FM,
                                        fontWeight: 700,
                                    }}
                                >
                                    <option value="">Scale</option>
                                    {LEVELS.map((l) => (
                                        <option key={l.k} value={l.k}>
                                            {l.k} {money(l.pay)}
                                        </option>
                                    ))}
                                </select>
                                {!worked[n] && (
                                    <button
                                        className="foc"
                                        onClick={() => onRemoveRate(n)}
                                        style={{
                                            flexShrink: 0,
                                            background: "transparent",
                                            border: "none",
                                            color: C.lo,
                                            padding: 2,
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    });
                })()}
            </div>
            <button
                className="foc"
                onClick={onAddRateCo}
                style={{
                    width: "100%",
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: "transparent",
                    color: C.brand,
                    border: "1px dashed rgba(255,176,32,0.45)",
                    borderRadius: 9,
                    padding: "10px",
                    fontSize: 12.5,
                    fontWeight: 700,
                }}
            >
                <Plus size={14} />
                Add a company
            </button>
            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 8,
                    lineHeight: 1.5,
                }}
            >
                Add a shop before you ever log an hour with them — Eagle,
                Freeman, whoever calls you next.
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                TIME & A HALF / DOUBLE TIME
            </div>
            <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
                {[
                    ["Before 8:00am", "DT", PAY_COLOR.dt, "×2"],
                    ["8:00am – 4:30pm", "ST", PAY_COLOR.st, "×1"],
                    ["4:30pm – 8:30pm", "OT", PAY_COLOR.ot, "×1.5"],
                    ["After 8:30pm", "DT", PAY_COLOR.dt, "×2"],
                    ["Saturday & Sunday", "DT", PAY_COLOR.dt, "×2"],
                    ["Federal holiday", "OT", PAY_COLOR.ot, "8h min"],
                ].map(([when, k, c, mult]) => (
                    <div
                        key={when}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: "9px 10px",
                        }}
                    >
                        <span
                            style={{
                                width: 3,
                                alignSelf: "stretch",
                                borderRadius: 2,
                                background: c,
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12.5,
                                color: C.hi,
                            }}
                        >
                            {when}
                        </span>
                        <span
                            style={{
                                fontFamily: FM,
                                fontSize: 11,
                                fontWeight: 800,
                                color: c,
                                background: c + "1C",
                                border: "1px solid " + c + "55",
                                borderRadius: 5,
                                padding: "2px 6px",
                            }}
                        >
                            {k}
                        </span>
                        <span
                            style={{
                                fontFamily: FM,
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.mid,
                                width: 36,
                                textAlign: "right",
                            }}
                        >
                            {mult}
                        </span>
                    </div>
                ))}
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: C.lo,
                    marginTop: 10,
                    lineHeight: 1.5,
                }}
            >
                Work a federal holiday and you're guaranteed{" "}
                <span style={{ fontFamily: FM, color: C.brand }}>
                    {PAY.holMinOt} hrs at OT
                </span>{" "}
                even if you only put in four — but only the hours you
                actually stood on the floor go to the JATC. Holidays use the{" "}
                <span style={{ color: C.hi }}>observed</span> date, so July
                4 2026 lands on Friday July 3, same as the union sheet.
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: C.lo,
                    marginTop: 8,
                    lineHeight: 1.5,
                    paddingTop: 8,
                    borderTop: "1px solid " + C.line,
                }}
            >
                An overnight call rolls into the next day and picks up that
                day's rule. Everything rounds to the half hour. OT pays{" "}
                <span style={{ fontFamily: FM, color: C.brand }}>×1.5</span>.
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                {lv.k === "L2" ? "LEVEL 2 PAY PACKAGE" : (lv.label + " PAY").toUpperCase()}
            </div>
            {lv.k === "L2" ? (
            <>
            <div
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
            >
                {[
                    ["Base rate", L2_PACKAGE.base],
                    ["Vacation / holiday", L2_PACKAGE.vacHol],
                ].map(([k, v]) => (
                    <div
                        key={k}
                        style={{ display: "flex", fontSize: 12.5 }}
                    >
                        <span style={{ color: C.mid }}>{k}</span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                color: C.hi,
                                fontWeight: 700,
                            }}
                        >
                            {money(v)}
                        </span>
                    </div>
                ))}
                <div
                    style={{
                        display: "flex",
                        fontSize: 12.5,
                        paddingTop: 7,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <span style={{ color: C.hi, fontWeight: 700 }}>
                        Taxable wage
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontFamily: FM,
                            color: C.brand,
                            fontWeight: 800,
                        }}
                    >
                        {money(L2_PACKAGE.taxable)}
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.6,
                        color: C.lo,
                        fontFamily: FM,
                        marginTop: 6,
                    }}
                >
                    BENEFITS
                </div>
                {L2_PACKAGE.benefits.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", fontSize: 12 }}>
                        <span style={{ color: C.mid }}>{k}</span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                color: C.mid,
                            }}
                        >
                            {money(v)}
                        </span>
                    </div>
                ))}
                <div
                    style={{
                        display: "flex",
                        fontSize: 12.5,
                        paddingTop: 7,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <span style={{ color: C.mid }}>Benefits total</span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontFamily: FM,
                            color: C.hi,
                            fontWeight: 700,
                        }}
                    >
                        {money(L2_PACKAGE.benefitsTotal)}
                    </span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        background: C.sunk,
                        border: "1px solid " + C.line,
                        borderRadius: 8,
                        padding: "10px 11px",
                        marginTop: 4,
                    }}
                >
                    <span
                        style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: C.hi,
                        }}
                    >
                        Total package
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontFamily: FM,
                            fontSize: 17,
                            fontWeight: 800,
                            color: C.working,
                        }}
                    >
                        {money(L2_PACKAGE.total)}
                    </span>
                </div>
                <div style={{ fontSize: 11, color: C.lo, marginTop: 2 }}>
                    Travel pay {money(L2_PACKAGE.travel)}/day. This is the
                    scale package — only shops with an override pay above
                    it.
                </div>
            </div>
            </>
            ) : (
            <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ display: "flex", fontSize: 12.5 }}>
                    <span style={{ color: C.mid }}>Base rate</span>
                    <span style={{ marginLeft: "auto", fontFamily: FM, color: C.hi, fontWeight: 700 }}>
                        {money(lv.pay)}
                    </span>
                </div>
                <div style={{ fontSize: 11, color: C.lo, marginTop: 2, lineHeight: 1.5 }}>
                    The full benefits breakdown (H&W, pension, vacation, etc.) is only on file for Level 2 right now — this will fill in for other levels as that paperwork comes in.
                </div>
            </div>
            </>
            )}
        </Fold>
    );
}
