"use client";

/* ST/OT/DT chip row — shared between the day sheet, Home, and Calendar.
   Split into its own module so none of them have to duplicate it. */
import { FM, PAY_COLOR, hrsFmt } from "@/lib/core";
import { r1 } from "@/components/r1";

export function SplitChips({ sp, size }) {
    const items = [
        ["ST", sp.st, PAY_COLOR.st],
        ["OT", sp.ot, PAY_COLOR.ot],
        ["DT", sp.dt, PAY_COLOR.dt],
    ];
    const on = items.filter((x) => r1(x[1]) > 0);
    if (!on.length) return null;
    return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {on.map(([k, v, c]) => (
                <span
                    key={k}
                    style={{
                        fontFamily: FM,
                        fontSize: size || 10.5,
                        fontWeight: 800,
                        color: c,
                        background: c + "1C",
                        border: "1px solid " + c + "55",
                        borderRadius: 5,
                        padding: "2px 5px",
                    }}
                >
                    {k} {hrsFmt(r1(v))}
                </span>
            ))}
        </div>
    );
}
