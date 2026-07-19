"use client";

/* One show's card on the Board tab — the collapsed row plus its expanded
   detail (GC info, my status, notes, my schedule on this show). Chip/
   RegionChip/GCChip are small helpers exclusive to this card, bundled in
   rather than given their own files (same reasoning as ConfirmModal living
   inside MonthForm.jsx — one real call site). */
import { useState, useContext, useEffect } from "react";
import {
    Building2,
    CalendarDays,
    ChevronRight,
    Clock,
    HardHat,
    MapPin,
    Phone,
    Plus,
} from "lucide-react";
import {
    BOOKED,
    C,
    FM,
    FS,
    REGION,
    SHADOW,
    STATUS,
    UNION_LINE,
    boothInfo,
    coColor,
    countdown,
    fmtTel,
    hrsFmt,
    isMine,
    isPast,
    matchCo,
    venueName,
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

export function ShowCard({
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
    const venue = venueName(show.loc);
    const bi = boothInfo(show.booth);
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
                        style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            rowGap: 3,
                            columnGap: 6,
                            color: C.mid,
                            fontSize: 12,
                            marginTop: 3,
                        }}
                    >
                        <span
                            className="truncate"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                minWidth: 0,
                            }}
                        >
                            <MapPin
                                size={11}
                                color={C.lo}
                                style={{ flexShrink: 0 }}
                            />
                            <span className="truncate">{venue || "—"}</span>
                        </span>
                        {bi?.full && (
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontFamily: FM,
                                    color: C.lo,
                                    flexShrink: 0,
                                }}
                            >
                                Full facility
                            </span>
                        )}
                        {bi?.hall && (
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontSize: 10,
                                    fontFamily: FM,
                                    fontWeight: 700,
                                    letterSpacing: 0.3,
                                    color: C.mid,
                                    background: C.raise,
                                    border: "1px solid " + C.line,
                                    borderRadius: 5,
                                    padding: "1px 5px",
                                }}
                            >
                                HALL {bi.hall}
                            </span>
                        )}
                        {bi?.num && (
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontSize: 10,
                                    fontFamily: FM,
                                    fontWeight: 800,
                                    letterSpacing: 0.3,
                                    color: C.brand,
                                    background: C.brand + "1C",
                                    border: "1px solid " + C.brand + "40",
                                    borderRadius: 5,
                                    padding: "1px 5px",
                                }}
                            >
                                BOOTH {bi.num}
                            </span>
                        )}
                        {bi?.note && (
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontFamily: FM,
                                    color: C.lo,
                                    flexShrink: 0,
                                }}
                            >
                                {bi.note}
                            </span>
                        )}
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
                                                color: C.inkGood,
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
                                                    ? C.ink
                                                    : C.inkGood
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
