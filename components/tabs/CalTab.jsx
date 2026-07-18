"use client";

/* Split out of ShowBoard.jsx so it can be next/dynamic-loaded, same
   treatment and reasoning as components/tabs/OjtTab.jsx. Summary (the
   month-summary modal) moved with it since it's exclusively triggered from
   here (onOpenSummary) — ShowBoard.jsx's modal dispatch imports it back out
   as a second dynamic() pointed at this same module, so both share one
   lazy-loaded chunk instead of Summary sitting as shell dead weight. */
import { useState, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react";
import {
    BOOKED,
    C,
    CATS_META,
    DOW,
    FM,
    KLASS,
    MONTHS,
    PAY,
    PAY_COLOR,
    SHADOW,
    STATUS,
    bookingOn,
    classOn,
    coColor,
    fromKey,
    holidayName,
    hrsFmt,
    keyOf,
    monthGrid,
    num,
    rangePay,
    sameDay,
    showsOn,
    statusOn,
    todayMid,
} from "@/lib/core";
import { hexRgb } from "@/components/hexRgb";
import { r1 } from "@/components/r1";

// not lib/core exports — tiny locals also defined (separately) in
// ShowBoard.jsx; duplicating a few lines here beats adding exports just for
// this.
const CATS = ["A", "B", "C", "D"];
function money(n) {
    return "$" + num(n).toFixed(2);
}

export function CalTab({
    shows,
    entries,
    cur,
    setCur,
    onOpenDay,
    lvIdx,
    rates,
    bookings,
    classes,
    onOpenSummary,
    onClearMonth,
}) {
    const [armed, setArmed] = useState(false);
    const today = todayMid();
    const cells = useMemo(() => monthGrid(cur.y, cur.m), [cur]);
    const prefix = cur.y + "-" + String(cur.m + 1).padStart(2, "0");

    const stats = useMemo(() => {
        let hrs = 0,
            days = 0;
        const byCo = {};
        const byCat = {};
        Object.keys(entries).forEach((k) => {
            if (k.indexOf(prefix) !== 0) return;
            const list = entries[k] || [];
            if (!list.length) return;
            days++;
            list.forEach((e) => {
                const h = Number(e.hrs) || 0;
                hrs += h;
                byCo[e.co] = (byCo[e.co] || 0) + h;
                if (e.cat) byCat[e.cat] = (byCat[e.cat] || 0) + h;
            });
        });
        const cos = Object.keys(byCo)
            .map((n) => [n, byCo[n]])
            .sort((a, b) => b[1] - a[1]);
        return { hrs, days, cos, byCat };
    }, [entries, prefix]);

    const allTime = useMemo(() => {
        let h = 0;
        Object.keys(entries).forEach((k) =>
            (entries[k] || []).forEach((e) => (h += Number(e.hrs) || 0)),
        );
        return h;
    }, [entries]);

    const step = (n) =>
        setCur((p) => {
            const d = new Date(p.y, p.m + n, 1);
            return { y: d.getFullYear(), m: d.getMonth() };
        });
    const isNow = cur.y === today.getFullYear() && cur.m === today.getMonth();

    return (
        <div>
            {/* month nav */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                }}
            >
                <button
                    className="foc"
                    onClick={() => step(-1)}
                    aria-label="Previous month"
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: C.panel,
                        border: "1px solid " + C.edge,
                        color: C.hi,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronLeft size={18} />
                </button>
                <div style={{ flex: 1, textAlign: "center" }}>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 15,
                            fontWeight: 800,
                            letterSpacing: 2,
                            color: C.hi,
                        }}
                    >
                        {MONTHS[cur.m]} {cur.y}
                    </div>
                    {!isNow && (
                        <button
                            className="foc"
                            onClick={() =>
                                setCur({
                                    y: today.getFullYear(),
                                    m: today.getMonth(),
                                })
                            }
                            style={{
                                marginTop: 2,
                                background: "transparent",
                                border: "none",
                                color: C.brand,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: 0,
                            }}
                        >
                            jump to today
                        </button>
                    )}
                </div>
                <button
                    className="foc"
                    onClick={() => step(1)}
                    aria-label="Next month"
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: C.panel,
                        border: "1px solid " + C.edge,
                        color: C.hi,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* month stats */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div
                    style={{
                        flex: 1,
                        background: C.panel,
                        border: "1px solid " + C.edge,
                        borderRadius: 12,
                        padding: "15px 16px",
                        boxShadow: SHADOW,
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
                        HOURS
                    </div>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 26,
                            fontWeight: 800,
                            color: stats.hrs ? C.working : C.lo,
                            lineHeight: 1.15,
                        }}
                    >
                        {hrsFmt(stats.hrs)}
                    </div>
                </div>
                <div
                    style={{
                        flex: 1,
                        background: C.panel,
                        border: "1px solid " + C.edge,
                        borderRadius: 12,
                        padding: "15px 16px",
                        boxShadow: SHADOW,
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
                        DAYS WORKED
                    </div>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 26,
                            fontWeight: 800,
                            color: stats.days ? C.hi : C.lo,
                            lineHeight: 1.15,
                        }}
                    >
                        {stats.days}
                    </div>
                </div>
                <div
                    style={{
                        flex: 1.2,
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
                        BY CATEGORY
                    </div>
                    {Object.keys(stats.byCat).length === 0 ? (
                        <div
                            style={{ fontSize: 12, color: C.lo, marginTop: 6 }}
                        >
                            —
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                                marginTop: 5,
                            }}
                        >
                            {CATS.filter((k) => stats.byCat[k]).map((k) => (
                                <span
                                    key={k}
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        color: CATS_META[k].color,
                                        background: CATS_META[k].color + "1C",
                                        border:
                                            "1px solid " +
                                            CATS_META[k].color +
                                            "55",
                                        borderRadius: 6,
                                        padding: "2px 5px",
                                    }}
                                >
                                    {k} {hrsFmt(stats.byCat[k])}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* grid */}
            <div
                style={{
                    background: C.panel,
                    border: "1px solid " + C.edge,
                    borderRadius: 14,
                    padding: 10,
                    boxShadow: SHADOW,
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 5,
                        marginBottom: 6,
                    }}
                >
                    {DOW.map((d, i) => (
                        <div
                            key={i}
                            style={{
                                textAlign: "center",
                                fontSize: 10,
                                fontFamily: FM,
                                fontWeight: 700,
                                color: i === 0 || i === 6 ? C.lo : C.mid,
                                letterSpacing: 0.5,
                            }}
                        >
                            {d}
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 5,
                    }}
                >
                    {cells.map((d, i) => {
                        const inMonth = d.getMonth() === cur.m;
                        const k = keyOf(d);
                        const list = entries[k] || [];
                        const hrs = list.reduce(
                            (a, e) => a + (Number(e.hrs) || 0),
                            0,
                        );
                        const isToday = sameDay(d, today);
                        const hol = holidayName(d);
                        const classesToday = classOn(classes, k);
                        const hasClass = classesToday.length > 0;
                        const missedClass = classesToday.some(
                            (c) => (c.missedDates || []).indexOf(k) !== -1,
                        );
                        const hasBook = bookingOn(bookings, k).length > 0;
                        const onBoard = showsOn(shows, d).length > 0;
                        const flag = statusOn(shows, d);

                        /* FILL = your day. worked beats scheduled beats class. */
                        const fill = hrs
                            ? C.working
                            : hasBook
                              ? BOOKED
                              : hasClass
                                ? missedClass
                                  ? C.danger
                                  : KLASS
                                : null;
                        const bg = fill
                            ? "rgba(" +
                              hexRgb(fill) +
                              "," +
                              (hrs ? 0.18 : 0.13) +
                              ")"
                            : inMonth
                              ? C.sunk
                              : "transparent";
                        const bd = isToday
                            ? C.brand
                            : fill
                              ? "rgba(" + hexRgb(fill) + ",0.5)"
                              : inMonth
                                ? C.line
                                : "transparent";
                        /* SPINE = a show you flagged on the board */
                        const spine = flag ? STATUS[flag].color : null;
                        /* DOTS = markers */
                        const dots = [];
                        if (onBoard) dots.push(C.gc);

                        return (
                            <button
                                key={i}
                                className="foc dcell"
                                onClick={() => onOpenDay(k)}
                                style={{
                                    position: "relative",
                                    borderRadius: 9,
                                    padding:
                                        "5px 5px 4px " + (spine ? 8 : 5) + "px",
                                    textAlign: "left",
                                    background: bg,
                                    border: "1px solid " + bd,
                                    overflow: "hidden",
                                    opacity: inMonth ? 1 : 0.28,
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                {spine && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: 3,
                                            background: spine,
                                        }}
                                    />
                                )}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 12,
                                            fontWeight: isToday ? 800 : 600,
                                            color: isToday
                                                ? C.brand
                                                : fill
                                                  ? C.hi
                                                  : C.mid,
                                            lineHeight: 1,
                                        }}
                                    >
                                        {d.getDate()}
                                    </span>
                                    {hol && (
                                        <span
                                            style={{
                                                marginLeft: 2,
                                                fontFamily: FM,
                                                fontSize: 8,
                                                fontWeight: 800,
                                                color: C.brand,
                                                lineHeight: 1,
                                            }}
                                        >
                                            H
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            marginLeft: "auto",
                                            display: "flex",
                                            gap: 2,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {dots.map((c, j) => (
                                            <span
                                                key={j}
                                                style={{
                                                    width: 5,
                                                    height: 5,
                                                    borderRadius: 6,
                                                    background: c,
                                                }}
                                            />
                                        ))}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        marginTop: "auto",
                                        display: "flex",
                                        alignItems: "flex-end",
                                    }}
                                >
                                    {hasBook && !hrs && (
                                        <span
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 9,
                                                fontWeight: 800,
                                                color: BOOKED,
                                                lineHeight: 1,
                                            }}
                                        >
                                            SCHED
                                        </span>
                                    )}
                                    {hasClass && !hasBook && !hrs && (
                                        <span
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 9,
                                                fontWeight: 800,
                                                color: missedClass ? C.danger : KLASS,
                                                lineHeight: 1,
                                            }}
                                        >
                                            {missedClass ? "MISSED" : "CLASS"}
                                        </span>
                                    )}
                                    {hrs > 0 && (
                                        <span
                                            style={{
                                                marginLeft: "auto",
                                                fontFamily: FM,
                                                fontSize: 14,
                                                fontWeight: 800,
                                                color: C.hi,
                                                lineHeight: 1,
                                            }}
                                        >
                                            {hrsFmt(hrs)}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="dgrid" style={{ marginTop: 12 }}>
                {/* how the month splits for pay */}
                {stats.hrs > 0 &&
                    (() => {
                        const keys = Object.keys(entries).filter(
                            (k) => k.indexOf(prefix) === 0,
                        );
                        const mp = rangePay(entries, keys, lvIdx, rates);
                        const msp = mp.split;
                        const paid = mp.paid;
                        const rows = [
                            ["ST", msp.st, PAY_COLOR.st, 1],
                            ["OT", msp.ot, PAY_COLOR.ot, PAY.otMult],
                            ["DT", msp.dt, PAY_COLOR.dt, PAY.dtMult],
                        ];
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
                                        STRAIGHT / OT / DOUBLE
                                    </div>
                                    <div
                                        style={{
                                            marginLeft: "auto",
                                            fontFamily: FM,
                                            fontSize: 12,
                                            fontWeight: 800,
                                            color: C.working,
                                        }}
                                    >
                                        ~$
                                        {mp.gross.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        height: 8,
                                        borderRadius: 5,
                                        overflow: "hidden",
                                        background: C.raise,
                                    }}
                                >
                                    {rows.map(
                                        ([k, v, c]) =>
                                            v > 0 && (
                                                <div
                                                    key={k}
                                                    style={{
                                                        width:
                                                            (v / stats.hrs) *
                                                                100 +
                                                            "%",
                                                        background: c,
                                                    }}
                                                />
                                            ),
                                    )}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        marginTop: 10,
                                    }}
                                >
                                    {rows.map(([k, v, c, mult]) => (
                                        <div
                                            key={k}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                fontSize: 12,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 3,
                                                    background: c,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontFamily: FM,
                                                    fontWeight: 800,
                                                    color: C.hi,
                                                    width: 24,
                                                }}
                                            >
                                                {k}
                                            </span>
                                            <span
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 11,
                                                    color: C.lo,
                                                }}
                                            >
                                                ×{mult}
                                            </span>
                                            <span
                                                style={{
                                                    marginLeft: "auto",
                                                    fontFamily: FM,
                                                    fontWeight: 800,
                                                    color: r1(v) ? C.hi : C.lo,
                                                }}
                                            >
                                                {hrsFmt(r1(v))}
                                            </span>
                                            <span
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 11,
                                                    color: C.lo,
                                                    width: 52,
                                                    textAlign: "right",
                                                }}
                                            >
                                                {hrsFmt(r1(v * mult))} pd
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div
                                    style={{
                                        fontSize: 10.5,
                                        color: C.lo,
                                        marginTop: 9,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {hrsFmt(stats.hrs)} clock hrs bill as{" "}
                                    {hrsFmt(r1(paid))} weighted, blended across
                                    each company's rate. The union gets the
                                    clock hours; the paycheck gets the weighted
                                    ones.
                                </div>
                            </div>
                        );
                    })()}

                {/* top companies this month */}
                {stats.cos.length > 0 && (
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
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            BY COMPANY
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }}
                        >
                            {stats.cos.map(([n, h]) => {
                                const b = rangePay(
                                    entries,
                                    Object.keys(entries).filter(
                                        (k) => k.indexOf(prefix) === 0,
                                    ),
                                    lvIdx,
                                    rates,
                                ).byCo[n];
                                return (
                                    <div key={n}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
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
                                            <span
                                                className="truncate"
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    fontSize: 12.5,
                                                    color: C.hi,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {n}
                                            </span>
                                            <span
                                                style={{
                                                    flexShrink: 0,
                                                    fontFamily: FM,
                                                    fontSize: 12,
                                                    fontWeight: 800,
                                                    color: C.hi,
                                                }}
                                            >
                                                {hrsFmt(h)}h
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                marginTop: 5,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    flex: 1,
                                                    height: 5,
                                                    borderRadius: 4,
                                                    background: C.raise,
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "block",
                                                        height: "100%",
                                                        width:
                                                            Math.max(
                                                                4,
                                                                (h /
                                                                    stats
                                                                        .cos[0][1]) *
                                                                    100,
                                                            ) + "%",
                                                        background: coColor(n),
                                                        borderRadius: 4,
                                                    }}
                                                />
                                            </span>
                                            {b && (
                                                <>
                                                    <span
                                                        style={{
                                                            flexShrink: 0,
                                                            fontFamily: FM,
                                                            fontSize: 10.5,
                                                            fontWeight: 800,
                                                            color: b.over
                                                                ? C.brand
                                                                : C.lo,
                                                        }}
                                                    >
                                                        {money(b.rate)}
                                                        {b.over
                                                            ? " " + b.level
                                                            : ""}
                                                    </span>
                                                    <span
                                                        style={{
                                                            flexShrink: 0,
                                                            fontFamily: FM,
                                                            fontSize: 11.5,
                                                            fontWeight: 800,
                                                            color: C.working,
                                                            width: 64,
                                                            textAlign: "right",
                                                        }}
                                                    >
                                                        ${b.gross.toFixed(0)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 12,
                    padding: "0 2px",
                    color: C.lo,
                    fontSize: 11,
                }}
            >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: "rgba(47,176,122,0.28)",
                            border: "1px solid " + C.working,
                        }}
                    />
                    Worked
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: "rgba(180,155,240,0.22)",
                            border: "1px solid " + BOOKED,
                        }}
                    />
                    Scheduled
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: "rgba(232,146,124,0.22)",
                            border: "1px solid " + KLASS,
                        }}
                    />
                    Class
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 9,
                            background: C.gc,
                        }}
                    />
                    On the board
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            width: 3,
                            height: 10,
                            borderRadius: 2,
                            background: C.working,
                        }}
                    />
                    <span
                        style={{
                            width: 3,
                            height: 10,
                            borderRadius: 2,
                            background: C.brand,
                            marginLeft: -3,
                        }}
                    />
                    Working / Target
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            fontFamily: FM,
                            fontWeight: 800,
                            color: C.brand,
                        }}
                    >
                        H
                    </span>
                    Holiday
                </span>
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 10,
                    padding: "0 2px",
                }}
            >
                <button
                    className="foc"
                    onClick={onOpenSummary}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "none",
                        color: C.gc,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: 0,
                    }}
                >
                    <Copy size={13} />
                    Month summary
                </button>
                {stats.hrs > 0 && (
                    <button
                        className="foc"
                        onClick={() => {
                            if (armed) {
                                onClearMonth(prefix);
                                setArmed(false);
                            } else {
                                setArmed(true);
                                setTimeout(() => setArmed(false), 4000);
                            }
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: armed
                                ? "rgba(232,146,124,0.14)"
                                : "transparent",
                            border: armed
                                ? "1px solid " + C.danger + "66"
                                : "none",
                            borderRadius: 7,
                            padding: armed ? "4px 8px" : 0,
                            color: C.danger,
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        <Trash2 size={13} />
                        {armed
                            ? "Tap again — wipes " +
                              stats.days +
                              " day" +
                              (stats.days === 1 ? "" : "s")
                            : "Clear hours"}
                    </button>
                )}
                <span
                    style={{
                        marginLeft: "auto",
                        fontFamily: FM,
                        fontSize: 11,
                        color: C.lo,
                    }}
                >
                    ALL TIME {hrsFmt(allTime)}H
                </span>
            </div>
        </div>
    );
}
export function Summary({ entries, cur }) {
    const prefix = cur.y + "-" + String(cur.m + 1).padStart(2, "0");
    const text = useMemo(() => {
        const keys = Object.keys(entries)
            .filter((k) => k.indexOf(prefix) === 0 && (entries[k] || []).length)
            .sort();
        let hrs = 0;
        const byCo = {};
        const byCat = {};
        const lines = [];
        keys.forEach((k) => {
            const d = fromKey(k);
            (entries[k] || []).forEach((e) => {
                const h = Number(e.hrs) || 0;
                hrs += h;
                byCo[e.co] = (byCo[e.co] || 0) + h;
                if (e.cat) byCat[e.cat] = (byCat[e.cat] || 0) + h;
                lines.push(
                    d.getMonth() +
                        1 +
                        "/" +
                        d.getDate() +
                        "  " +
                        hrsFmt(h) +
                        "h  " +
                        e.co +
                        (e.cat ? "  [CAT " + e.cat + "]" : "") +
                        (e.note ? "  — " + e.note : ""),
                );
            });
        });
        const head = [
            MONTHS[cur.m] +
                " " +
                cur.y +
                " — " +
                hrsFmt(hrs) +
                " hrs / " +
                keys.length +
                " days",
            "",
        ];
        const cos = Object.keys(byCo)
            .sort((a, b) => byCo[b] - byCo[a])
            .map((n) => "  " + n + ": " + hrsFmt(byCo[n]) + "h");
        const cats = CATS.filter((c) => byCat[c]).map(
            (c) => "  CAT " + c + ": " + hrsFmt(byCat[c]) + "h",
        );
        return head
            .concat(cos.length ? ["BY COMPANY"].concat(cos, [""]) : [])
            .concat(cats.length ? ["BY CATEGORY"].concat(cats, [""]) : [])
            .concat(
                lines.length
                    ? ["DETAIL"].concat(lines)
                    : ["No hours logged this month."],
            )
            .join("\n");
    }, [entries, prefix, cur]);

    const [copied, setCopied] = useState(false);
    const copy = () => {
        try {
            if (navigator.clipboard) navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (e) {
            setCopied(false);
        }
    };
    return (
        <div>
            <div
                style={{
                    color: C.mid,
                    fontSize: 12.5,
                    marginBottom: 10,
                    lineHeight: 1.5,
                }}
            >
                Totals for the month, ready to paste into your OJT report.
            </div>
            <textarea
                readOnly
                value={text}
                rows={12}
                onFocus={(e) => e.target.select()}
                style={{
                    width: "100%",
                    resize: "vertical",
                    background: C.sunk,
                    color: C.hi,
                    border: "1px solid " + C.line,
                    borderRadius: 10,
                    padding: "15px 16px",
                    fontSize: 12,
                    fontFamily: FM,
                    lineHeight: 1.6,
                }}
            />
            <button
                className="foc"
                onClick={copy}
                style={{
                    width: "100%",
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "13px",
                    borderRadius: 10,
                    background: copied ? C.working : C.brand,
                    color: copied ? "#06120C" : "#1A1206",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 14,
                }}
            >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy summary"}
            </button>
        </div>
    );
}
