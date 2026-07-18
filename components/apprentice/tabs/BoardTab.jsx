"use client";

/* Split out of ShowBoard.jsx, same next/dynamic treatment as the other
   three tabs — but unlike those, this one wasn't a standalone component to
   begin with. It was inline JSX inside App, closing directly over a pile of
   App's own local state (search/filter UI, the shared modal, boardFocusId's
   cross-tab jump). That state stays owned by App and is passed down as
   controlled props (same pattern CalTab already used for cur/setCur) rather
   than moved into this component's own local state, specifically because
   the "tap a show on Home, land on Board with it already expanded and
   filters cleared" feature (see App's boardFocusId effect) needs to reach
   into this state from outside Board. onPatchShow/onOpenDir/onOpenBooking
   are thin callback props wrapping App's setModal/patch, same pattern
   OjtTab/CalTab/HomeTab already use for their own modal triggers.

   Chip/RegionChip/GCChip/Card/Seg are exclusive to this tab (confirmed via
   grep across ShowBoard.jsx before moving) so they came with it. */
import { useState, useContext, useEffect, useMemo } from "react";
import {
    Building2,
    CalendarDays,
    ChevronRight,
    Clock,
    HardHat,
    MapPin,
    Phone,
    Plus,
    Search,
    X,
} from "lucide-react";
import {
    BOOKED,
    C,
    FM,
    FS,
    JULY_NOTES,
    REGION,
    REGION_KEYS,
    SHADOW,
    STATUS,
    UNION_LINE,
    coColor,
    countdown,
    fmtTel,
    fromKey,
    hrsFmt,
    isMine,
    isPast,
    keyOf,
    labelFromKey,
    matchCo,
    monthKey,
    monthKeyNow,
    showSpan,
    sortDate,
} from "@/lib/core";
import { DirectoryContext } from "@/components/utils/DirectoryContext";

function Chip({ style, children }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10.5,
                fontFamily: FM,
                borderRadius: 6,
                padding: "3px 6px",
                lineHeight: 1.3,
                ...style,
            }}
        >
            {children}
        </span>
    );
}

function RegionChip({ region }) {
    const r = REGION[region] || REGION.OTHER;
    return (
        <Chip
            style={{
                background: r.color + "1C",
                color: r.color,
                border: "1px solid " + r.color + "55",
                fontWeight: 800,
            }}
        >
            {r.label}
        </Chip>
    );
}

function GCChip({ co }) {
    if (!co || co === "TBD") return null;
    const c = coColor(co);
    return (
        <Chip
            style={{
                background: c + "1C",
                color: c,
                border: "1px solid " + c + "55",
                fontWeight: 800,
            }}
        >
            <Building2 size={10} />
            {co}
        </Chip>
    );
}

/* ---------- show card ---------- */
function Card({
    show,
    expanded,
    onToggle,
    onStatus,
    onNote,
    onOpenDir,
    onSchedule,
    logged,
    books,
    myCompanies,
}) {
    const { companies } = useContext(DirectoryContext);
    const past = isPast(show);
    const st = show.status ? STATUS[show.status] : null;
    const spine = st ? st.color : C.line;
    const cd = past ? null : countdown(show);
    const bigLabel = show.mi ? "MOVE IN" : "SHOW";
    const bigDate = show.mi || show.start || "—";
    const run = (show.start || "?") + "–" + (show.end || "?");
    const [note, setNote] = useState(show.note || "");
    useEffect(() => {
        setNote(show.note || "");
    }, [show.id, show.note]);
    const bookedDays = (books || []).reduce(
        (a, b) => a + (b.dates || []).length,
        0,
    );

    return (
        <div
            id={"show-" + show.id}
            style={{
                background: C.panel,
                borderRadius: 13,
                overflow: "hidden",
                opacity: show.status === "passed" ? 0.55 : past ? 0.66 : 1,
                transition: "opacity .15s",
                border:
                    "1px solid " +
                    (expanded ? "rgba(127,178,255,0.45)" : C.edge),
                boxShadow: expanded ? "0 6px 20px rgba(0,0,0,0.5)" : SHADOW,
            }}
        >
            <button
                className="foc"
                onClick={onToggle}
                style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    display: "flex",
                    alignItems: "stretch",
                }}
            >
                <div style={{ width: 6, background: spine, flexShrink: 0 }} />
                <div
                    style={{
                        flexShrink: 0,
                        width: 70,
                        padding: "11px 8px",
                        textAlign: "center",
                        background: C.sunk,
                        borderRight: "1px solid " + C.line,
                    }}
                >
                    <div
                        style={{
                            fontSize: 9,
                            letterSpacing: 0.7,
                            color: C.lo,
                            fontFamily: FM,
                        }}
                    >
                        {bigLabel}
                    </div>
                    <div
                        style={{
                            fontSize: 21,
                            fontWeight: 800,
                            fontFamily: FM,
                            color: st ? st.color : C.hi,
                            lineHeight: 1.1,
                            marginTop: 2,
                        }}
                    >
                        {bigDate}
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            color: C.lo,
                            fontFamily: FM,
                            marginTop: 2,
                        }}
                    >
                        {run}
                    </div>
                </div>
                <div
                    className="min-w-0"
                    style={{
                        flex: 1,
                        padding: "11px 11px 11px 10px",
                        minWidth: 0,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <div
                            className="truncate"
                            style={{
                                fontWeight: 750,
                                fontSize: 15,
                                color: C.hi,
                                flex: 1,
                                minWidth: 0,
                                letterSpacing: -0.1,
                            }}
                        >
                            {show.name || "Untitled show"}
                        </div>
                        {st && (
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 9,
                                    background: st.color,
                                    flexShrink: 0,
                                    boxShadow: "0 0 8px " + st.color,
                                }}
                            />
                        )}
                    </div>
                    <div
                        className="truncate"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color: C.mid,
                            fontSize: 12,
                            marginTop: 3,
                        }}
                    >
                        <MapPin size={11} color={C.lo} />
                        <span className="truncate">
                            {show.loc || "—"}
                            {show.booth && show.booth !== "TBD"
                                ? " · " + show.booth
                                : ""}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 5,
                            marginTop: 8,
                        }}
                    >
                        <RegionChip region={show.region} />
                        <GCChip co={show.co} />
                        {cd && (
                            <Chip
                                style={{
                                    background: "transparent",
                                    color: cd.c,
                                    border: "1px solid " + cd.c + "55",
                                    fontWeight: 800,
                                }}
                            >
                                {cd.t}
                            </Chip>
                        )}
                        {bookedDays > 0 && (
                            <Chip
                                style={{
                                    background: "rgba(180,155,240,0.14)",
                                    color: BOOKED,
                                    border: "1px solid rgba(180,155,240,0.35)",
                                    fontWeight: 800,
                                }}
                            >
                                <CalendarDays size={10} />
                                {bookedDays}D
                                {(books || []).length > 1
                                    ? " · " + books.length + " SHOPS"
                                    : ""}
                            </Chip>
                        )}
                        {logged > 0 && (
                            <Chip
                                style={{
                                    background: "rgba(47,176,122,0.14)",
                                    color: C.working,
                                    border: "1px solid rgba(47,176,122,0.3)",
                                    fontWeight: 800,
                                }}
                            >
                                <Clock size={10} />
                                {hrsFmt(logged)}H
                            </Chip>
                        )}
                    </div>
                </div>
            </button>

            {expanded && (
                <div
                    style={{
                        padding: "0 12px 12px 12px",
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {[
                            ["MOVE IN", show.mi],
                            ["START", show.start],
                            ["END", show.end],
                        ].map(([lab, v], k) => (
                            <div
                                key={k}
                                style={{
                                    flex: 1,
                                    background: C.sunk,
                                    borderRadius: 9,
                                    padding: "9px 6px",
                                    textAlign: "center",
                                    border: "1px solid " + C.line,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 9,
                                        letterSpacing: 0.6,
                                        color: C.lo,
                                        fontFamily: FM,
                                    }}
                                >
                                    {lab}
                                </div>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        fontFamily: FM,
                                        color: C.hi,
                                        marginTop: 2,
                                    }}
                                >
                                    {v || "—"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {(() => {
                        const gc = matchCo(show.co, show.region, companies);
                        const mine = isMine(show.co, myCompanies);
                        return (
                            <div style={{ marginTop: 12 }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        letterSpacing: 0.6,
                                        color: C.lo,
                                        fontFamily: FM,
                                        marginBottom: 5,
                                    }}
                                >
                                    GENERAL CONTRACTOR
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        background: C.sunk,
                                        border:
                                            "1px solid " +
                                            (mine
                                                ? "rgba(255,176,32,0.35)"
                                                : "rgba(127,178,255,0.3)"),
                                        borderRadius: 9,
                                        padding: "9px 10px",
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <HardHat
                                                size={13}
                                                color={mine ? C.brand : C.gc}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <span
                                                className="truncate"
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 13.5,
                                                    color: mine
                                                        ? C.brand
                                                        : C.hi,
                                                }}
                                            >
                                                {gc
                                                    ? gc.name
                                                    : show.co || "TBD"}
                                            </span>
                                        </div>
                                        <div
                                            className="truncate"
                                            style={{
                                                fontSize: 11.5,
                                                color: C.mid,
                                                marginTop: 2,
                                            }}
                                        >
                                            {gc
                                                ? [gc.fm, gc.city]
                                                      .filter(Boolean)
                                                      .join(" · ")
                                                : "not in the EI company list"}
                                        </div>
                                    </div>
                                    {gc && gc.tel ? (
                                        <a
                                            className="foc"
                                            href={"tel:" + gc.tel}
                                            style={{
                                                flexShrink: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                background: C.working,
                                                color: "#06120C",
                                                textDecoration: "none",
                                                padding: "8px 11px",
                                                borderRadius: 8,
                                                fontWeight: 800,
                                                fontSize: 12,
                                            }}
                                        >
                                            <Phone size={13} />
                                            {fmtTel(gc.tel)}
                                        </a>
                                    ) : (
                                        <a
                                            className="foc"
                                            href={"tel:" + UNION_LINE}
                                            style={{
                                                flexShrink: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                background: C.raise,
                                                color: C.mid,
                                                textDecoration: "none",
                                                padding: "8px 11px",
                                                borderRadius: 8,
                                                fontWeight: 700,
                                                fontSize: 11.5,
                                                border: "1px solid " + C.line,
                                            }}
                                        >
                                            <Phone size={12} />
                                            Out-of-work line
                                        </a>
                                    )}
                                </div>
                                <button
                                    className="foc"
                                    onClick={onOpenDir}
                                    style={{
                                        width: "100%",
                                        marginTop: 8,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        background: "transparent",
                                        color: C.gc,
                                        border: "1px dashed " + C.line,
                                        borderRadius: 8,
                                        padding: "8px",
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                >
                                    <Building2 size={13} />
                                    I&amp;D houses also staff most shows — open
                                    Companies
                                </button>
                            </div>
                        );
                    })()}

                    <div style={{ marginTop: 12 }}>
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 5,
                            }}
                        >
                            MY STATUS
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            {["working", "target", "passed"].map((k) => {
                                const m = STATUS[k];
                                const active = show.status === k;
                                const Ico = m.Icon;
                                return (
                                    <button
                                        key={k}
                                        className="foc"
                                        onClick={() =>
                                            onStatus(active ? null : k)
                                        }
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 5,
                                            padding: "9px 4px",
                                            borderRadius: 8,
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            background: active
                                                ? m.color
                                                : C.raise,
                                            color: active
                                                ? k === "target"
                                                    ? "#1A1206"
                                                    : "#06120C"
                                                : C.mid,
                                            border:
                                                "1px solid " +
                                                (active ? m.color : C.line),
                                        }}
                                    >
                                        <Ico size={14} />
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 5,
                            }}
                        >
                            NOTES — FOREMAN / CALL TIME / GATE
                        </div>
                        <textarea
                            className="foc"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onBlur={() => onNote(note)}
                            rows={2}
                            placeholder="add a note…"
                            style={{
                                width: "100%",
                                resize: "vertical",
                                background: C.sunk,
                                color: C.hi,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: 13,
                                fontFamily: FS,
                            }}
                        />
                    </div>

                    {/* one show, as many shops as will have you */}
                    <div style={{ marginTop: 12 }}>
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.lo,
                                fontFamily: FM,
                                marginBottom: 5,
                            }}
                        >
                            MY SCHEDULE ON THIS SHOW
                        </div>
                        {(books || []).length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    marginBottom: 6,
                                }}
                            >
                                {books.map((b) => (
                                    <button
                                        key={b.id}
                                        className="foc"
                                        onClick={() => onSchedule(b)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                            background:
                                                "rgba(180,155,240,0.08)",
                                            border:
                                                "1px solid " + BOOKED + "48",
                                            borderRadius: 9,
                                            padding: "9px 10px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 3,
                                                alignSelf: "stretch",
                                                borderRadius: 2,
                                                background: BOOKED,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 9,
                                                background: coColor(b.co),
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span
                                            className="truncate"
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: C.hi,
                                            }}
                                        >
                                            {b.co}
                                        </span>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 11,
                                                fontWeight: 800,
                                                color: BOOKED,
                                            }}
                                        >
                                            {(b.dates || []).length}D
                                        </span>
                                        <ChevronRight
                                            size={15}
                                            color={C.lo}
                                            style={{ flexShrink: 0 }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            className="foc"
                            onClick={() => onSchedule(null)}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 7,
                                padding: "11px",
                                borderRadius: 9,
                                background: "transparent",
                                color: BOOKED,
                                border: "1px dashed " + BOOKED + "66",
                                fontSize: 13,
                                fontWeight: 700,
                            }}
                        >
                            <Plus size={14} />
                            {(books || []).length
                                ? "Schedule another company"
                                : "I got scheduled — pick my days"}
                        </button>
                        {(books || []).length > 0 && (
                            <div
                                style={{
                                    fontSize: 10.5,
                                    color: C.lo,
                                    marginTop: 7,
                                    lineHeight: 1.45,
                                }}
                            >
                                Working the same show for two shops is fine —
                                Eagle one week, Freeman the next. Each gets its
                                own days and its own rate.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------- segmented control ---------- */
function Seg({ value, onChange, options }) {
    return (
        <div
            style={{
                display: "flex",
                background: C.panel,
                borderRadius: 10,
                padding: 3,
                border: "1px solid " + C.line,
            }}
        >
            {options.map((o) => {
                const active = value === o.k;
                return (
                    <button
                        key={o.k}
                        className="foc"
                        onClick={() => onChange(o.k)}
                        style={{
                            flex: 1,
                            padding: "8px 4px",
                            borderRadius: 8,
                            border: "none",
                            fontSize: 12.5,
                            fontWeight: 700,
                            background: active ? C.raise : "transparent",
                            color: active ? C.hi : C.lo,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                        }}
                    >
                        {o.label}
                        {typeof o.count === "number" && (
                            <span
                                style={{
                                    fontSize: 11,
                                    color: active ? C.brand : C.lo,
                                    fontFamily: FM,
                                }}
                            >
                                {o.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function BoardTab({
    shows,
    entries,
    bookings,
    view,
    setView,
    regionsOn,
    setRegionsOn,
    query,
    setQuery,
    expandedId,
    setExpandedId,
    showDates,
    setShowDates,
    openMonths,
    setOpenMonths,
    onPatchShow,
    onOpenDir,
    onOpenBooking,
}) {
    const counts = useMemo(
        () => ({
            upcoming: shows.filter((s) => !isPast(s)).length,
            past: shows.filter(isPast).length,
            working: shows.filter((s) => s.status === "working").length,
            target: shows.filter((s) => s.status === "target").length,
        }),
        [shows],
    );

    /* hours logged inside each show's run, so the board shows what you actually worked */
    const loggedByShow = useMemo(() => {
        const out = {};
        const days = Object.keys(entries);
        shows.forEach((s) => {
            const sp = showSpan(s);
            if (!sp[0] || !sp[1]) return;
            let h = 0;
            days.forEach((k) => {
                const d = fromKey(k);
                if (d >= sp[0] && d <= sp[1])
                    (entries[k] || []).forEach(
                        (e) => (h += Number(e.hrs) || 0),
                    );
            });
            if (h) out[s.id] = h;
        });
        return out;
    }, [shows, entries]);

    /* group into collapsible month sections */
    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        const now = monthKeyNow();
        const past = view === "past";
        const list = shows.filter((s) => {
            if (view === "upcoming" && isPast(s)) return false;
            if (view === "past" && !isPast(s)) return false;
            if (view === "working" && s.status !== "working") return false;
            if (view === "targets" && s.status !== "target") return false;
            if (!regionsOn[s.region]) return false;
            if (q) {
                const hay = (s.name + " " + s.loc + " " + s.co).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        list.sort((a, b) => {
            const d = sortDate(a) - sortDate(b);
            const n = d !== 0 ? d : (a.name || "").localeCompare(b.name || "");
            return past ? -n : n; /* archive reads newest first */
        });
        const out = [];
        const idx = {};
        list.forEach((s) => {
            /* a show still on the floor that opened last month belongs to THIS month, not a stale header */
            const mk =
                view === "upcoming" ? Math.max(monthKey(s), now) : monthKey(s);
            const label = mk === 999999 ? "SCHEDULED" : labelFromKey(mk);
            if (idx[label] === undefined) {
                idx[label] = out.length;
                out.push({ label, shows: [] });
            }
            out[idx[label]].shows.push(s);
        });
        out.forEach((g, i) => {
            g.done = g.shows.every(isPast);
            g.first = i === 0;
        });
        return out;
    }, [shows, view, regionsOn, query]);

    const booksByShow = useMemo(() => {
        const out = {};
        shows.forEach((sh) => {
            const list = (bookings || []).filter(
                (b) =>
                    (b.show || "").toUpperCase() ===
                    (sh.name || "").toUpperCase(),
            );
            if (list.length) out[sh.id] = list;
        });
        return out;
    }, [shows, bookings]);
    const isOpen = (g) =>
        openMonths[g.label] !== undefined
            ? openMonths[g.label]
            : view === "past"
              ? g.first
              : !g.done;
    const activeRegionCount = REGION_KEYS.filter((r) => regionsOn[r]).length;

    return (
        <>
                        <div>
                            <Seg
                                value={view}
                                onChange={setView}
                                options={[
                                    {
                                        k: "upcoming",
                                        label: "Upcoming",
                                        count: counts.upcoming,
                                    },
                                    {
                                        k: "past",
                                        label: "Past",
                                        count: counts.past,
                                    },
                                    {
                                        k: "working",
                                        label: "Working",
                                        count: counts.working,
                                    },
                                    {
                                        k: "targets",
                                        label: "Targets",
                                        count: counts.target,
                                    },
                                ]}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 8,
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 7,
                                        background: C.panel,
                                        border: "1px solid " + C.line,
                                        borderRadius: 10,
                                        padding: "0 10px",
                                    }}
                                >
                                    <Search size={15} color={C.lo} />
                                    <input
                                        className="foc"
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        placeholder="Search show, hall, company"
                                        style={{
                                            flex: 1,
                                            background: "transparent",
                                            border: "none",
                                            color: C.hi,
                                            padding: "10px 0",
                                            fontSize: 13.5,
                                            fontFamily: FS,
                                        }}
                                    />
                                    {query && (
                                        <button
                                            className="foc"
                                            onClick={() => setQuery("")}
                                            style={{
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
                                <button
                                    className="foc"
                                    onClick={onOpenDir}
                                    style={{
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "0 12px",
                                        borderRadius: 10,
                                        fontWeight: 700,
                                        fontSize: 12.5,
                                        background: C.panel,
                                        color: C.mid,
                                        border: "1px solid " + C.line,
                                    }}
                                >
                                    <Building2 size={15} /> Companies
                                </button>
                            </div>
                            <div
                                className="noscroll"
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 8,
                                    overflowX: "auto",
                                }}
                            >
                                {REGION_KEYS.map((r) => {
                                    const on = regionsOn[r];
                                    const meta = REGION[r];
                                    return (
                                        <button
                                            key={r}
                                            className="foc"
                                            onClick={() =>
                                                setRegionsOn((p) => ({
                                                    ...p,
                                                    [r]: !p[r],
                                                }))
                                            }
                                            style={{
                                                flexShrink: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 5,
                                                padding: "6px 11px",
                                                borderRadius: 20,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                fontFamily: FM,
                                                background: on
                                                    ? C.raise
                                                    : "transparent",
                                                color: on ? meta.color : C.lo,
                                                border:
                                                    "1px solid " +
                                                    (on
                                                        ? "transparent"
                                                        : C.line),
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: 9,
                                                    background: on
                                                        ? meta.color
                                                        : C.lo,
                                                }}
                                            />
                                            {r === "OTHER"
                                                ? "OTHER"
                                                : meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    <div>
                        {/* union dates & dues */}
                        <div style={{ marginBottom: 10 }}>
                            <button
                                className="foc"
                                onClick={() => setShowDates((v) => !v)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    background: C.panel,
                                    border: "1px solid " + C.line,
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                    color: C.hi,
                                }}
                            >
                                <CalendarDays size={15} color={C.brand} />
                                <span style={{ fontWeight: 700, fontSize: 13 }}>
                                    July union dates &amp; dues
                                </span>
                                <ChevronRight
                                    size={16}
                                    color={C.lo}
                                    style={{
                                        marginLeft: "auto",
                                        transform: showDates
                                            ? "rotate(90deg)"
                                            : "none",
                                        transition: "transform .15s",
                                    }}
                                />
                            </button>
                            {showDates && (
                                <div
                                    style={{
                                        marginTop: 6,
                                        background: C.panel,
                                        border: "1px solid " + C.line,
                                        borderRadius: 10,
                                        padding: "10px 12px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 9,
                                    }}
                                >
                                    {JULY_NOTES.map(([d, t, col], k) => (
                                        <div
                                            key={k}
                                            style={{ display: "flex", gap: 10 }}
                                        >
                                            <div
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                    color: col,
                                                    flexShrink: 0,
                                                    width: 80,
                                                }}
                                            >
                                                {d}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: C.mid,
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {t}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "2px 2px 10px",
                                color: C.lo,
                                fontSize: 11,
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
                                        width: 8,
                                        height: 8,
                                        borderRadius: 9,
                                        background: C.working,
                                    }}
                                />
                                Working
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
                                        width: 8,
                                        height: 8,
                                        borderRadius: 9,
                                        background: C.brand,
                                    }}
                                />
                                Target
                            </span>
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                }}
                            >
                                <HardHat size={11} color={C.gc} />
                                General
                            </span>
                            <span style={{ marginLeft: "auto" }}>
                                {view === "past"
                                    ? "Archive — tap a month to open it"
                                    : "Working / Target also paints the calendar"}
                            </span>
                        </div>

                        {sections.length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "36px 20px",
                                    color: C.mid,
                                }}
                            >
                                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                                    {emptyMsg}
                                </div>
                                {activeRegionCount < REGION_KEYS.length && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: C.lo,
                                            marginTop: 8,
                                        }}
                                    >
                                        Some regions are filtered out.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                {sections.map((g) => {
                                    const open = isOpen(g);
                                    return (
                                        <div
                                            key={g.label}
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 8,
                                            }}
                                        >
                                            <button
                                                className="foc"
                                                onClick={() =>
                                                    setOpenMonths((p) => ({
                                                        ...p,
                                                        [g.label]: !open,
                                                    }))
                                                }
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: "6px 2px 0",
                                                    width: "100%",
                                                }}
                                            >
                                                <ChevronRight
                                                    size={14}
                                                    color={
                                                        g.done ? C.lo : C.mid
                                                    }
                                                    style={{
                                                        transform: open
                                                            ? "rotate(90deg)"
                                                            : "none",
                                                        transition:
                                                            "transform .15s",
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontFamily: FM,
                                                        fontSize: 12,
                                                        fontWeight: 800,
                                                        letterSpacing: 1.5,
                                                        color: g.done
                                                            ? C.lo
                                                            : C.mid,
                                                    }}
                                                >
                                                    {g.label}
                                                </span>
                                                {g.done && (
                                                    <span
                                                        style={{
                                                            fontFamily: FM,
                                                            fontSize: 10,
                                                            color: C.lo,
                                                            background: C.panel,
                                                            border:
                                                                "1px solid " +
                                                                C.line,
                                                            borderRadius: 5,
                                                            padding: "1px 5px",
                                                        }}
                                                    >
                                                        DONE
                                                    </span>
                                                )}
                                                <span
                                                    style={{
                                                        flex: 1,
                                                        height: 1,
                                                        background: C.line,
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontFamily: FM,
                                                        fontSize: 11,
                                                        color: C.lo,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {g.shows.length}
                                                </span>
                                            </button>
                                            {open &&
                                                g.shows.map((s) => (
                                                    <Card
                                                        key={s.id}
                                                        show={s}
                                                        expanded={
                                                            expandedId === s.id
                                                        }
                                                        logged={
                                                            loggedByShow[
                                                                s.id
                                                            ] || 0
                                                        }
                                                        books={
                                                            booksByShow[s.id] ||
                                                            []
                                                        }
                                                        myCompanies={mine}
                                                        onSchedule={(b) => {
                                                            const sp =
                                                                showSpan(s);
                                                            const days = [];
                                                            if (
                                                                sp[0] &&
                                                                sp[1]
                                                            ) {
                                                                const d =
                                                                    new Date(
                                                                        sp[0],
                                                                    );
                                                                while (
                                                                    d <= sp[1]
                                                                ) {
                                                                    days.push(
                                                                        keyOf(
                                                                            d,
                                                                        ),
                                                                    );
                                                                    d.setDate(
                                                                        d.getDate() +
                                                                            1,
                                                                    );
                                                                }
                                                            }
                                                            onOpenBooking({
                                                                span: days,
                                                                booking: b || {
                                                                    id:
                                                                        "bk" +
                                                                        Date.now().toString(
                                                                            36,
                                                                        ) +
                                                                        Math.random()
                                                                            .toString(
                                                                                36,
                                                                            )
                                                                            .slice(
                                                                                2,
                                                                                5,
                                                                            ),
                                                                    co: "",
                                                                    show: s.name,
                                                                    note: "",
                                                                    dates: [],
                                                                },
                                                                fresh: !b,
                                                            });
                                                        }}
                                                        onToggle={() =>
                                                            setExpandedId(
                                                                expandedId ===
                                                                    s.id
                                                                    ? null
                                                                    : s.id,
                                                            )
                                                        }
                                                        onStatus={(v) =>
                                                            onPatchShow(s.id, {
                                                                status: v,
                                                            })
                                                        }
                                                        onNote={(n) =>
                                                            onPatchShow(s.id, {
                                                                note: n,
                                                            })
                                                        }
                                                        onOpenDir={onOpenDir}
                                                    />
                                                ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
        </>
    );
}
