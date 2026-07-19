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

   Seg is exclusive to this tab so it stayed here; Chip/RegionChip/GCChip/
   Card moved out to ShowCard.jsx since Card is the one deeply self-contained
   piece (owns its own DirectoryContext read for the GC-match lookup) — same
   "extract the biggest self-contained block" pass already applied to
   OjtTab.jsx this session. */
import { useState, useEffect, useMemo } from "react";
import {
    Building2,
    CalendarDays,
    ChevronRight,
    HardHat,
    Search,
    X,
} from "lucide-react";
import {
    C,
    FM,
    FS,
    JULY_NOTES,
    REGION,
    REGION_KEYS,
    fromKey,
    isPast,
    keyOf,
    labelFromKey,
    monthKey,
    monthKeyNow,
    myCompanyTokens,
    showSpan,
    sortDate,
} from "@/lib/core";
import { ShowCard } from "@/components/apprentice/tabs/ShowCard";

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
    const mine = useMemo(() => myCompanyTokens(entries), [entries]);
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
                    <div style={{ marginTop: 8 }}>
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
                                                    <ShowCard
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
