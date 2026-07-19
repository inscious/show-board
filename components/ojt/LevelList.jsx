"use client";

/* Level ladder card on the OJT tab — pulled out on its own, same pattern
   as ClassCurriculum.jsx/JatcRulesModal.jsx in this directory. */
import { C, FM, LEVELS, SHADOW, hrsFmt, levelIndex, mMed, num, projectMonth } from "@/lib/core";

function money(n) {
    return "$" + num(n).toFixed(2);
}

export function LevelList({ total, avg, lastMonth }) {
    const idx = levelIndex(total);
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
                    marginBottom: 10,
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
                    LEVEL PROGRESSION
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {LEVELS.map((lv, i) => {
                    const done = i < idx;
                    const cur = i === idx;
                    const nxt = LEVELS[idx + 1];
                    const badge = done
                        ? { t: "DONE", c: C.working }
                        : cur
                          ? { t: "CURRENT", c: C.brand }
                          : lv.goal
                            ? { t: "GOAL", c: C.brand }
                            : { t: "UPCOMING", c: C.lo };
                    const keyCol = done
                        ? C.working
                        : cur
                          ? C.brand
                          : lv.goal
                            ? C.brand
                            : C.lo;
                    const proj =
                        !done && !cur
                            ? projectMonth(lv.hrs - total, avg, lastMonth)
                            : null;
                    const pct =
                        cur && nxt
                            ? Math.max(
                                  2,
                                  Math.min(
                                      100,
                                      ((total - lv.hrs) / (nxt.hrs - lv.hrs)) *
                                          100,
                                  ),
                              )
                            : 0;
                    return (
                        <div
                            key={lv.k}
                            style={{
                                background: cur
                                    ? "rgba(255,176,32,0.09)"
                                    : C.sunk,
                                border:
                                    "1px solid " +
                                    (cur
                                        ? "rgba(255,176,32,0.45)"
                                        : lv.goal
                                          ? "rgba(255,176,32,0.22)"
                                          : C.line),
                                borderRadius: 9,
                                padding: "9px 10px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        width: 32,
                                        textAlign: "center",
                                        fontFamily: FM,
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        color: keyCol,
                                        background: done
                                            ? "rgba(47,176,122,0.13)"
                                            : cur || lv.goal
                                              ? "rgba(255,176,32,0.14)"
                                              : "transparent",
                                        border:
                                            "1px solid " +
                                            (done
                                                ? "rgba(47,176,122,0.35)"
                                                : cur || lv.goal
                                                  ? "rgba(255,176,32,0.4)"
                                                  : C.line),
                                        borderRadius: 6,
                                        padding: "3px 0",
                                    }}
                                >
                                    {lv.k}
                                </span>

                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                        className="truncate"
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color:
                                                cur || lv.goal
                                                    ? C.hi
                                                    : done
                                                      ? C.mid
                                                      : C.mid,
                                        }}
                                    >
                                        {lv.label}
                                    </div>
                                    <div
                                        className="truncate"
                                        style={{
                                            fontSize: 11,
                                            color: C.lo,
                                            fontFamily: FM,
                                            marginTop: 2,
                                        }}
                                    >
                                        {lv.hrs.toLocaleString()} HRS
                                        {proj ? " · " + mMed(proj) : ""}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        flexShrink: 0,
                                        textAlign: "right",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color: C.hi,
                                        }}
                                    >
                                        {money(lv.pay)}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "flex-end",
                                            gap: 4,
                                            marginTop: 3,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 8.5,
                                                fontWeight: 800,
                                                letterSpacing: 0.3,
                                                color: badge.c,
                                                border:
                                                    "1px solid " +
                                                    badge.c +
                                                    "55",
                                                borderRadius: 4,
                                                padding: "1px 4px",
                                            }}
                                        >
                                            {badge.t}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {cur && nxt && (
                                <div style={{ marginTop: 9 }}>
                                    <div
                                        style={{
                                            height: 6,
                                            borderRadius: 4,
                                            background: C.raise,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                width: pct + "%",
                                                background: C.brand,
                                                borderRadius: 4,
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            marginTop: 5,
                                            fontFamily: FM,
                                            fontSize: 10.5,
                                            color: C.mid,
                                        }}
                                    >
                                        <span>
                                            {hrsFmt(total)} /{" "}
                                            {nxt.hrs.toLocaleString()}
                                        </span>
                                        <span
                                            style={{
                                                marginLeft: "auto",
                                                color: C.brand,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {hrsFmt(nxt.hrs - total)} TO {nxt.k}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 10,
                    lineHeight: 1.5,
                }}
            >
                Scale pay steps up {money(3.16)} per level, every 600 OJT hours.
                The union doesn't process the official level change (and pay
                bump) the moment you cross a threshold — it usually lands a
                few days after you turn in that OJT slip. Turning in a pay
                stub that proves you hit the hours can get it processed early.
            </div>
            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid " + C.line,
                    lineHeight: 1.5,
                }}
            >
                A level increase needs all three: 600 OJT hours since your
                last increase, a satisfactory OJT rating, and 80 RSI hours
                completed at your current level — hours alone don't move you
                up.
            </div>
        </div>
    );
}
