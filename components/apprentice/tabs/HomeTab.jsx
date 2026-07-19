"use client";

/* Split out of ShowBoard.jsx for the same file-size reasons as the other
   tabs — but unlike OJT/Calendar, this one is imported normally (not via
   next/dynamic). Home is the default view every apprentice sees first;
   lazy-loading it would just add a loading flicker with no payload benefit,
   since everyone needs this code immediately anyway. HoursTooltip/
   MonthlyHoursChart/CAT_KEYS (and the recharts imports they need) are
   exclusive to this tab's monthly chart, confirmed via grep before moving. */
import { useContext, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Ban, Bell, Building2, CalendarDays, ChevronRight, GraduationCap, Hammer, Info, Lock, Phone, ShieldAlert, X } from "lucide-react";
import {
    BOOKED,
    C,
    CATS_META,
    DOW,
    FM,
    JATC,
    KLASS,
    LEVELS,
    MONTHS,
    PAY,
    RELIABLE_PAYROLL_TAX_RATE,
    SHADOW,
    STATUS,
    UNION_LINE,
    YEAR,
    bookingOn,
    classOn,
    countdown,
    daysUntil,
    fmtClock,
    fmtTel,
    fromKey,
    hrsFmt,
    isMine,
    isPast,
    keyOf,
    levelIndex,
    mAdd,
    matchCo,
    mkDate,
    mKey,
    mMed,
    mParse,
    mShort,
    myCompanyTokens,
    nextDates,
    num,
    ojtDue,
    ojtState,
    ojtTotals,
    rangePay,
    rollupEntries,
    sameDay,
    showsOn,
    showYear,
    sortDate,
    splitHours,
    statusOn,
    todayMid,
} from "@/lib/core";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { Stat } from "@/components/ui/Stat";
import { SplitChips } from "@/components/ui/SplitChips";
import { hexRgb } from "@/components/utils/hexRgb";
import { r1 } from "@/components/utils/r1";

// not a lib/core export — a tiny local also defined (separately) in
// ShowBoard.jsx; duplicating 3 lines here beats adding an export just for
// this.
function money(n) {
    return "$" + num(n).toFixed(2);
}

/* ---------- monthly hours line chart ---------- */
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

function MonthlyHoursChart({ series }) {
    return (
        <div
            className="dspan"
            style={{
                background: C.panel,
                border: "1px solid " + C.edge,
                borderRadius: 12,
                padding: "11px 12px 4px",
                boxShadow: SHADOW,
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
                style={{ width: "100%", height: 160 }}
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

/* ---------- dashboard ---------- */
export function HomeTab({
    shows,
    entries,
    ojt,
    onOpenDay,
    onGoto,
    onOpenDir,
    rates,
    bookings,
    classes,
    onCallWork,
    hasPassword,
    notifications,
    onClearNotification,
    doNotHire,
}) {
    const { companies } = useContext(DirectoryContext);
    const today = todayMid();
    const roll = useMemo(() => rollupEntries(entries), [entries]);
    const mine = useMemo(() => myCompanyTokens(entries), [entries]);
    const mk = mKey(today.getFullYear(), today.getMonth());
    const m = roll[mk] || {
        a: 0,
        b: 0,
        c: 0,
        d: 0,
        uncat: 0,
        total: 0,
        days: 0,
    };
    const prev = roll[mAdd(mk, -1)] || { total: 0 };
    const delta = m.total - prev.total;

    const months = ojt.months || [];
    // only admin-approved months count toward the running total — pending
    // submissions show up separately (see the OJT tab), not folded in yet.
    const approvedMonths = useMemo(
        () => months.filter((mo) => mo.status === "approved"),
        [months],
    );

    // past months come off what's actually on file with the union (ojt.months) —
    // the calendar only has this year's logged entries, and never for months
    // already submitted. The current month is the one exception: it's still
    // being logged and hasn't been turned in yet, so it comes from the
    // calendar instead. Category (A/B/C/D) breakdown travels with both
    // sources so the chart can show composition, not just a total.
    const submittedByMonth = useMemo(() => {
        const out = {};
        approvedMonths.forEach((mo) => {
            out[mo.m] = { a: num(mo.a), b: num(mo.b), c: num(mo.c), d: num(mo.d) };
        });
        return out;
    }, [approvedMonths]);
    const monthlySeries = useMemo(() => {
        // rolling 12-month window ending at the current month, not a bare
        // calendar year — otherwise half the chart sits empty for the
        // months still ahead of "now" every year until December.
        const startKey = mAdd(mk, -11);
        const out = [];
        for (let i = 0; i < 12; i++) {
            const k = mAdd(startKey, i);
            const cats =
                k === mk
                    ? { a: num(m.a), b: num(m.b), c: num(m.c), d: num(m.d) }
                    : submittedByMonth[k] || { a: 0, b: 0, c: 0, d: 0 };
            out.push({
                k,
                label: MONTHS[mParse(k).m],
                ...cats,
                hrs: cats.a + cats.b + cats.c + cats.d,
            });
        }
        return out;
    }, [mk, m, submittedByMonth]);
    const t = useMemo(() => ojtTotals(approvedMonths), [approvedMonths]);
    const idx = levelIndex(t.total);
    const todayKey = keyOf(today);
    const lv = LEVELS[idx];
    const nxt = LEVELS[idx + 1];
    const pct = nxt
        ? Math.max(
              2,
              Math.min(100, ((t.total - lv.hrs) / (nxt.hrs - lv.hrs)) * 100),
          )
        : 100;

    /* hours the calendar has that the union hasn't been given yet */
    const unsubmitted = useMemo(
        () =>
            Object.keys(roll)
                .filter((k) => !months.some((x) => x.m === k))
                .reduce((a, k) => a + roll[k].total, 0),
        [roll, months],
    );

    const rank = { working: 0, target: 1 };
    const onFloor = useMemo(
        () =>
            showsOn(shows, today).sort((a, b) => {
                const ra = rank[a.status] === undefined ? 2 : rank[a.status];
                const rb = rank[b.status] === undefined ? 2 : rank[b.status];
                return ra !== rb ? ra - rb : sortDate(a) - sortDate(b);
            }),
        [shows],
    );

    const nextUp = useMemo(
        () =>
            shows
                .filter((s) => {
                    const mi = mkDate(s.mi, showYear(s)) || mkDate(s.start, showYear(s));
                    return mi && mi > today;
                })
                .sort((a, b) => sortDate(a) - sortDate(b))
                .slice(0, 3),
        [shows],
    );

    const flags = useMemo(
        () => ({
            working: shows.filter((s) => s.status === "working" && !isPast(s))
                .length,
            target: shows.filter((s) => s.status === "target" && !isPast(s))
                .length,
        }),
        [shows],
    );

    const week = useMemo(() => {
        const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - today.getDay(),
        );
        return [0, 1, 2, 3, 4, 5, 6].map(
            (i) =>
                new Date(
                    start.getFullYear(),
                    start.getMonth(),
                    start.getDate() + i,
                ),
        );
    }, []);
    const weekKeys = week.map(keyOf);
    const weekPay = rangePay(entries, weekKeys, idx, rates);
    const weekHrs = splitHours(weekPay.split);

    /* year to date */
    const yearKeys = Object.keys(entries).filter(
        (k) => k.slice(0, 4) === String(today.getFullYear()),
    );
    const ytd = rangePay(entries, yearKeys, idx, rates);
    const ytdHrs = splitHours(ytd.split);
    const ytdDays = yearKeys.filter((k) => (entries[k] || []).length).length;

    /* the slip that keeps you off the do-not-hire list */
    const lastMk = mAdd(mk, -1);
    const lateSt = ojtState(lastMk, months);
    const openSt = ojtState(mk, months);

    /* nothing on the books? the out-of-work list goes to employers every Friday */
    const horizon = keyOf(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
    );
    const bookedSoon = (bookings || []).some((b) =>
        (b.dates || []).some((d) => d >= todayKey && d <= horizon),
    );
    const workedSoon = Object.keys(entries).some(
        (k) => k >= todayKey && k <= horizon && (entries[k] || []).length,
    );
    const idle = !bookedSoon && !workedSoon;

    const monthKeys = Object.keys(entries).filter((k) => k.slice(0, 7) === mk);
    const mp = rangePay(entries, monthKeys, idx, rates);
    const monthSplit = mp.split;
    const gross = mp.gross;

    /* everything you've committed to that hasn't happened yet, in order */
    const commitments = useMemo(() => {
        const out = [];
        (bookings || []).forEach((b) =>
            nextDates(b, todayKey).forEach((d) =>
                out.push({ kind: "work", d, x: b }),
            ),
        );
        (classes || []).forEach((c) =>
            nextDates(c, todayKey).forEach((d) =>
                out.push({ kind: "class", d, x: c }),
            ),
        );
        out.sort((a, b) =>
            a.d < b.d ? -1 : a.d > b.d ? 1 : a.kind === "class" ? -1 : 1,
        );
        /* collapse runs of the same booking/class into one row */
        const seen = {};
        const rows = [];
        out.forEach((o) => {
            const key = o.kind + o.x.id;
            if (seen[key]) {
                seen[key].days.push(o.d);
                return;
            }
            seen[key] = { ...o, days: [o.d] };
            rows.push(seen[key]);
        });
        return rows.slice(0, 4);
    }, [bookings, classes, todayKey]);
    /* which rates actually showed up this month */
    const inPlay = Object.keys(mp.byCo).reduce((a, n) => {
        const b = mp.byCo[n];
        const k = b.rate + "|" + b.level + "|" + b.over;
        if (!a[k])
            a[k] = { rate: b.rate, level: b.level, over: b.over, cos: [] };
        a[k].cos.push(n);
        return a;
    }, {});

    const ShowLine = (s, i) => {
        const st = s.status ? STATUS[s.status] : null;
        const col = st ? st.color : C.gc;
        const gc = matchCo(s.co, s.region, companies);
        return (
            <button
                key={s.id}
                className="foc"
                onClick={() => onGoto("board", s.id)}
                style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: C.sunk,
                    border: "1px solid " + col + "3A",
                    borderRadius: 9,
                    padding: "9px 10px",
                }}
            >
                <span
                    style={{
                        width: 3,
                        alignSelf: "stretch",
                        borderRadius: 2,
                        background: col,
                        flexShrink: 0,
                    }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        className="truncate"
                        style={{ fontSize: 13, fontWeight: 700, color: C.hi }}
                    >
                        {s.name}
                    </div>
                    <div
                        className="truncate"
                        style={{ fontSize: 11, color: C.mid, marginTop: 2 }}
                    >
                        {s.loc}
                        {s.booth && s.booth !== "TBD" ? " · " + s.booth : ""}
                    </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right", maxWidth: 130 }}>
                    <div
                        className="truncate"
                        style={{
                            fontFamily: FM,
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: isMine(s.co, mine) ? C.brand : C.gc,
                        }}
                    >
                        {gc?.name || (s.co || "TBD").toUpperCase()}
                    </div>
                    {gc && gc.tel && (
                        <div
                            style={{
                                fontFamily: FM,
                                fontSize: 10,
                                color: C.lo,
                                marginTop: 2,
                            }}
                        >
                            {fmtTel(gc.tel)}
                        </div>
                    )}
                </div>
            </button>
        );
    };

    const dayRange = (days) => {
        const a = fromKey(days[0]);
        const b = fromKey(days[days.length - 1]);
        const one = days.length === 1;
        return one
            ? MONTHS[a.getMonth()] + " " + a.getDate()
            : MONTHS[a.getMonth()] +
                  " " +
                  a.getDate() +
                  (b.getMonth() === a.getMonth()
                      ? "–" + b.getDate()
                      : "–" + MONTHS[b.getMonth()] + " " + b.getDate()) +
                  " · " +
                  days.length +
                  " days";
    };

    return (
        <div className="dgrid">
            {(lateSt.k === "late" || (openSt.k === "open" && openSt.days <= 3)) && (
                <button
                    className="foc dspan"
                    onClick={() => onGoto("ojt")}
                    style={{
                        width: "100%",
                        textAlign: "left",
                        background: lateSt.k === "late" ? "rgba(232,146,124,0.1)" : "rgba(255,176,32,0.08)",
                        border: "1px solid " + (lateSt.k === "late" ? C.danger : C.brand) + "77",
                        borderRadius: 12,
                        padding: "13px 15px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                    }}
                >
                    <GraduationCap size={17} color={lateSt.k === "late" ? C.danger : C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: lateSt.k === "late" ? C.danger : C.brand }}>
                            {lateSt.k === "late" ? mMed(lastMk) + " OJT is late" : mMed(mk) + " OJT due " + (openSt.days === 0 ? "today, 4 PM" : "in " + openSt.days + " day" + (openSt.days === 1 ? "" : "s"))}
                        </div>
                        <div style={{ fontSize: 12, color: C.mid, marginTop: 3, lineHeight: 1.5 }}>
                            {lateSt.k === "late"
                                ? "Due the 1st by 4 PM — that's the do-not-hire list."
                                : hrsFmt(r1(m.total)) + " hrs logged so far — turn it in the 1st by 4 PM."}
                        </div>
                    </div>
                </button>
            )}
            {doNotHire && doNotHire.on && (
                <div
                    className="dspan"
                    style={{
                        background: "rgba(232,146,124,0.1)",
                        border: "1px solid " + C.danger + "77",
                        borderRadius: 12,
                        padding: "13px 15px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                    }}
                >
                    <Ban size={17} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.danger }}>
                            You're on the do-not-hire list
                        </div>
                        {doNotHire.reason && (
                            <div style={{ fontSize: 12, color: C.mid, marginTop: 3, lineHeight: 1.5 }}>{doNotHire.reason}</div>
                        )}
                        {doNotHire.since && (
                            <div style={{ fontSize: 10.5, color: C.lo, marginTop: 4, fontFamily: FM }}>
                                since {doNotHire.since.slice(0, 10)} · contact the JATC office to resolve
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* notifications: new class assignments, cert reminders, do-not-hire
                status, schedule updates — color-coded by type, cleared one at
                a time or all at once. Stays visible even when empty so it's
                not a section that randomly appears/disappears. */}
            {(() => {
                const NOTE_META = {
                    class: { icon: GraduationCap, color: KLASS },
                    dnh: { icon: Ban, color: C.danger },
                    cert: { icon: ShieldAlert, color: C.brand },
                    schedule: { icon: CalendarDays, color: C.gc },
                    ojt: { icon: GraduationCap, color: C.brand },
                };
                // where tapping a notification lands you — everything paperwork/
                // class/status-related lives on OJT, schedule updates on Board.
                const NOTE_TAB = {
                    class: "ojt",
                    dnh: "ojt",
                    cert: "ojt",
                    schedule: "board",
                    ojt: "ojt",
                };
                const metaFor = (t) => NOTE_META[t] || { icon: Bell, color: C.gc };
                return (
                    <div
                        className="dspan"
                        style={{
                            background: "rgba(127,178,255,0.07)",
                            border: "1px solid rgba(127,178,255,0.3)",
                            borderRadius: 12,
                            padding: "11px 13px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 9.5,
                                    letterSpacing: 0.8,
                                    color: C.gc,
                                    fontFamily: FM,
                                    fontWeight: 800,
                                }}
                            >
                                NOTIFICATIONS
                            </span>
                            {notifications.length > 1 && (
                                <button
                                    className="foc"
                                    onClick={() => onClearNotification("all")}
                                    style={{
                                        marginLeft: "auto",
                                        background: "transparent",
                                        border: "none",
                                        color: C.lo,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: 0,
                                    }}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        {notifications.length === 0 ? (
                            <div style={{ fontSize: 12, color: C.lo, padding: "4px 0" }}>
                                Nothing new.
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                }}
                            >
                                {notifications.map((n) => {
                                    const { icon: Ico, color: ntColor } = metaFor(n.type);
                                    const strong = n.type === "dnh";
                                    return (
                                        <button
                                            key={n.id}
                                            className="foc"
                                            onClick={() =>
                                                onGoto(NOTE_TAB[n.type] || "ojt")
                                            }
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 9,
                                                background: C.sunk,
                                                border: "1px solid " + (strong ? ntColor + "55" : C.line),
                                                borderRadius: 9,
                                                padding: "8px 10px",
                                            }}
                                        >
                                            <Ico
                                                size={14}
                                                color={ntColor}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <div
                                                className="truncate"
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    fontSize: 12.5,
                                                    color: strong ? ntColor : C.hi,
                                                    fontWeight: strong ? 700 : 400,
                                                }}
                                            >
                                                {n.message}
                                            </div>
                                            <span
                                                role="button"
                                                aria-label="Dismiss"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearNotification(n.id);
                                                }}
                                                style={{
                                                    flexShrink: 0,
                                                    color: C.lo,
                                                    padding: 2,
                                                    display: "flex",
                                                }}
                                            >
                                                <X size={14} />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* nudge: no password on file yet, still relying on the email link */}
            {!hasPassword && (
                <button
                    className="foc dspan"
                    onClick={() => onGoto("ojt", null, { openPassword: true })}
                    style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "rgba(127,178,255,0.08)",
                        border: "1px solid rgba(127,178,255,0.35)",
                        borderRadius: 12,
                        padding: "11px 13px",
                    }}
                >
                    <Lock size={15} color={C.gc} style={{ flexShrink: 0 }} />
                    <div
                        style={{
                            minWidth: 0,
                            flex: 1,
                            fontSize: 12.5,
                            color: C.mid,
                            lineHeight: 1.45,
                        }}
                    >
                        <span style={{ fontWeight: 700, color: C.hi }}>
                            Set a password
                        </span>{" "}
                        so you can sign in next time without waiting on an email
                        link.
                    </div>
                    <ChevronRight
                        size={16}
                        color={C.lo}
                        style={{ flexShrink: 0 }}
                    />
                </button>
            )}

            {/* the month, in money and hours */}
            <div
                className="dspan"
                style={{
                    background: C.panel,
                    border: "1px solid " + C.edge,
                    borderRadius: 14,
                    padding: "14px 15px",
                    boxShadow: SHADOW,
                }}
            >
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <div>
                        <div
                            style={{
                                fontSize: 9.5,
                                letterSpacing: 0.9,
                                color: C.lo,
                                fontFamily: FM,
                            }}
                        >
                            {MONTHS[today.getMonth()]} HOURS
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 8,
                                marginTop: 2,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: FM,
                                    fontSize: 40,
                                    fontWeight: 800,
                                    color: m.total ? C.working : C.lo,
                                    lineHeight: 1.05,
                                }}
                            >
                                {hrsFmt(m.total)}
                            </span>
                            {prev.total > 0 && (
                                <span
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 12,
                                        fontWeight: 800,
                                        color:
                                            delta >= 0 ? C.working : C.danger,
                                    }}
                                >
                                    {delta >= 0 ? "+" : ""}
                                    {hrsFmt(delta)} vs{" "}
                                    {MONTHS[mParse(mAdd(mk, -1)).m]}
                                </span>
                            )}
                        </div>
                        <div
                            style={{
                                fontSize: 11.5,
                                color: C.mid,
                                marginTop: 5,
                            }}
                        >
                            {m.days} day{m.days === 1 ? "" : "s"} worked ·{" "}
                            {hrsFmt(weekHrs)} this week
                        </div>
                    </div>
                    <button
                        className="foc"
                        onClick={() => onGoto("cal")}
                        style={{
                            marginLeft: "auto",
                            flexShrink: 0,
                            background: C.raise,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: "7px 9px",
                            color: C.mid,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11.5,
                            fontWeight: 700,
                        }}
                    >
                        <CalendarDays size={13} />
                        Calendar
                    </button>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 11,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 9.5,
                                letterSpacing: 0.8,
                                color: C.lo,
                                fontFamily: FM,
                            }}
                        >
                            EST. GROSS
                        </div>
                        <div
                            style={{
                                fontFamily: FM,
                                fontSize: 19,
                                fontWeight: 800,
                                color: gross ? C.hi : C.lo,
                                marginTop: 1,
                            }}
                        >
                            $
                            {gross.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>
                        <div
                            style={{ fontSize: 10, color: C.lo, marginTop: 2 }}
                        >
                            {hrsFmt(r1(mp.paid))} weighted hrs
                            {mp.travel > 0
                                ? " + $" + mp.travel.toFixed(2) + " travel"
                                : ""}
                        </div>
                        <div style={{ marginTop: 7 }}>
                            <SplitChips sp={monthSplit} />
                        </div>
                        {Object.keys(inPlay).length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                    marginTop: 7,
                                }}
                            >
                                {Object.keys(inPlay).map((k) => {
                                    const r = inPlay[k];
                                    return (
                                        <div
                                            key={k}
                                            className="truncate"
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10,
                                                color: C.lo,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontWeight: 800,
                                                    color: r.over
                                                        ? C.brand
                                                        : C.mid,
                                                }}
                                            >
                                                {money(r.rate)}
                                            </span>
                                            <span>
                                                {" "}
                                                {r.over
                                                    ? r.level + " · "
                                                    : "scale · "}
                                            </span>
                                            <span>
                                                {r.cos.length > 2
                                                    ? r.cos.length +
                                                      " companies"
                                                    : r.cos.join(", ")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                            justifyContent: "flex-end",
                            maxWidth: 140,
                        }}
                    >
                        {["A", "B", "C", "D"].map((k) => {
                            const v = m[k.toLowerCase()];
                            if (!v) return null;
                            const meta = CATS_META[k];
                            return (
                                <span
                                    key={k}
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        color: meta.color,
                                        background: meta.color + "1F",
                                        border:
                                            "1px solid " + meta.color + "55",
                                        borderRadius: 6,
                                        padding: "3px 6px",
                                    }}
                                >
                                    {k} {hrsFmt(v)}
                                </span>
                            );
                        })}
                        {m.uncat > 0 && (
                            <span
                                style={{
                                    fontFamily: FM,
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    color: C.lo,
                                    border: "1px dashed " + C.line,
                                    borderRadius: 6,
                                    padding: "3px 6px",
                                }}
                            >
                                {hrsFmt(m.uncat)} untagged
                            </span>
                        )}
                    </div>
                </div>
                {/* right next to the OT/DT numbers it explains, not buried
                    below the monthly grid where it's easy to never see —
                    that's where this note used to live. */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid " + C.line,
                        fontSize: 10.5,
                        color: C.mid,
                        lineHeight: 1.5,
                    }}
                >
                    <Info size={12} color={C.gc} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        A flat hours entry (no clock in/out) assumes a standard {fmtClock(PAY.stStart)} start.
                        Clocked in before {fmtClock(PAY.stStart)} or out after {fmtClock(PAY.otEnd)}? Use the time
                        fields on the day sheet instead, or this OT/DT split — and the gross above — will be off.
                    </div>
                </div>
                {gross > 0 && (
                    <div
                        style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid " + C.line,
                            fontSize: 10.5,
                            color: C.mid,
                            lineHeight: 1.5,
                        }}
                    >
                        <span style={{ fontWeight: 800, color: C.hi }}>
                            After SS, Medicare &amp; CA SDI only:{" "}
                            {"$" + (gross * (1 - RELIABLE_PAYROLL_TAX_RATE)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>{" "}
                        — a partial number. Doesn't include federal/state withholding or union dues yet
                        (both vary by paycheck and level), so your real take-home will be lower than this.
                    </div>
                )}
            </div>

            <MonthlyHoursChart series={monthlySeries} />

            {/* this week */}
            <div
                className="dspan"
                style={{
                    background: C.panel,
                    border: "1px solid " + C.edge,
                    borderRadius: 12,
                    padding: "15px 16px",
                    boxShadow: SHADOW,
                }}
            >
                <div
                    style={{
                        fontSize: 9.5,
                        letterSpacing: 0.8,
                        color: C.lo,
                        fontFamily: FM,
                        marginBottom: 8,
                    }}
                >
                    THIS WEEK
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 5,
                    }}
                >
                    {week.map((d, i) => {
                        const k = keyOf(d);
                        const list = entries[k] || [];
                        const hrs = list.reduce((a, e) => a + num(e.hrs), 0);
                        const flagS = statusOn(shows, d);
                        const spine = flagS ? STATUS[flagS].color : null;
                        const classesToday = classOn(classes, k);
                        const hasClass = classesToday.length > 0;
                        const missedClass = classesToday.some(
                            (c) => (c.missedDates || []).indexOf(k) !== -1,
                        );
                        const hasBook = bookingOn(bookings, k).length > 0;
                        const isToday = sameDay(d, today);
                        const board = showsOn(shows, d).length;
                        const fill = hrs
                            ? C.working
                            : hasBook
                              ? BOOKED
                              : hasClass
                                ? missedClass
                                  ? C.danger
                                  : KLASS
                                : null;
                        return (
                            <button
                                key={i}
                                className="foc wcell"
                                onClick={() => onOpenDay(k)}
                                style={{
                                    position: "relative",
                                    borderRadius: 9,
                                    padding:
                                        "5px 4px 4px " + (spine ? 7 : 4) + "px",
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    background: fill
                                        ? "rgba(" +
                                          hexRgb(fill) +
                                          "," +
                                          (hrs ? 0.18 : 0.13) +
                                          ")"
                                        : C.sunk,
                                    border:
                                        "1px solid " +
                                        (isToday
                                            ? C.brand
                                            : fill
                                              ? "rgba(" + hexRgb(fill) + ",0.5)"
                                              : C.line),
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
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 4,
                                        right: 4,
                                        display: "flex",
                                        gap: 2,
                                    }}
                                >
                                    {board > 0 && (
                                        <span
                                            style={{
                                                width: 4,
                                                height: 4,
                                                borderRadius: 5,
                                                background: C.gc,
                                            }}
                                        />
                                    )}
                                </span>
                                <span
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 9,
                                        color: isToday ? C.brand : C.lo,
                                        letterSpacing: 0.4,
                                    }}
                                >
                                    {DOW[d.getDay()]}
                                </span>
                                <span
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 12,
                                        fontWeight: isToday ? 800 : 600,
                                        color: isToday ? C.brand : C.mid,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {d.getDate()}
                                </span>
                                <span
                                    style={{
                                        marginTop: "auto",
                                        fontFamily: FM,
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: hrs
                                            ? C.hi
                                            : hasBook
                                              ? BOOKED
                                              : C.lo,
                                    }}
                                >
                                    {hrs ? hrsFmt(hrs) : hasBook ? "·" : "–"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* the numbers that matter beyond this month */}
            <div
                className="m4 dspan"
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                }}
            >
                <Stat
                    label="THIS WEEK"
                    value={hrsFmt(r1(weekHrs))}
                    sub={
                        weekPay.gross
                            ? "~$" + weekPay.gross.toFixed(0)
                            : "nothing yet"
                    }
                    color={weekHrs ? C.hi : C.lo}
                />
                <Stat
                    label="DAYS THIS MONTH"
                    value={String(m.days)}
                    sub={
                        m.days ? hrsFmt(r1(m.total / m.days)) + " hrs avg" : "—"
                    }
                />
                <Stat
                    label={today.getFullYear() + " HOURS"}
                    value={hrsFmt(r1(ytdHrs))}
                    sub={ytdDays + " days worked"}
                    color={C.gc}
                />
                <Stat
                    label={today.getFullYear() + " GROSS"}
                    value={"$" + Math.round(ytd.gross).toLocaleString()}
                    sub={ytd.travel > 0 ? "incl. $" + Math.round(ytd.travel) + " travel" : "base pay"}
                    color={C.working}
                />
            </div>


            {/* OJT status — urgent styling covers both "never turned in" (late)
                and "turned in, bounced back" (rejected), since both need the
                apprentice to act, not just an FYI badge. */}
            {(() => {
                // once the apprentice has cleared the "declined" bell
                // notification (see notifications.jsx / lib/store.ts
                // clearNotification), treat it as acknowledged — the card
                // still says DECLINED and still links to OJT to fix it, it
                // just stops repainting itself urgent-red on every visit.
                // The status itself (openSt.k) stays "rejected" until they
                // actually resubmit; only the alarm styling backs off.
                const rejectedUnacknowledged =
                    openSt.k === "rejected" &&
                    notifications.some((n) => n.id.endsWith("-" + mk + "-rejected"));
                const urgent = lateSt.k === "late" || rejectedUnacknowledged;
                return (
                    <button
                        className="foc dspan"
                        onClick={() => onGoto("ojt")}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            background: urgent
                                ? "rgba(232,146,124,0.09)"
                                : C.panel,
                            border:
                                "1px solid " +
                                (urgent ? C.danger + "66" : C.edge),
                            borderRadius: 12,
                            padding: "11px 13px",
                            boxShadow: SHADOW,
                        }}
                    >
                        <GraduationCap
                            size={15}
                            color={urgent ? C.danger : C.brand}
                            style={{ flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            {lateSt.k === "late" ? (
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: C.hi,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    <span style={{ fontWeight: 800, color: C.danger }}>
                                        {mMed(lastMk)} OJT is late.
                                    </span>{" "}
                                    Due the 1st by 4 PM — that's the do-not-hire list.
                                </div>
                            ) : openSt.k === "rejected" ? (
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: C.hi,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    <span style={{ fontWeight: 800, color: C.danger }}>
                                        {mMed(mk)} OJT was declined.
                                    </span>{" "}
                                    Check the hours and resubmit.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: C.mid,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    <span style={{ fontWeight: 700, color: C.hi }}>
                                        {mMed(mk)} OJT
                                    </span>{" "}
                                    due {MONTHS[fromKey(ojtDue(mk)).getMonth()]} 1, 4 PM
                                    · {hrsFmt(r1(m.total))} hrs logged so far
                                </div>
                            )}
                        </div>
                        <span
                            style={{
                                flexShrink: 0,
                                fontFamily: FM,
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: lateSt.k === "late" ? C.danger : openSt.c,
                                border:
                                    "1px solid " +
                                    (lateSt.k === "late" ? C.danger : openSt.c) +
                                    "55",
                                borderRadius: 5,
                                padding: "2px 5px",
                            }}
                        >
                            {lateSt.k === "late" ? "LATE" : openSt.t}
                        </span>
                    </button>
                );
            })()}

            {/* nothing booked — get on the list */}
            {idle && (
                <div
                    className="dspan"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "rgba(255,176,32,0.07)",
                        border: "1px solid rgba(255,176,32,0.3)",
                        borderRadius: 12,
                        padding: "11px 13px",
                    }}
                >
                    <Phone
                        size={15}
                        color={C.brand}
                        style={{ flexShrink: 0 }}
                    />
                    <div
                        style={{
                            minWidth: 0,
                            flex: 1,
                            fontSize: 12,
                            color: C.mid,
                            lineHeight: 1.45,
                        }}
                    >
                        Nothing on the books for the next 7 days. Out-of-work
                        lists go to the employers{" "}
                        <span style={{ color: C.hi, fontWeight: 700 }}>
                            every Friday
                        </span>{" "}
                        — call in so you're on it.
                    </div>
                    <a
                        className="foc"
                        href={"tel:" + UNION_LINE}
                        style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: C.brand,
                            color: "#1A1206",
                            textDecoration: "none",
                            padding: "8px 10px",
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 11.5,
                        }}
                    >
                        <Phone size={12} />
                        Call
                    </a>
                </div>
            )}

            {/* left column: what you've already committed to, then apprenticeship progress — stacked so this side keeps pace with "on the floor" */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {commitments.length > 0 && (
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
                                fontSize: 9.5,
                                letterSpacing: 0.8,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            COMING UP
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {commitments.map((c) => {
                                const isClass = c.kind === "class";
                                const col = isClass ? KLASS : BOOKED;
                                const Ico = isClass ? GraduationCap : Hammer;
                                const days = c.days.slice().sort();
                                const n = daysUntil(fromKey(days[0]));
                                return (
                                    <button
                                        key={c.kind + c.x.id}
                                        className="foc"
                                        onClick={() => onOpenDay(days[0])}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                            background: C.sunk,
                                            border: "1px solid " + col + "3A",
                                            borderRadius: 9,
                                            padding: "9px 10px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 3,
                                                alignSelf: "stretch",
                                                borderRadius: 2,
                                                background: col,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Ico
                                            size={13}
                                            color={col}
                                            style={{ flexShrink: 0 }}
                                        />
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                className="truncate"
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: C.hi,
                                                }}
                                            >
                                                {isClass
                                                    ? c.x.name
                                                    : c.x.show || c.x.co}
                                            </div>
                                            <div
                                                className="truncate"
                                                style={{
                                                    fontSize: 11,
                                                    color: C.mid,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {dayRange(days)}
                                                {isClass
                                                    ? " · " +
                                                      fmtClock(c.x.start) +
                                                      " · unpaid"
                                                    : " · " + c.x.co}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 9.5,
                                                fontWeight: 800,
                                                color: col,
                                                border:
                                                    "1px solid " + col + "55",
                                                borderRadius: 5,
                                                padding: "2px 5px",
                                            }}
                                        >
                                            {n === 0
                                                ? "TODAY"
                                                : n === 1
                                                  ? "TMRW"
                                                  : "IN " + n + "D"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* apprenticeship at a glance */}
                <button
                    className="foc"
                    onClick={() => onGoto("ojt")}
                    style={{
                        width: "100%",
                        textAlign: "left",
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
                            gap: 9,
                        }}
                    >
                        <span
                            style={{
                                flexShrink: 0,
                                width: 34,
                                textAlign: "center",
                                fontFamily: FM,
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.brand,
                                background: "rgba(255,176,32,0.14)",
                                border: "1px solid rgba(255,176,32,0.4)",
                                borderRadius: 6,
                                padding: "4px 0",
                            }}
                        >
                            {lv.k}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: C.hi,
                                }}
                            >
                                {lv.label} · {money(lv.pay)}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: C.lo,
                                    fontFamily: FM,
                                    marginTop: 2,
                                }}
                            >
                                {hrsFmt(t.total)} HRS ON FILE
                                {unsubmitted > 0
                                    ? " · +" +
                                      hrsFmt(unsubmitted) +
                                      " NOT SUBMITTED"
                                    : ""}
                            </div>
                        </div>
                        <ChevronRight
                            size={16}
                            color={C.lo}
                            style={{ flexShrink: 0 }}
                        />
                    </div>
                    {nxt && (
                        <div style={{ marginTop: 10 }}>
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
                                    {hrsFmt(t.total)} /{" "}
                                    {nxt.hrs.toLocaleString()}
                                </span>
                                <span
                                    style={{
                                        marginLeft: "auto",
                                        color: C.brand,
                                        fontWeight: 700,
                                    }}
                                >
                                    {hrsFmt(nxt.hrs - t.total)} TO {nxt.k}
                                </span>
                            </div>
                        </div>
                    )}
                </button>
            </div>

            {/* right column: what's live and what's next */}
            <div
                style={{
                    background: C.panel,
                    border: "1px solid " + C.edge,
                    borderRadius: 12,
                    padding: "16px 17px",
                    boxShadow: SHADOW,
                }}
            >
                {onFloor.length > 0 && (
                    <div style={{ marginBottom: nextUp.length ? 13 : 0 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 9,
                                    background: C.working,
                                    boxShadow: "0 0 8px " + C.working,
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 9.5,
                                    letterSpacing: 0.8,
                                    color: C.working,
                                    fontFamily: FM,
                                    fontWeight: 800,
                                }}
                            >
                                ON THE FLOOR TODAY
                            </span>
                            <span
                                style={{
                                    marginLeft: "auto",
                                    fontFamily: FM,
                                    fontSize: 10,
                                    color: C.lo,
                                }}
                            >
                                {onFloor.length}
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {onFloor.slice(0, 3).map(ShowLine)}
                        </div>
                    </div>
                )}

                {nextUp.length > 0 && (
                    <div>
                        <div
                            style={{
                                fontSize: 9.5,
                                letterSpacing: 0.8,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            NEXT MOVE-INS
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {nextUp.map((s) => {
                                const cd = countdown(s);
                                const gc = matchCo(s.co, s.region, companies);
                                const st = s.status ? STATUS[s.status] : null;
                                return (
                                    <button
                                        key={s.id}
                                        className="foc"
                                        onClick={() => onGoto("board", s.id)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                            background: C.sunk,
                                            border: "1px solid " + C.line,
                                            borderRadius: 9,
                                            padding: "9px 10px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                flexShrink: 0,
                                                width: 42,
                                                textAlign: "center",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 14,
                                                    fontWeight: 800,
                                                    color: st ? st.color : C.hi,
                                                    lineHeight: 1.1,
                                                }}
                                            >
                                                {s.mi}
                                            </div>
                                            <div
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 8.5,
                                                    color: C.lo,
                                                    marginTop: 1,
                                                }}
                                            >
                                                MOVE IN
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                className="truncate"
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: C.hi,
                                                }}
                                            >
                                                {s.name}
                                            </div>
                                            <div
                                                className="truncate"
                                                style={{
                                                    fontSize: 11,
                                                    color: C.mid,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {s.loc} · {gc ? gc.name : s.co}
                                            </div>
                                        </div>
                                        {cd && (
                                            <span
                                                style={{
                                                    flexShrink: 0,
                                                    fontFamily: FM,
                                                    fontSize: 9.5,
                                                    fontWeight: 800,
                                                    color: cd.c,
                                                    border:
                                                        "1px solid " +
                                                        cd.c +
                                                        "55",
                                                    borderRadius: 5,
                                                    padding: "2px 5px",
                                                }}
                                            >
                                                {cd.t}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {onFloor.length === 0 && nextUp.length === 0 && (
                    <div
                        style={{
                            color: C.mid,
                            fontSize: 13,
                            padding: "6px 2px",
                        }}
                    >
                        Nothing on the board. Import the schedule to fill this
                        in.
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: "1px solid " + C.line,
                        fontSize: 11,
                        color: C.lo,
                    }}
                >
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 9,
                                background: C.working,
                            }}
                        />
                        {flags.working} working
                    </span>
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 9,
                                background: C.brand,
                            }}
                        />
                        {flags.target} targeted
                    </span>
                    <button
                        className="foc"
                        onClick={onOpenDir}
                        style={{
                            marginLeft: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: "transparent",
                            border: "none",
                            color: C.gc,
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: 0,
                        }}
                    >
                        <Building2 size={13} />
                        Companies
                    </button>
                </div>
            </div>
        </div>
    );
}
