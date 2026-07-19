"use client";

/* Monthly hours bar chart on the Home tab — recharts wrapper + its custom
   tooltip. Exclusive to this one chart, confirmed via grep before moving,
   so CAT_KEYS/HoursTooltip/MonthlyHoursChart (and the recharts imports
   they need) came out together. */
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { C, CATS_META, FM, SHADOW, YEAR, hrsFmt, mShort } from "@/lib/core";

const CAT_KEYS = ["a", "b", "c", "d"];

function HoursTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    const total = row.hrs;
    return (
        <div
            style={{
                background: C.raise,
                border: "1px solid " + C.line,
                borderRadius: 8,
                padding: "8px 10px",
                boxShadow: SHADOW,
                minWidth: 108,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: total ? 6 : 0,
                }}
            >
                <span
                    style={{
                        fontSize: 9.5,
                        letterSpacing: 0.5,
                        color: C.lo,
                        fontFamily: FM,
                    }}
                >
                    {label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.hi, fontFamily: FM }}>
                    {hrsFmt(total)}h
                </span>
            </div>
            {total > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {CAT_KEYS.filter((k) => row[k] > 0).map((k) => {
                        const meta = CATS_META[k.toUpperCase()];
                        return (
                            <div
                                key={k}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    fontFamily: FM,
                                }}
                            >
                                <span
                                    style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: 2,
                                        background: meta.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ color: C.mid, flex: 1 }}>{k.toUpperCase()}</span>
                                <span style={{ color: C.hi, fontWeight: 700 }}>
                                    {hrsFmt(row[k])}h
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function MonthlyHoursChart({ series }) {
    return (
        <div
            style={{
                background: C.panel,
                border: "1px solid " + C.edge,
                borderRadius: 12,
                padding: "11px 12px 4px",
                boxShadow: SHADOW,
                // fills the grid row's full height when it sits beside a
                // taller sibling on desktop (dgrid's align-items:start
                // otherwise leaves it top-aligned at its own short height);
                // a no-op on mobile, where the row has no definite height
                // to fill.
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 8,
                }}
            >
                <div
                    style={{
                        fontSize: 9.5,
                        letterSpacing: 0.8,
                        color: C.lo,
                        fontFamily: FM,
                    }}
                >
                    MONTHLY HOURS · {series.length > 0 ? mShort(series[0].k) + " – " + mShort(series[series.length - 1].k) : YEAR}
                </div>
                <div style={{ display: "flex", gap: 9, marginLeft: "auto" }}>
                    {CAT_KEYS.map((k) => {
                        const meta = CATS_META[k.toUpperCase()];
                        return (
                            <div
                                key={k}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <span
                                    style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: 2,
                                        background: meta.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 9.5,
                                        fontFamily: FM,
                                        color: C.lo,
                                    }}
                                >
                                    {k.toUpperCase()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div
                style={{ width: "100%", flex: 1, minHeight: 160 }}
                role="img"
                aria-label={
                    "Monthly hours worked in " +
                    YEAR +
                    ": " +
                    series.map((s) => s.label + " " + hrsFmt(s.hrs) + "h").join(", ")
                }
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={C.line} strokeOpacity={0.5} />
                        <XAxis
                            dataKey="label"
                            axisLine={{ stroke: C.line }}
                            tickLine={false}
                            tick={{ fill: C.lo, fontSize: 9, fontFamily: FM }}
                            dy={6}
                            interval={0}
                        />
                        <YAxis hide domain={[0, "dataMax + 10"]} />
                        <Tooltip content={<HoursTooltip />} cursor={{ fill: C.line, fillOpacity: 0.35 }} />
                        {CAT_KEYS.map((k, i) => (
                            <Bar
                                key={k}
                                dataKey={k}
                                stackId="hrs"
                                fill={CATS_META[k.toUpperCase()].color}
                                stroke={C.panel}
                                strokeWidth={1}
                                radius={i === CAT_KEYS.length - 1 ? [3, 3, 0, 0] : 0}
                                isAnimationActive={false}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
