"use client";

/* The modal behind every calendar day and the Home "Log today" button —
   by far the biggest single piece of the old ShowBoard.jsx monolith (~1,650
   of its ~4,300 lines). Pulled out on its own: it's already fully
   prop-driven (no closures over App's local state), so the extraction is
   just a move, not a rework. */
import { useContext, useEffect, useMemo, useState } from "react";
import {
    Ban,
    Building2,
    Check,
    ChevronRight,
    Copy,
    GraduationCap,
    HardHat,
    MapPin,
    Minus,
    Plus,
    Star,
    Trash2,
} from "lucide-react";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { r1 } from "@/components/utils/r1";
import { SplitChips } from "@/components/ui/SplitChips";
import { CoPicker } from "@/components/apprentice/CoPicker";
import {
    BOOKED,
    BREAK_SLOTS,
    C,
    CATS_META,
    FM,
    FS,
    KLASS,
    PAY,
    STATUS,
    TIME_SLOTS,
    bookingOn,
    classOn,
    coColor,
    entrySplit,
    fmtClock,
    fromKey,
    holidayName,
    hrsFmt,
    keyOf,
    longDate,
    mapsUrl,
    matchCo,
    num,
    paidHours,
    rangePay,
    rateFor,
    showsOn,
    splitHours,
} from "@/lib/core";

const CATS = ["A", "B", "C", "D"];
const HOUR_CHIPS = [4, 6, 8, 10, 12];

function money(n) {
    return "$" + num(n).toFixed(2);
}

/* per-day note on a (possibly multi-day) booking — a start time or booth
   number that only applies to this one date, distinct from the booking's
   blanket note across every day it spans */
function DayNoteField({ value, onSave }) {
    const [v, setV] = useState(value || "");
    useEffect(() => setV(value || ""), [value]);
    return (
        <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => {
                if (v !== (value || "")) onSave(v);
            }}
            placeholder="note for today — start time, gate, booth…"
            style={{
                width: "100%",
                background: C.sunk,
                border: "1px solid " + C.line,
                borderRadius: 7,
                padding: "7px 9px",
                color: C.hi,
                fontSize: 12,
            }}
        />
    );
}

export function DaySheet({
    dayKey,
    shows,
    entries,
    pins,
    customCos,
    onSave,
    onDelete,
    onAddCo,
    lvIdx,
    rates,
    bookings,
    classes,
    onDelBooking,
    onSaveBooking,
}) {
    const { companies } = useContext(DirectoryContext);
    const d = fromKey(dayKey);
    const list = entries[dayKey] || [];
    const rank = { working: 0, target: 1 };
    const onBoard = showsOn(shows, d).sort((a, b) => {
        const ra = rank[a.status] === undefined ? 2 : rank[a.status];
        const rb = rank[b.status] === undefined ? 2 : rank[b.status];
        return ra !== rb ? ra - rb : (a.name || "").localeCompare(b.name || "");
    });
    const [picking, setPicking] = useState(false);
    const [co, setCo] = useState("");
    const [hrs, setHrs] = useState(8);
    const [cat, setCat] = useState("");
    const [note, setNote] = useState("");
    const [travel, setTravel] = useState("");
    const [editId, setEditId] = useState(null);
    const [mode, setMode] = useState("hrs");
    const [tin, setTin] = useState(PAY.stStart);
    const [tout, setTout] = useState(PAY.stEnd);
    const [brk, setBrk] = useState(0);
    const [touched, setTouched] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const booked = bookingOn(bookings, dayKey);
    const klass = classOn(classes, dayKey);
    const dd = fromKey(dayKey);
    const hol = holidayName(dd);

    // most recent day before this one with anything logged — "copy" reuses
    // its first entry's company/category/hours so a multi-day call at the
    // same company doesn't mean retyping the same thing every morning
    const lastLoggedDay = useMemo(() => {
        const d = new Date(dd);
        for (let i = 0; i < 21; i++) {
            d.setDate(d.getDate() - 1);
            const k = keyOf(d);
            if ((entries[k] || []).length > 0) return k;
        }
        return null;
    }, [dd, entries]);
    const copyFromDay = (key) => {
        const src = (entries[key] || [])[0];
        if (!src) return;
        setCo(src.co);
        setCat(src.cat || "");
        setNote(src.note || "");
        if (src.in != null && src.out != null) {
            setMode("time");
            setTin(src.in % 1440);
            setTout(src.out % 1440);
            setBrk(num(src.brk));
        } else {
            setMode("hrs");
            setHrs(src.hrs);
        }
    };

    /* an out that lands at or before the in means the call ran overnight */
    const inM = tin;
    let outM = tout;
    const overnight = outM <= inM;
    if (overnight) outM += 1440;

    const draft =
        mode === "time"
            ? { co, in: inM, out: outM, brk: num(brk) }
            : { co, hrs: num(hrs) };
    const sp = entrySplit(dayKey, draft);
    const clock = splitHours(sp);
    const paid = paidHours(sp);
    const rt = rateFor(co, lvIdx, rates);

    const reset = () => {
        setCo("");
        setHrs(8);
        setCat("");
        setNote("");
        setTravel("");
        setEditId(null);
        setMode("hrs");
        setTin(PAY.stStart);
        setTout(PAY.stEnd);
        setBrk(0);
        setTouched(false);
    };
    /* nothing saves half-filled — the union form has no blanks */
    const missing = [];
    if (!co) missing.push("company");
    if (!cat) missing.push("category");
    if (r1(clock) <= 0) missing.push("hours");
    const ok = missing.length === 0;
    const prefill = (s) => {
        const gc = matchCo(s.co, s.region, companies);
        setCo(gc ? gc.name : s.co || "");
        setNote(s.name + (s.loc ? " · " + s.loc : ""));
    };
    const commit = () => {
        setTouched(true);
        if (!ok) {
            if (!co) setPicking(true);
            return;
        }
        const base = {
            id:
                editId ||
                "e" +
                    Date.now().toString(36) +
                    Math.random().toString(36).slice(2, 5),
            co,
            cat,
            note: note.trim(),
            travel: travel ? num(travel) : undefined,
        };
        const row =
            mode === "time"
                ? { ...base, hrs: r1(clock), in: inM, out: outM, brk: num(brk) }
                : { ...base, hrs: num(hrs) };
        onSave(dayKey, row);
        // local-first save is already committed to state by the time onSave
        // returns (see saveEntry in the App component) — this is just
        // reassurance that it landed, not a wait-for-server confirmation.
        setJustSaved(co + " · " + hrsFmt(r1(clock)) + "h");
        setTimeout(() => setJustSaved(false), 1800);
        reset();
    };
    const startEdit = (e) => {
        setEditId(e.id);
        setCo(e.co);
        setHrs(e.hrs);
        setCat(e.cat || "");
        setNote(e.note || "");
        setTravel(e.travel ? String(e.travel) : "");
        setTouched(false);
        if (e.in != null && e.out != null) {
            setMode("time");
            setTin(e.in % 1440);
            setTout(e.out % 1440);
            setBrk(num(e.brk));
        } else {
            setMode("hrs");
        }
    };
    const total = list.reduce((a, e) => a + (Number(e.hrs) || 0), 0);
    const dayPay = rangePay(entries, [dayKey], lvIdx, rates);
    const daySplit = dayPay.split;

    if (picking) {
        return (
            <CoPicker
                value={co}
                pins={pins}
                customCos={customCos}
                onAddCo={onAddCo}
                onPick={(n) => {
                    setCo(n);
                    setPicking(false);
                }}
                onClose={() => setPicking(false)}
            />
        );
    }

    return (
        <div>
            {hol && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(255,176,32,0.1)",
                        border: "1px solid rgba(255,176,32,0.35)",
                        borderRadius: 9,
                        padding: "9px 11px",
                        marginBottom: 12,
                    }}
                >
                    <Star
                        size={13}
                        color={C.brand}
                        fill={C.brand}
                        style={{ flexShrink: 0 }}
                    />
                    <span
                        style={{ fontSize: 12, color: C.mid, lineHeight: 1.4 }}
                    >
                        <span style={{ fontWeight: 700, color: C.brand }}>
                            {hol}
                        </span>{" "}
                        — federal holiday. Work it and you're guaranteed{" "}
                        {PAY.holMinOt} hrs at OT.
                    </span>
                </div>
            )}

            {klass.map((c) => (
                <div
                    key={c.id}
                    style={{
                        background: "rgba(232,146,124,0.08)",
                        border: "1px solid " + KLASS + "55",
                        borderRadius: 11,
                        padding: "16px 17px",
                        marginBottom: 12,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <GraduationCap
                            size={15}
                            color={KLASS}
                            style={{ flexShrink: 0 }}
                        />
                        <span
                            className="truncate"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 14,
                                fontWeight: 750,
                                color: C.hi,
                            }}
                        >
                            {c.name}
                        </span>
                        <span
                            style={{
                                flexShrink: 0,
                                fontFamily: FM,
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: KLASS,
                                border: "1px solid " + KLASS + "55",
                                borderRadius: 5,
                                padding: "2px 5px",
                            }}
                        >
                            MANDATORY
                        </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                        <div
                            style={{
                                flex: 1,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "9px 6px",
                                textAlign: "center",
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
                                START
                            </div>
                            <div
                                style={{
                                    fontFamily: FM,
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: C.hi,
                                    marginTop: 2,
                                }}
                            >
                                {fmtClock(c.start)}
                            </div>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "9px 6px",
                                textAlign: "center",
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
                                DAY
                            </div>
                            <div
                                style={{
                                    fontFamily: FM,
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: C.hi,
                                    marginTop: 2,
                                }}
                            >
                                {(c.dates || [])
                                    .slice()
                                    .sort()
                                    .indexOf(dayKey) + 1}{" "}
                                / {(c.dates || []).length}
                            </div>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "9px 6px",
                                textAlign: "center",
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
                                PAY
                            </div>
                            <div
                                style={{
                                    fontFamily: FM,
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: KLASS,
                                    marginTop: 2,
                                }}
                            >
                                NONE
                            </div>
                        </div>
                    </div>

                    {c.loc && (
                        <a
                            className="foc"
                            href={mapsUrl(c.loc)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 9,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "10px 11px",
                                textDecoration: "none",
                            }}
                        >
                            <MapPin
                                size={14}
                                color={KLASS}
                                style={{ flexShrink: 0 }}
                            />
                            <span
                                className="truncate"
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: 12.5,
                                    color: C.hi,
                                }}
                            >
                                {c.loc}
                            </span>
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontFamily: FM,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: KLASS,
                                }}
                            >
                                DIRECTIONS
                            </span>
                            <ChevronRight
                                size={14}
                                color={C.lo}
                                style={{ flexShrink: 0 }}
                            />
                        </a>
                    )}

                    {c.note && (
                        <div
                            style={{
                                fontSize: 11.5,
                                color: C.mid,
                                marginTop: 9,
                                lineHeight: 1.5,
                            }}
                        >
                            {c.note}
                        </div>
                    )}
                </div>
            ))}

            {booked.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: BOOKED,
                            fontFamily: FM,
                            marginBottom: 6,
                        }}
                    >
                        SCHEDULED TO WORK
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {booked.map((b) => (
                            <div
                                key={b.id}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 7,
                                    background: "rgba(180,155,240,0.09)",
                                    border: "1px solid " + BOOKED + "55",
                                    borderRadius: 9,
                                    padding: "9px 10px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
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
                                    <button
                                        className="foc"
                                        onClick={() => {
                                            setCo(b.co);
                                            setNote(b.show || b.note || "");
                                        }}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            textAlign: "left",
                                            background: "transparent",
                                            border: "none",
                                            padding: 0,
                                        }}
                                    >
                                        <div
                                            className="truncate"
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: C.hi,
                                            }}
                                        >
                                            {b.show || b.co}
                                        </div>
                                        <div
                                            className="truncate"
                                            style={{
                                                fontSize: 11,
                                                color: C.mid,
                                                marginTop: 2,
                                            }}
                                        >
                                            {b.co}
                                            {b.note ? " · " + b.note : ""}
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10,
                                                fontWeight: 800,
                                                color: BOOKED,
                                                marginTop: 4,
                                            }}
                                        >
                                            TAP TO FILL THE FORM
                                        </div>
                                    </button>
                                    <button
                                        className="foc"
                                        onClick={() => onDelBooking(b.id)}
                                        style={{
                                            flexShrink: 0,
                                            background: "transparent",
                                            border: "none",
                                            color: C.lo,
                                            padding: 3,
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <DayNoteField
                                    value={b.dayNotes?.[dayKey]}
                                    onSave={(v) => {
                                        const dn = { ...(b.dayNotes || {}) };
                                        if (v.trim()) dn[dayKey] = v.trim();
                                        else delete dn[dayKey];
                                        onSaveBooking({ ...b, dayNotes: dn });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {onBoard.length > 0 && klass.length === 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            marginBottom: 6,
                        }}
                    >
                        ON THE BOARD THIS DAY — TAP TO FILL
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {onBoard.map((s) => {
                            const st = s.status ? STATUS[s.status] : null;
                            const col = st ? st.color : C.gc;
                            return (
                                <button
                                    key={s.id}
                                    className="foc"
                                    onClick={() => prefill(s)}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        background: C.sunk,
                                        border: "1px solid " + col + "48",
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
                                    <HardHat
                                        size={13}
                                        color={col}
                                        style={{ flexShrink: 0 }}
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
                                        {s.name}
                                    </span>
                                    {st && (
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 9.5,
                                                fontWeight: 800,
                                                letterSpacing: 0.4,
                                                color: col,
                                                border:
                                                    "1px solid " + col + "55",
                                                borderRadius: 5,
                                                padding: "2px 4px",
                                            }}
                                        >
                                            {st.label.toUpperCase()}
                                        </span>
                                    )}
                                    <span
                                        className="truncate"
                                        style={{
                                            flexShrink: 0,
                                            maxWidth: 110,
                                            fontSize: 11,
                                            color: C.mid,
                                            fontFamily: FM,
                                        }}
                                    >
                                        {s.co}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {list.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: 6,
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
                            LOGGED
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
                            {hrsFmt(total)} HRS
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 7,
                        }}
                    >
                        <SplitChips sp={daySplit} />
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: C.hi,
                            }}
                        >
                            ~${dayPay.gross.toFixed(2)}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {list.map((e) => (
                            <div
                                key={e.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                    background: C.sunk,
                                    border: "1px solid " + C.line,
                                    borderRadius: 9,
                                    padding: "9px 10px",
                                }}
                            >
                                <span
                                    style={{
                                        width: 4,
                                        alignSelf: "stretch",
                                        borderRadius: 3,
                                        background: coColor(e.co),
                                        flexShrink: 0,
                                    }}
                                />
                                <button
                                    className="foc"
                                    onClick={() => startEdit(e)}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "left",
                                        background: "transparent",
                                        border: "none",
                                        padding: 0,
                                    }}
                                >
                                    <div
                                        className="truncate"
                                        style={{
                                            fontWeight: 700,
                                            fontSize: 13,
                                            color: C.hi,
                                        }}
                                    >
                                        {e.co}
                                    </div>
                                    {(e.note || e.cat) && (
                                        <div
                                            className="truncate"
                                            style={{
                                                fontSize: 11,
                                                color: C.mid,
                                                marginTop: 2,
                                            }}
                                        >
                                            {e.cat
                                                ? "CAT " +
                                                  e.cat +
                                                  (e.note ? " · " : "")
                                                : ""}
                                            {e.note}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            marginTop: 4,
                                        }}
                                    >
                                        {e.in != null && e.out != null && (
                                            <span
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 10,
                                                    color: C.lo,
                                                }}
                                            >
                                                {fmtClock(e.in)}–
                                                {fmtClock(e.out)}
                                                {e.out > 1440 ? " +1d" : ""}
                                                {num(e.brk)
                                                    ? " · " +
                                                      num(e.brk) +
                                                      "m brk"
                                                    : ""}
                                            </span>
                                        )}
                                        <SplitChips
                                            sp={entrySplit(dayKey, e)}
                                            size={9.5}
                                        />
                                        {(() => {
                                            const r = rateFor(
                                                e.co,
                                                lvIdx,
                                                rates,
                                            );
                                            return (
                                                <span
                                                    style={{
                                                        fontFamily: FM,
                                                        fontSize: 9.5,
                                                        fontWeight: 800,
                                                        color: r.over
                                                            ? C.brand
                                                            : C.lo,
                                                    }}
                                                >
                                                    {money(r.rate)}
                                                    {r.over
                                                        ? " " + r.level
                                                        : ""}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </button>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontFamily: FM,
                                        fontWeight: 800,
                                        fontSize: 15,
                                        color: C.hi,
                                    }}
                                >
                                    {hrsFmt(e.hrs)}
                                    <span style={{ fontSize: 10, color: C.lo }}>
                                        h
                                    </span>
                                </span>
                                <button
                                    className="foc"
                                    onClick={() => onDelete(dayKey, e.id)}
                                    style={{
                                        flexShrink: 0,
                                        background: "transparent",
                                        border: "none",
                                        color: C.lo,
                                        padding: 3,
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {klass.length > 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "16px 12px",
                        color: C.lo,
                        fontSize: 12.5,
                        lineHeight: 1.55,
                    }}
                >
                    You're in class this day — no hours to log. Class time is
                    unpaid and doesn't count toward OJT.
                </div>
            ) : (
                <>
                    {!editId && list.length === 0 && lastLoggedDay && (
                        <button
                            className="foc"
                            onClick={() => copyFromDay(lastLoggedDay)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                width: "100%",
                                background: C.sunk,
                                border: "1px dashed " + C.line,
                                borderRadius: 9,
                                padding: "9px 11px",
                                marginBottom: 10,
                                color: C.mid,
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            <Copy size={13} style={{ flexShrink: 0 }} />
                            Copy {longDate(fromKey(lastLoggedDay))
                                .split(", ")
                                .slice(1)
                                .join(", ")}
                            's log — {entries[lastLoggedDay][0].co}
                        </button>
                    )}
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            marginBottom: 6,
                        }}
                    >
                        {editId ? "EDIT ENTRY" : "COMPANY"}{" "}
                        <span
                            style={{ color: touched && !co ? C.danger : C.lo }}
                        >
                            *
                        </span>
                    </div>
                    <button
                        className="foc"
                        onClick={() => setPicking(true)}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            background: C.sunk,
                            border:
                                "1px solid " +
                                (co
                                    ? coColor(co) + "66"
                                    : touched && !co
                                      ? C.danger
                                      : C.line),
                            borderRadius: 9,
                            padding: "12px 11px",
                        }}
                    >
                        {co ? (
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 9,
                                    background: coColor(co),
                                    flexShrink: 0,
                                }}
                            />
                        ) : (
                            <Building2 size={15} color={C.lo} />
                        )}
                        <span
                            className="truncate"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                textAlign: "left",
                                fontSize: 14,
                                fontWeight: 700,
                                color: co ? C.hi : C.lo,
                            }}
                        >
                            {co || "Choose company"}
                        </span>
                        <ChevronRight size={16} color={C.lo} />
                    </button>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            margin: "14px 0 6px",
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
                            HOURS
                        </div>
                        <div
                            style={{
                                marginLeft: "auto",
                                display: "flex",
                                background: C.raise,
                                borderRadius: 8,
                                padding: 2,
                                border: "1px solid " + C.line,
                            }}
                        >
                            {[
                                ["hrs", "Hours"],
                                ["time", "In / Out"],
                            ].map(([k, lab]) => (
                                <button
                                    key={k}
                                    className="foc"
                                    onClick={() => setMode(k)}
                                    style={{
                                        padding: "5px 10px",
                                        borderRadius: 6,
                                        border: "none",
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        background:
                                            mode === k
                                                ? C.panel
                                                : "transparent",
                                        color: mode === k ? C.hi : C.lo,
                                    }}
                                >
                                    {lab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === "hrs" ? (
                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <button
                                    className="foc"
                                    onClick={() =>
                                        setHrs((h) =>
                                            Math.max(0, (Number(h) || 0) - 0.5),
                                        )
                                    }
                                    style={{
                                        flexShrink: 0,
                                        width: 42,
                                        height: 44,
                                        borderRadius: 9,
                                        background: C.raise,
                                        border: "1px solid " + C.line,
                                        color: C.hi,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Minus size={16} />
                                </button>
                                <div
                                    style={{
                                        flex: 1,
                                        textAlign: "center",
                                        background: C.sunk,
                                        border: "1px solid " + C.line,
                                        borderRadius: 9,
                                        padding: "6px 4px",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 24,
                                            fontWeight: 800,
                                            color: C.hi,
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {hrsFmt(hrs)}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: C.lo,
                                            fontFamily: FM,
                                            letterSpacing: 0.6,
                                        }}
                                    >
                                        HOURS
                                    </div>
                                </div>
                                <button
                                    className="foc"
                                    onClick={() =>
                                        setHrs((h) =>
                                            Math.min(
                                                24,
                                                (Number(h) || 0) + 0.5,
                                            ),
                                        )
                                    }
                                    style={{
                                        flexShrink: 0,
                                        width: 42,
                                        height: 44,
                                        borderRadius: 9,
                                        background: C.raise,
                                        border: "1px solid " + C.line,
                                        color: C.hi,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 8,
                                }}
                            >
                                {HOUR_CHIPS.map((h) => (
                                    <button
                                        key={h}
                                        className="foc"
                                        onClick={() => setHrs(h)}
                                        style={{
                                            flex: 1,
                                            padding: "8px 0",
                                            borderRadius: 8,
                                            fontFamily: FM,
                                            fontSize: 13,
                                            fontWeight: 800,
                                            background:
                                                Number(hrs) === h
                                                    ? C.brand
                                                    : C.raise,
                                            color:
                                                Number(hrs) === h
                                                    ? C.ink
                                                    : C.mid,
                                            border:
                                                "1px solid " +
                                                (Number(hrs) === h
                                                    ? C.brand
                                                    : C.line),
                                        }}
                                    >
                                        {h}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: "flex", gap: 7 }}>
                                {[
                                    [
                                        "IN",
                                        tin,
                                        (v) => {
                                            setTin(v);
                                            // moving IN later shouldn't leave a stale OUT
                                            // sitting minutes away — bump it to a sane
                                            // 4-hour-minimum shift unless OUT was already
                                            // set further out than that.
                                            setTout((prev) =>
                                                prev < v + 240
                                                    ? Math.min(v + 240, TIME_SLOTS[TIME_SLOTS.length - 1])
                                                    : prev,
                                            );
                                        },
                                    ],
                                    ["OUT", tout, setTout],
                                ].map(([lab, v, set]) => (
                                    <div
                                        key={lab}
                                        style={{ flex: 1, minWidth: 0 }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 9.5,
                                                letterSpacing: 0.5,
                                                color: C.lo,
                                                fontFamily: FM,
                                                marginBottom: 4,
                                            }}
                                        >
                                            {lab}
                                        </div>
                                        <select
                                            className="foc"
                                            value={v}
                                            onChange={(e) =>
                                                set(Number(e.target.value))
                                            }
                                            style={{
                                                width: "100%",
                                                background: C.sunk,
                                                color: C.hi,
                                                border: "1px solid " + C.line,
                                                borderRadius: 9,
                                                padding: "11px 6px",
                                                fontSize: 15,
                                                fontFamily: FM,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {TIME_SLOTS.map((m) => (
                                                <option key={m} value={m}>
                                                    {fmtClock(m)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                                <div style={{ width: 82, flexShrink: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 9.5,
                                            letterSpacing: 0.5,
                                            color: C.lo,
                                            fontFamily: FM,
                                            marginBottom: 4,
                                        }}
                                    >
                                        BREAK
                                    </div>
                                    <select
                                        className="foc"
                                        value={brk}
                                        onChange={(e) =>
                                            setBrk(Number(e.target.value))
                                        }
                                        style={{
                                            width: "100%",
                                            background: C.sunk,
                                            color: C.hi,
                                            border: "1px solid " + C.line,
                                            borderRadius: 9,
                                            padding: "11px 4px",
                                            fontSize: 15,
                                            fontFamily: FM,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {BREAK_SLOTS.map((m) => (
                                            <option key={m} value={m}>
                                                {m ? m + "m" : "none"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {overnight && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: C.brand,
                                        marginTop: 6,
                                        fontFamily: FM,
                                    }}
                                >
                                    OVERNIGHT — OUT LANDS THE NEXT MORNING
                                </div>
                            )}
                            <div
                                style={{
                                    fontSize: 10.5,
                                    color: C.lo,
                                    marginTop: 6,
                                }}
                            >
                                Half hours only — a time ticket never reads
                                10:17.
                            </div>
                        </div>
                    )}

                    {/* what the rules make of it */}
                    <div
                        style={{
                            marginTop: 10,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "10px 11px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <div>
                                <SplitChips sp={sp} />
                                {sp.guarantee > 0 && (
                                    <div
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 9.5,
                                            fontWeight: 800,
                                            color: C.brand,
                                            marginTop: 4,
                                        }}
                                    >
                                        HOLIDAY FLOOR —{" "}
                                        {hrsFmt(r1(sp.guarantee))}H OT ADDED
                                    </div>
                                )}
                            </div>
                            <div
                                style={{
                                    marginLeft: "auto",
                                    textAlign: "right",
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 15,
                                        fontWeight: 800,
                                        color: clock ? C.hi : C.lo,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {hrsFmt(r1(clock))} hrs
                                </div>
                                <div
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 11,
                                        color: C.working,
                                        fontWeight: 800,
                                        marginTop: 1,
                                    }}
                                >
                                    ~${(paid * rt.rate).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: C.lo,
                                marginTop: 7,
                                lineHeight: 1.45,
                            }}
                        >
                            {co ? (
                                <span>
                                    {co} pays{" "}
                                    <span
                                        style={{
                                            fontFamily: FM,
                                            fontWeight: 800,
                                            color: rt.over ? C.brand : C.hi,
                                        }}
                                    >
                                        {money(rt.rate)}
                                    </span>
                                    {rt.over
                                        ? " — the " +
                                          rt.level +
                                          " rate, above your scale."
                                        : " — your " +
                                          rt.level +
                                          " scale."}{" "}
                                    {hrsFmt(r1(paid))} weighted hrs.
                                </span>
                            ) : (
                                "Pick a company — the rate follows who you worked for."
                            )}
                            {mode === "hrs" &&
                                " Untimed hours are read as an 8:00 start."}
                        </div>
                    </div>

                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            margin: "14px 0 6px",
                        }}
                    >
                        OJT CATEGORY{" "}
                        <span
                            style={{ color: touched && !cat ? C.danger : C.lo }}
                        >
                            *
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {CATS.map((k) => {
                            const meta = CATS_META[k];
                            const on = cat === k;
                            return (
                                <button
                                    key={k}
                                    className="foc"
                                    onClick={() => setCat(k)}
                                    style={{
                                        flex: 1,
                                        padding: "11px 0",
                                        borderRadius: 8,
                                        fontFamily: FM,
                                        fontSize: 14,
                                        fontWeight: 800,
                                        background: on
                                            ? meta.color
                                            : "transparent",
                                        color: on ? "#0D0F13" : C.lo,
                                        border:
                                            "1px solid " +
                                            (on
                                                ? meta.color
                                                : touched && !cat
                                                  ? C.danger
                                                  : C.line),
                                    }}
                                >
                                    {k}
                                </button>
                            );
                        })}
                    </div>
                    {cat && (
                        <div
                            className="truncate"
                            style={{
                                fontSize: 11,
                                color: CATS_META[cat].color,
                                marginTop: 5,
                            }}
                        >
                            {CATS_META[cat].name}
                        </div>
                    )}

                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            margin: "14px 0 6px",
                        }}
                    >
                        NOTE — SHOW NAME
                    </div>
                    <input
                        className="foc"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. COMIC CON"
                        style={{
                            width: "100%",
                            background: C.sunk,
                            color: C.hi,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "11px",
                            fontSize: 13.5,
                            fontFamily: FS,
                        }}
                    />
                    <div
                        style={{
                            fontSize: 10.5,
                            color: C.lo,
                            marginTop: 6,
                            lineHeight: 1.45,
                        }}
                    >
                        This is the SHOW NAME column on the OJT slip. Two shops
                        in one day? Save this one, then add a second entry —
                        Eagle 8:00–12:00, Freeman 12:30 on. They land as two
                        rows on the same date, the way the office wants them.
                    </div>

                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            margin: "14px 0 6px",
                        }}
                    >
                        TRAVEL PAY — OPTIONAL
                    </div>
                    <input
                        className="foc"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={travel}
                        onChange={(e) => setTravel(e.target.value)}
                        placeholder="e.g. 20.00"
                        style={{
                            width: "100%",
                            background: C.sunk,
                            color: C.hi,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "11px",
                            fontSize: 13.5,
                            fontFamily: FS,
                        }}
                    />
                    <div
                        style={{
                            fontSize: 10.5,
                            color: C.lo,
                            marginTop: 6,
                            lineHeight: 1.45,
                        }}
                    >
                        A flat stipend, not part of your ST/OT/DT hours — whatever
                        shows up as its own line on your check. Adds straight to
                        gross below.
                    </div>

                    {touched && !ok && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                marginTop: 12,
                                background: "rgba(232,146,124,0.1)",
                                border: "1px solid " + C.danger + "55",
                                borderRadius: 9,
                                padding: "9px 11px",
                            }}
                        >
                            <Ban
                                size={13}
                                color={C.danger}
                                style={{ flexShrink: 0 }}
                            />
                            <span style={{ fontSize: 12, color: C.mid }}>
                                Still need a {missing.join(" and a ")} before
                                this saves.
                            </span>
                        </div>
                    )}

                    {justSaved && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                marginTop: 14,
                                padding: "9px 12px",
                                borderRadius: 9,
                                background: "rgba(47,176,122,0.12)",
                                border: "1px solid rgba(47,176,122,0.4)",
                                color: C.working,
                                fontSize: 12.5,
                                fontWeight: 700,
                            }}
                        >
                            <Check size={14} style={{ flexShrink: 0 }} />
                            Saved — {justSaved}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        {editId && (
                            <button
                                className="foc"
                                onClick={reset}
                                style={{
                                    flex: 1,
                                    padding: "13px",
                                    borderRadius: 10,
                                    background: C.raise,
                                    color: C.hi,
                                    border: "1px solid " + C.line,
                                    fontWeight: 700,
                                    fontSize: 14,
                                }}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            className="foc"
                            onClick={commit}
                            style={{
                                flex: 2,
                                padding: "13px",
                                borderRadius: 10,
                                background: ok ? C.working : C.raise,
                                color: ok ? C.inkGood : C.lo,
                                border:
                                    "1px solid " + (ok ? C.working : C.line),
                                fontWeight: 800,
                                fontSize: 14,
                            }}
                        >
                            {editId
                                ? "Save changes"
                                : "Log " + hrsFmt(r1(clock)) + " hrs"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
