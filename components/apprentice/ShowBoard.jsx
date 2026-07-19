"use client";

import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { Modal } from "@/components/ui/Modal";
import { Stat } from "@/components/ui/Stat";
import { hexRgb } from "@/components/utils/hexRgb";
import { r1 } from "@/components/utils/r1";
import { SplitChips } from "@/components/ui/SplitChips";
// Home is the default tab everyone sees first — imported normally (not
// dynamic()) since lazy-loading the thing everyone needs immediately would
// only add a loading flicker, not a real payload saving.
import { HomeTab } from "@/components/apprentice/tabs/HomeTab";

// loaded only when the OJT tab is actually opened — it's the single largest
// tab (rules reference, curriculum, pay-scale panels), no reason a Home-tab
// visit should pay to parse it. No SSR needed either: this only ever
// renders after the client-side store.load() finishes, same as every other
// tab here.
const OjtTab = dynamic(() => import("@/components/apprentice/tabs/OjtTab").then((m) => m.OjtTab), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});

// same treatment for Calendar — Summary is its own dynamic() pointed at the
// same module (rather than a plain import) so opening "month summary" from
// the shell's modal dispatch doesn't pull CalTab's code back into the main
// bundle just because something outside the lazy boundary references it.
const CalTab = dynamic(() => import("@/components/apprentice/tabs/CalTab").then((m) => m.CalTab), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});
const Summary = dynamic(() => import("@/components/apprentice/tabs/CalTab").then((m) => m.Summary), { ssr: false });

// Board is the last tab to get this treatment — unlike the other three it
// wasn't a standalone component to begin with, so this took real
// restructuring (see components/apprentice/tabs/BoardTab.jsx's own header
// comment for why its filter/search state stays owned here and gets passed
// down as controlled props, rather than moving into the tab itself).
const BoardTab = dynamic(() => import("@/components/apprentice/tabs/BoardTab").then((m) => m.BoardTab), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
    Phone,
    Plus,
    Search,
    Star,
    X,
    Trash2,
    Pencil,
    MapPin,
    Hammer,
    Target,
    Ban,
    Upload,
    Check,
    HardHat,
    Building2,
    CalendarDays,
    ChevronRight,
    ChevronLeft,
    Clock,
    LayoutList,
    Copy,
    Minus,
    GraduationCap,
    LayoutDashboard,
    Eye,
    EyeOff,
    Lock,
    ShieldAlert,
    Bell,
    CloudOff,
    TriangleAlert,
} from "lucide-react";
import { store, subscribeSyncStatus } from "@/lib/store";
import {
    BOOKED,
    BREAK_SLOTS,
    C,
    CATS_META,
    CAT_TOTAL,
    DEFAULT_PINS,
    DOW,
    FM,
    FS,
    JATC,
    JULY_NOTES,
    KLASS,
    L2_PACKAGE,
    LEVELS,
    MONTHS,
    MON_FULL,
    OJT_DEFAULT,
    PAY,
    PAY_COLOR,
    REGION,
    REGION_KEYS,
    RSI_REQUIRED,
    SEED,
    SHADOW,
    STATUS,
    TIME_SLOTS,
    UNION_LINE,
    UNION_LINE_PRETTY,
    YEAR,
    bookingOn,
    certState,
    classOn,
    coColor,
    countdown,
    daysUntil,
    detectRegion,
    entrySplit,
    fmtClock,
    fmtTel,
    fromKey,
    holidayName,
    hrsFmt,
    isMine,
    isPast,
    keyOf,
    labelFromKey,
    levelIndex,
    longDate,
    mAdd,
    mKey,
    mLong,
    mMed,
    mParse,
    mShort,
    mapsUrl,
    matchCo,
    mergeSeed,
    mkDate,
    monthGrid,
    monthKey,
    monthKeyNow,
    monthTotal,
    nextDates,
    num,
    ojtDue,
    ojtRows,
    ojtState,
    ojtTotals,
    paidHours,
    projectMonth,
    rangePay,
    rateFor,
    rollupEntries,
    sameDay,
    showSpan,
    showsOn,
    showYear,
    sortDate,
    splitHours,
    statusOn,
    todayMid,
} from "@/lib/core";
import { OjtImportFlow } from "@/components/ojt/OjtImportFlow";
import { WelcomeModal } from "@/components/apprentice/WelcomeModal";
import { ClassCurriculum } from "@/components/ojt/ClassCurriculum";
import { JatcRulesModal } from "@/components/ojt/JatcRulesModal";

// same build-time flag app/pending/page.jsx checks — kept in sync so both
// "upload OJT slips" entry points turn on/off together.
const OJT_IMPORT_ENABLED = process.env.NEXT_PUBLIC_OJT_IMPORT_ENABLED === "true";

/* the labor/I&D directory and JATC office contacts — real third-party names
   and phone numbers, so they live in Supabase (lib/store.js), not committed
   here. Context instead of prop-drilling: they're needed several layers
   deep (DaySheet -> CoPicker, OjtExport, ...) and change once per app load.
   Lives in its own module (components/DirectoryContext.js) so the split-out
   tab files can import the same instance without a circular import. */


/* ---------- modal shell ---------- */

function ConfirmModal({ title, message, confirmLabel = "Delete", onConfirm, onClose }) {
    return (
        <Modal title={title} onClose={onClose}>
            <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.5, marginBottom: 18 }}>
                {message}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    className="foc"
                    onClick={onClose}
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontWeight: 700, fontSize: 14 }}
                >
                    Cancel
                </button>
                <button
                    className="foc"
                    onClick={onConfirm}
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: C.danger, color: "#2A0E0A", border: "none", fontWeight: 800, fontSize: 14 }}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

/* ---------- companies directory ---------- */
function DirList({ pins, onTogglePin, customCos }) {
    const { companies } = useContext(DirectoryContext);
    const [q, setQ] = useState("");
    const all = useMemo(
        () =>
            (companies || []).concat(
                (customCos || []).map((n) => ({
                    n,
                    city: "",
                    st: "",
                    tel: "",
                    fm: "",
                    custom: true,
                })),
            ),
        [customCos, companies],
    );
    const norm = q.trim().toLowerCase();
    const match = (c) =>
        !norm ||
        (c.n + " " + c.city + " " + (c.fm || ""))
            .toLowerCase()
            .indexOf(norm) !== -1;
    const pinned = all.filter((c) => pins.includes(c.n) && match(c));
    const rest = all.filter((c) => !pins.includes(c.n) && match(c));
    const Row = (c) => {
        const on = pins.includes(c.n);
        return (
            <div
                key={c.n}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 9,
                    padding: "9px 10px",
                }}
            >
                <button
                    className="foc"
                    onClick={() => onTogglePin(c.n)}
                    style={{
                        flexShrink: 0,
                        background: "transparent",
                        border: "none",
                        padding: 2,
                        color: on ? C.brand : C.lo,
                    }}
                    aria-label={on ? "Unpin" : "Pin"}
                >
                    <Star
                        size={16}
                        fill={on ? C.brand : "none"}
                        color={on ? C.brand : C.lo}
                    />
                </button>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        className="truncate"
                        style={{ fontWeight: 700, fontSize: 13, color: C.hi }}
                    >
                        {c.n}
                    </div>
                    <div
                        className="truncate"
                        style={{ fontSize: 11, color: C.mid, marginTop: 1 }}
                    >
                        {c.custom
                            ? "added by you"
                            : [c.fm, c.city + (c.st ? ", " + c.st : "")]
                                  .filter(Boolean)
                                  .join(" · ")}
                    </div>
                </div>
                {c.tel ? (
                    <a
                        className="foc"
                        href={"tel:" + c.tel}
                        style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: "rgba(47,176,122,0.14)",
                            color: C.working,
                            textDecoration: "none",
                            padding: "7px 9px",
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 11.5,
                            border: "1px solid rgba(47,176,122,0.3)",
                        }}
                    >
                        <Phone size={12} />
                        {fmtTel(c.tel)}
                    </a>
                ) : (
                    <span
                        style={{
                            flexShrink: 0,
                            fontSize: 10.5,
                            color: C.lo,
                            fontFamily: FM,
                        }}
                    >
                        no line
                    </span>
                )}
            </div>
        );
    };
    return (
        <div>
            <div
                style={{
                    color: C.mid,
                    fontSize: 12,
                    lineHeight: 1.5,
                    marginBottom: 10,
                }}
            >
                The{" "}
                <span style={{ color: C.gc, fontWeight: 700 }}>
                    general contractor
                </span>{" "}
                is the company listed on each show. These I&amp;D / labor houses
                also staff most shows — call around for calls. Tap{" "}
                <Star
                    size={11}
                    fill={C.brand}
                    color={C.brand}
                    style={{ verticalAlign: "middle" }}
                />{" "}
                to pin your go-tos.
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 10,
                    padding: "0 10px",
                    marginBottom: 12,
                }}
            >
                <Search size={15} color={C.lo} />
                <input
                    className="foc"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search company, foreman, city"
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
                {q && (
                    <button
                        className="foc"
                        onClick={() => setQ("")}
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

            {pinned.length > 0 && (
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.6,
                        color: C.brand,
                        fontFamily: FM,
                        marginBottom: 6,
                    }}
                >
                    PINNED
                </div>
            )}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: pinned.length ? 14 : 0,
                }}
            >
                {pinned.map(Row)}
            </div>

            <div
                style={{
                    fontSize: 10,
                    letterSpacing: 0.6,
                    color: C.lo,
                    fontFamily: FM,
                    marginBottom: 6,
                }}
            >
                {norm ? "RESULTS" : "ALL COMPANIES"} · {rest.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rest.map(Row)}
            </div>
            {pinned.length === 0 && rest.length === 0 && (
                <div
                    style={{ color: C.mid, fontSize: 13, padding: "10px 2px" }}
                >
                    No companies match “{q}”.
                </div>
            )}

            <div
                style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid " + C.line,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                }}
            >
                {[
                    ["Available for work (LA & SD)", "6262968075"],
                    ["Union hall office", "6262968086"],
                    ["Central dues", "6262968054"],
                ].map(([lab, tel]) => (
                    <a
                        key={tel}
                        className="foc"
                        href={"tel:" + tel}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                            color: C.mid,
                            fontSize: 12.5,
                            padding: "4px 2px",
                        }}
                    >
                        <Phone size={13} color={C.lo} />
                        <span style={{ flex: 1 }}>{lab}</span>
                        <span style={{ fontFamily: FM, color: C.hi }}>
                            {fmtTel(tel)}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}

/* ---------- company picker (used when logging hours) ---------- */
function CoPicker({ value, pins, customCos, onPick, onAddCo, onClose }) {
    const { companies } = useContext(DirectoryContext);
    const [q, setQ] = useState("");
    const names = useMemo(
        () => (companies || []).map((c) => c.n).concat(customCos || []),
        [customCos, companies],
    );
    const norm = q.trim();
    const low = norm.toLowerCase();
    const hit = (n) => !low || n.toLowerCase().indexOf(low) !== -1;
    const pinned = names.filter((n) => pins.includes(n) && hit(n));
    const rest = names.filter((n) => !pins.includes(n) && hit(n));
    const exact = names.some((n) => n.toLowerCase() === low);
    const Row = (n) => (
        <button
            key={n}
            className="foc"
            onClick={() => onPick(n)}
            style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 9,
                background: value === n ? C.raise : C.sunk,
                border: "1px solid " + (value === n ? C.brand + "88" : C.line),
                borderRadius: 9,
                padding: "10px 11px",
            }}
        >
            <span
                style={{
                    width: 9,
                    height: 9,
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
                    fontSize: 13.5,
                    fontWeight: 650,
                    color: C.hi,
                }}
            >
                {n}
            </span>
            {pins.includes(n) && (
                <Star size={12} fill={C.brand} color={C.brand} />
            )}
            {value === n && <Check size={15} color={C.brand} />}
        </button>
    );
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 10,
                    padding: "0 10px",
                    marginBottom: 10,
                }}
            >
                <Search size={15} color={C.lo} />
                <input
                    className="foc"
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search or type a new company"
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: C.hi,
                        padding: "11px 0",
                        fontSize: 13.5,
                        fontFamily: FS,
                    }}
                />
                {q && (
                    <button
                        className="foc"
                        onClick={() => setQ("")}
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

            {norm && !exact && (
                <button
                    className="foc"
                    onClick={() => {
                        onAddCo(norm);
                        onPick(norm);
                    }}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        background: "rgba(255,176,32,0.12)",
                        color: C.brand,
                        border: "1px dashed rgba(255,176,32,0.5)",
                        borderRadius: 9,
                        padding: "11px",
                        fontWeight: 800,
                        fontSize: 13,
                        marginBottom: 10,
                    }}
                >
                    <Plus size={15} />
                    Add “{norm}” as a company
                </button>
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: "52vh",
                    overflowY: "auto",
                }}
            >
                {pinned.length > 0 && (
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.brand,
                            fontFamily: FM,
                            margin: "2px 0 2px",
                        }}
                    >
                        PINNED
                    </div>
                )}
                {pinned.map(Row)}
                {rest.length > 0 && (
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            margin: "8px 0 2px",
                        }}
                    >
                        ALL COMPANIES · {rest.length}
                    </div>
                )}
                {rest.map(Row)}
            </div>
            <button
                className="foc"
                onClick={onClose}
                style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "11px",
                    borderRadius: 10,
                    background: C.raise,
                    color: C.hi,
                    border: "1px solid " + C.line,
                    fontWeight: 700,
                    fontSize: 13.5,
                }}
            >
                Done
            </button>
        </div>
    );
}

/* ---------- day sheet: log hours ---------- */
const CATS = ["A", "B", "C", "D"];
const HOUR_CHIPS = [4, 6, 8, 10, 12];

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

function DaySheet({
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
                                                    ? "#1A1206"
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
                                color: ok ? "#06120C" : C.lo,
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

/* ---------- schedule days you've been asked to work ---------- */
function BookingForm({
    initial,
    shows,
    pins,
    customCos,
    onAddCo,
    onSave,
    onDelete,
    onClose,
    span,
    fresh,
}) {
    const t0 = todayMid();
    const [co, setCo] = useState(initial ? initial.co : "");
    const [show, setShow] = useState(initial ? initial.show || "" : "");
    const [note, setNote] = useState(initial ? initial.note || "" : "");
    const [dates, setDates] = useState(
        initial ? (initial.dates || []).slice() : [],
    );
    const [picking, setPicking] = useState(false);
    const [touched, setTouched] = useState(false);
    const anchor = dates.length
        ? dates.slice().sort()[0]
        : span && span.length
          ? span[0]
          : null;
    const first = anchor ? fromKey(anchor) : t0;
    const [cur, setCur] = useState({
        y: first.getFullYear(),
        m: first.getMonth(),
    });

    const cells = monthGrid(cur.y, cur.m);
    const inSpan = (k) => !!(span && span.indexOf(k) !== -1);
    const step = (n) =>
        setCur((p) => {
            const d = new Date(p.y, p.m + n, 1);
            return { y: d.getFullYear(), m: d.getMonth() };
        });
    const toggle = (k) =>
        setDates((p) =>
            p.indexOf(k) !== -1 ? p.filter((x) => x !== k) : [...p, k].sort(),
        );
    const missing = [];
    if (!co) missing.push("company");
    if (!dates.length) missing.push("day");
    const ok = missing.length === 0;

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

    const upcoming = shows
        .filter((x) => !isPast(x))
        .sort((a, b) => sortDate(a) - sortDate(b));

    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: C.lo,
                    fontFamily: FM,
                    marginBottom: 6,
                }}
            >
                WHO ARE YOU WORKING FOR{" "}
                <span style={{ color: touched && !co ? C.danger : C.lo }}>
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
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 6,
                    lineHeight: 1.45,
                }}
            >
                Who signs your ticket — not the general on the floor. Comic-Con
                is a Freeman show, but if Eagle called you, put Eagle.
            </div>

            <div
                style={{
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: C.lo,
                    fontFamily: FM,
                    margin: "14px 0 6px",
                }}
            >
                WHICH SHOW — OPTIONAL
            </div>
            <select
                className="foc"
                value={show}
                onChange={(e) => setShow(e.target.value)}
                style={{
                    width: "100%",
                    background: C.sunk,
                    color: show ? C.hi : C.lo,
                    border: "1px solid " + C.line,
                    borderRadius: 9,
                    padding: "11px 9px",
                    fontSize: 14,
                    fontFamily: FS,
                }}
            >
                <option value="">— none —</option>
                {upcoming.map((x) => (
                    <option key={x.id} value={x.name}>
                        {x.name} · {x.loc}
                    </option>
                ))}
            </select>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    margin: "16px 0 8px",
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.5,
                        color: C.lo,
                        fontFamily: FM,
                    }}
                >
                    WHICH DAYS{" "}
                    <span
                        style={{
                            color: touched && !dates.length ? C.danger : C.lo,
                        }}
                    >
                        *
                    </span>
                </div>
                <div
                    style={{
                        marginLeft: "auto",
                        fontFamily: FM,
                        fontSize: 11,
                        fontWeight: 800,
                        color: dates.length ? BOOKED : C.lo,
                    }}
                >
                    {dates.length} SELECTED
                </div>
            </div>

            <div
                style={{
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 11,
                    padding: 10,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <button
                        className="foc"
                        onClick={() => step(-1)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: C.raise,
                            border: "1px solid " + C.line,
                            color: C.hi,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <div
                        style={{
                            flex: 1,
                            textAlign: "center",
                            fontFamily: FM,
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: 1.5,
                            color: C.hi,
                        }}
                    >
                        {MONTHS[cur.m]} {cur.y}
                    </div>
                    <button
                        className="foc"
                        onClick={() => step(1)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: C.raise,
                            border: "1px solid " + C.line,
                            color: C.hi,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 4,
                        marginBottom: 5,
                    }}
                >
                    {DOW.map((d, i) => (
                        <div
                            key={i}
                            style={{
                                textAlign: "center",
                                fontSize: 9.5,
                                fontFamily: FM,
                                fontWeight: 700,
                                color: C.lo,
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
                        gap: 4,
                    }}
                >
                    {cells.map((d, i) => {
                        const inMonth = d.getMonth() === cur.m;
                        const k = keyOf(d);
                        const on = dates.indexOf(k) !== -1;
                        const run = inSpan(k);
                        const today = sameDay(d, t0);
                        return (
                            <button
                                key={i}
                                className="foc"
                                onClick={() => toggle(k)}
                                style={{
                                    height: 38,
                                    borderRadius: 8,
                                    fontFamily: FM,
                                    fontSize: 12.5,
                                    fontWeight: on ? 800 : 600,
                                    background: on
                                        ? BOOKED
                                        : run
                                          ? "rgba(127,178,255,0.12)"
                                          : inMonth
                                            ? C.panel
                                            : "transparent",
                                    color: on
                                        ? "#14101F"
                                        : today
                                          ? C.brand
                                          : run
                                            ? C.gc
                                            : inMonth
                                              ? C.mid
                                              : C.lo,
                                    border:
                                        "1px solid " +
                                        (on
                                            ? BOOKED
                                            : run
                                              ? "rgba(127,178,255,0.45)"
                                              : today
                                                ? C.brand
                                                : inMonth
                                                  ? C.line
                                                  : "transparent"),
                                    opacity: inMonth ? 1 : 0.3,
                                }}
                            >
                                {d.getDate()}
                            </button>
                        );
                    })}
                </div>
                {span && span.length > 0 && (
                    <div
                        style={{
                            fontSize: 10.5,
                            color: C.gc,
                            marginTop: 8,
                            lineHeight: 1.4,
                        }}
                    >
                        Blue days are the show's run — move-in through teardown.
                    </div>
                )}
            </div>

            <div
                style={{
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: C.lo,
                    fontFamily: FM,
                    margin: "14px 0 6px",
                }}
            >
                NOTE — OPTIONAL
            </div>
            <input
                className="foc"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="call time, gate, foreman…"
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
                    <Ban size={13} color={C.danger} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.mid }}>
                        Pick a {missing.join(" and at least one ")}.
                    </span>
                </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {initial && !fresh ? (
                    <button
                        className="foc"
                        onClick={onDelete}
                        style={{
                            flexShrink: 0,
                            padding: "13px 14px",
                            borderRadius: 10,
                            background: "transparent",
                            color: C.danger,
                            border: "1px solid " + C.line,
                        }}
                    >
                        <Trash2 size={14} />
                    </button>
                ) : (
                    <button
                        className="foc"
                        onClick={onClose}
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
                    onClick={() => {
                        setTouched(true);
                        if (ok)
                            onSave({
                                id: initial
                                    ? initial.id
                                    : "bk" + Date.now().toString(36),
                                co,
                                show,
                                note: note.trim(),
                                dates,
                            });
                    }}
                    style={{
                        flex: 2,
                        padding: "13px",
                        borderRadius: 10,
                        background: ok ? BOOKED : C.raise,
                        color: ok ? "#14101F" : C.lo,
                        border: "1px solid " + (ok ? BOOKED : C.line),
                        fontWeight: 800,
                        fontSize: 14,
                    }}
                >
                    {initial && !fresh
                        ? "Save schedule"
                        : "Schedule " +
                          (dates.length || "") +
                          " day" +
                          (dates.length === 1 ? "" : "s")}
                </button>
            </div>
        </div>
    );
}

/* ---------- OJT: shared bits ---------- */
function money(n) {
    return "$" + num(n).toFixed(2);
}


/* ---------- OJT: add / edit a submitted month ---------- */
function MonthForm({ initial, roll, existing, onSave, onDelete, onClose }) {
    const t0 = todayMid();
    const start = initial
        ? mParse(initial.m)
        : { y: t0.getFullYear(), m: t0.getMonth() };
    const [y, setY] = useState(start.y);
    const [m, setM] = useState(start.m);
    const [f, setF] = useState({
        a: initial ? String(initial.a ?? "") : "",
        b: initial ? String(initial.b ?? "") : "",
        c: initial ? String(initial.c ?? "") : "",
        d: initial ? String(initial.d ?? "") : "",
    });
    const key = mKey(y, m);
    const app = roll[key];
    const total = num(f.a) + num(f.b) + num(f.c) + num(f.d);
    const dupe = !initial && existing.some((x) => x.m === key);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const set = (k, v) =>
        setF((p) => ({ ...p, [k]: v.replace(/[^0-9.]/g, "") }));
    const fill = () =>
        setF({
            a: app.a ? String(app.a) : "",
            b: app.b ? String(app.b) : "",
            c: app.c ? String(app.c) : "",
            d: app.d ? String(app.d) : "",
        });

    const Num = ({ k }) => {
        const meta = CATS_META[k.toUpperCase()];
        return (
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 4,
                    }}
                >
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 3,
                            background: meta.color,
                            flexShrink: 0,
                        }}
                    />
                    <span
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.5,
                            color: C.lo,
                            fontFamily: FM,
                        }}
                    >
                        CAT {k.toUpperCase()}
                    </span>
                </div>
                <input
                    className="foc"
                    value={f[k]}
                    onChange={(e) => set(k, e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    style={{
                        width: "100%",
                        background: C.sunk,
                        color: C.hi,
                        border:
                            "1px solid " +
                            (num(f[k]) ? meta.color + "66" : C.line),
                        borderRadius: 8,
                        padding: "10px 8px",
                        fontSize: 15,
                        fontFamily: FM,
                        fontWeight: 700,
                        textAlign: "center",
                    }}
                />
            </div>
        );
    };

    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: C.lo,
                    fontFamily: FM,
                    marginBottom: 4,
                }}
            >
                MONTH
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <select
                    className="foc"
                    value={m}
                    onChange={(e) => setM(Number(e.target.value))}
                    disabled={!!initial}
                    style={{
                        flex: 2,
                        background: C.sunk,
                        color: initial ? C.mid : C.hi,
                        border: "1px solid " + C.line,
                        borderRadius: 8,
                        padding: "10px 8px",
                        fontSize: 14,
                        fontFamily: FS,
                    }}
                >
                    {MON_FULL.map((n, i) => (
                        <option key={i} value={i}>
                            {n}
                        </option>
                    ))}
                </select>
                <select
                    className="foc"
                    value={y}
                    onChange={(e) => setY(Number(e.target.value))}
                    disabled={!!initial}
                    style={{
                        flex: 1,
                        background: C.sunk,
                        color: initial ? C.mid : C.hi,
                        border: "1px solid " + C.line,
                        borderRadius: 8,
                        padding: "10px 8px",
                        fontSize: 14,
                        fontFamily: FS,
                    }}
                >
                    {[2025, 2026, 2027, 2028, 2029, 2030].map((v) => (
                        <option key={v} value={v}>
                            {v}
                        </option>
                    ))}
                </select>
            </div>
            {dupe && (
                <div style={{ fontSize: 11.5, color: C.brand, marginTop: 6 }}>
                    {mMed(key)} is already on file — saving will replace it.
                </div>
            )}

            {app && (
                <div
                    style={{
                        marginTop: 12,
                        background: "rgba(127,178,255,0.08)",
                        border: "1px solid rgba(127,178,255,0.3)",
                        borderRadius: 9,
                        padding: "10px 11px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <CalendarDays
                            size={13}
                            color={C.gc}
                            style={{ flexShrink: 0 }}
                        />
                        <span
                            style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: C.gc,
                            }}
                        >
                            Calendar logged {hrsFmt(app.total)} hrs over{" "}
                            {app.days} day{app.days === 1 ? "" : "s"}
                        </span>
                    </div>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 11,
                            color: C.mid,
                            marginTop: 5,
                        }}
                    >
                        A {hrsFmt(app.a)} · B {hrsFmt(app.b)} · C{" "}
                        {hrsFmt(app.c)} · D {hrsFmt(app.d)}
                        {app.uncat > 0 && (
                            <span style={{ color: C.brand }}>
                                {" "}
                                · {hrsFmt(app.uncat)} no category
                            </span>
                        )}
                    </div>
                    <button
                        className="foc"
                        onClick={fill}
                        style={{
                            width: "100%",
                            marginTop: 9,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            background: C.raise,
                            color: C.hi,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: "9px",
                            fontWeight: 700,
                            fontSize: 12.5,
                        }}
                    >
                        <Copy size={13} />
                        Fill from calendar
                    </button>
                    {app.uncat > 0 && (
                        <div
                            style={{
                                fontSize: 10.5,
                                color: C.lo,
                                marginTop: 7,
                                lineHeight: 1.45,
                            }}
                        >
                            {hrsFmt(app.uncat)} hrs have no A/B/C/D tag, so they
                            won't fill in. Set the category on those calendar
                            entries if they belong on the form.
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                {["a", "b", "c", "d"].map((k) => (
                    <Num key={k} k={k} />
                ))}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: 12,
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 9,
                    padding: "15px 16px",
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        letterSpacing: 0.5,
                        color: C.lo,
                        fontFamily: FM,
                    }}
                >
                    MONTH TOTAL
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        fontFamily: FM,
                        fontSize: 20,
                        fontWeight: 800,
                        color: total ? C.hi : C.lo,
                    }}
                >
                    {hrsFmt(total)}
                </span>
                {app && total > 0 && app.total !== total && (
                    <span
                        style={{
                            marginLeft: 8,
                            fontFamily: FM,
                            fontSize: 10,
                            fontWeight: 800,
                            color: C.gc,
                        }}
                    >
                        APP {hrsFmt(app.total)}
                    </span>
                )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {initial ? (
                    <button
                        className="foc"
                        onClick={() => setConfirmDelete(true)}
                        style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "13px 14px",
                            borderRadius: 10,
                            background: "transparent",
                            color: C.danger,
                            border: "1px solid " + C.line,
                            fontWeight: 700,
                            fontSize: 13.5,
                        }}
                    >
                        <Trash2 size={14} />
                    </button>
                ) : (
                    <button
                        className="foc"
                        onClick={onClose}
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
                    onClick={() =>
                        onSave({
                            m: key,
                            a: num(f.a),
                            b: num(f.b),
                            c: num(f.c),
                            d: num(f.d),
                        })
                    }
                    style={{
                        flex: 2,
                        padding: "13px",
                        borderRadius: 10,
                        background: C.brand,
                        color: "#1A1206",
                        border: "none",
                        fontWeight: 800,
                        fontSize: 14,
                    }}
                >
                    {initial ? "Save month" : "Add " + mMed(key)}
                </button>
            </div>
            {confirmDelete && (
                <ConfirmModal
                    title="Delete this month?"
                    message={
                        <>
                            This removes {mMed(key)} — {hrsFmt(total)} hrs — from
                            what's submitted to the union.{" "}
                            <strong style={{ color: C.hi }}>
                                This can't be undone.
                            </strong>
                        </>
                    }
                    confirmLabel="Delete month"
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={onDelete}
                />
            )}
        </div>
    );
}

/* ---------- OJT form as a real PDF ----------
   no library — a one-page PDF is just text, lines and an xref table.
   this reproduces the JATC master form so the only thing left is a signature. */
function pdfEsc(v) {
    return String(v == null ? "" : v)
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}
/* Helvetica is close enough to these ratios for a form */
function textW(v, size, bold) {
    const s = String(v == null ? "" : v);
    return s.length * size * (bold ? 0.55 : 0.5);
}

function buildOjtPdf(opt) {
    const W = 612,
        H = 792;
    const L = 32,
        R = W - 32;
    const ops = [];
    const num = (v) => (Math.round(v * 100) / 100).toFixed(2);
    const txt = (x, y, v, size, bold) =>
        ops.push(
            "BT /" +
                (bold ? "F2" : "F1") +
                " " +
                size +
                " Tf 1 0 0 1 " +
                num(x) +
                " " +
                num(y) +
                " Tm (" +
                pdfEsc(v) +
                ") Tj ET",
        );
    const ctr = (cx, y, v, size, bold) =>
        txt(cx - textW(v, size, bold) / 2, y, v, size, bold);
    const rgt = (rx, y, v, size, bold) =>
        txt(rx - textW(v, size, bold), y, v, size, bold);
    const line = (x1, y1, x2, y2, w) =>
        ops.push(
            num(w || 0.7) +
                " w " +
                num(x1) +
                " " +
                num(y1) +
                " m " +
                num(x2) +
                " " +
                num(y2) +
                " l S",
        );
    const box = (x, y, w, h, lw) =>
        ops.push(
            num(lw || 0.7) +
                " w " +
                num(x) +
                " " +
                num(y) +
                " " +
                num(w) +
                " " +
                num(h) +
                " re S",
        );

    /* ---- title ---- */
    let y = H - 44;
    ctr(
        W / 2,
        y,
        "CA TRADESHOW & SIGN CRAFTS APPRENTICE ON-THE-JOB-TRAINING FORM",
        10.5,
        true,
    );

    /* ---- month / year ---- */
    y -= 26;
    box(L, y - 4, 150, 18);
    box(L + 158, y - 4, 110, 18);
    txt(L + 5, y + 2, "MONTH", 7.5, true);
    txt(L + 50, y + 2, String(opt.monthName).toUpperCase(), 10, true);
    txt(L + 163, y + 2, "YEAR", 7.5, true);
    txt(L + 200, y + 2, String(opt.year), 10, true);

    /* ---- table ---- */
    const cols = [
        { k: "date", label: "DATE", x: L, w: 40 },
        { k: "a", label: "A", x: L + 40, w: 30 },
        { k: "b", label: "B", x: L + 70, w: 30 },
        { k: "c", label: "C", x: L + 100, w: 30 },
        { k: "d", label: "D", x: L + 130, w: 30 },
        { k: "co", label: "COMPANY NAME", x: L + 160, w: 190 },
        { k: "show", label: "SHOW NAME", x: L + 350, w: R - (L + 350) },
    ];
    const tableTop = y - 16;
    const headH = 15;
    const rowH = 15.2;
    const nRows = 31;
    const tableBot = tableTop - headH - nRows * rowH;

    /* header */
    box(L, tableTop - headH, R - L, headH);
    cols.forEach((c) =>
        ctr(c.x + c.w / 2, tableTop - headH + 4.5, c.label, 7.5, true),
    );

    /* rows */
    for (let i = 1; i <= nRows; i++) {
        const top = tableTop - headH - (i - 1) * rowH;
        const bot = top - rowH;
        box(L, bot, R - L, rowH);
        const list = (opt.byDate[i] || []).slice(0, 2);
        if (list.length <= 1) {
            const e = list[0];
            ctr(L + 20, bot + 4.8, String(i), 8, !!e);
            if (e) {
                ["a", "b", "c", "d"].forEach((k, j) => {
                    if (e[k])
                        ctr(
                            cols[j + 1].x + 15,
                            bot + 4.8,
                            hrsFmt(e[k]),
                            8,
                            true,
                        );
                });
                txt(cols[5].x + 4, bot + 4.8, e.co, 7.5);
                txt(cols[6].x + 4, bot + 4.8, e.show, 7.5);
            }
        } else {
            /* two companies in one day — the union wants them split out, not merged */
            ctr(L + 20, bot + rowH / 2 - 2.6, String(i), 8, true);
            line(L + 40, bot + rowH / 2, R, bot + rowH / 2, 0.4);
            list.forEach((e, r) => {
                const yy = r === 0 ? bot + rowH / 2 + 2.4 : bot + 2.4;
                ["a", "b", "c", "d"].forEach((k, j) => {
                    if (e[k])
                        ctr(cols[j + 1].x + 15, yy, hrsFmt(e[k]), 6.6, true);
                });
                txt(cols[5].x + 4, yy, e.co, 6.4);
                txt(cols[6].x + 4, yy, e.show, 6.4);
            });
        }
    }
    /* column rules */
    cols.forEach((c, i) => {
        if (i) line(c.x, tableTop, c.x, tableBot, 0.7);
    });

    /* ---- totals ---- */
    let ty = tableBot - rowH;
    box(L, ty, R - L, rowH);
    txt(L + 4, ty + 4.8, "TOTAL OF EACH CATEGORY", 7.5, true);
    ["a", "b", "c", "d"].forEach((k, j) =>
        ctr(cols[j + 1].x + 15, ty + 4.8, hrsFmt(opt.totals[k]), 8.5, true),
    );
    cols.forEach((c, i) => {
        if (i) line(c.x, ty + rowH, c.x, ty, 0.7);
    });

    ty -= rowH;
    box(L, ty, R - L, rowH);
    txt(L + 4, ty + 4.8, "END OF MONTH TOTAL/", 7.5, true);
    txt(cols[1].x + 6, ty + 4.5, hrsFmt(opt.totals.total), 10, true);
    line(cols[1].x, ty + rowH, cols[1].x, ty, 0.7);
    txt(cols[5].x + 4, ty + 4.8, "REASON FOR 0 HOURS", 7, true);
    line(cols[5].x, ty + rowH, cols[5].x, ty, 0.7);
    if (opt.reason) txt(cols[5].x + 96, ty + 4.8, opt.reason, 7);

    /* ---- apprentice block ---- */
    let by = ty - 20;
    const bh = 58;
    box(L, by - bh, R - L, bh);
    line(L, by - 14, R, by - 14, 0.7);
    ctr(W / 2, by - 10.5, "APPRENTICE INFORMATION", 8, true);

    txt(L + 6, by - 30, "NAME:", 8, true);
    txt(L + 42, by - 30, String(opt.name).toUpperCase(), 9);
    txt(L + 6, by - 48, "LAST 4 SSN:", 8, true);
    txt(L + 66, by - 48, String(opt.last4 || ""), 9);

    const sx = L + 300;
    line(sx, by - bh, sx, by - 14, 0.7);
    txt(sx + 6, by - 30, "APPRENTICE SIGNATURE", 8, true);
    line(sx + 6, by - 50, R - 10, by - 50, 0.7);

    /* ---- declaration ---- */
    const dy = by - bh - 16;
    const decl = [
        "I declare that the above hours submitted are true and accurate. I understand that if I turn in my OJT after 4pm on the",
        "1st day of the month it is due, I will be placed on the do not hire list. I understand that working while on the DO NOT",
        "HIRE list is also a violation of the Rules and Regs.",
    ];
    decl.forEach((l, i) => txt(L, dy - i * 10, l, 7.2));
    txt(
        L,
        dy - 3 * 10 - 6,
        "Turn in to the JATC office by the 1st: " +
            JATC.office +
            " or by email.",
        7.2,
        true,
    );

    /* ---- assemble ---- */
    const content = ops.join("\n");
    const objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
            W +
            " " +
            H +
            "] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
        "<< /Length " +
            content.length +
            " >>\nstream\n" +
            content +
            "\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offs = [];
    objs.forEach((o, i) => {
        offs.push(pdf.length);
        pdf += i + 1 + " 0 obj\n" + o + "\nendobj\n";
    });
    const xref = pdf.length;
    pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offs.forEach((o) => {
        pdf += String(o).padStart(10, "0") + " 00000 n \n";
    });
    pdf +=
        "trailer\n<< /Size " +
        (objs.length + 1) +
        " /Root 1 0 R >>\nstartxref\n" +
        xref +
        "\n%%EOF";
    return pdf;
}

/* pull a month of calendar entries into the shape the form wants */
function ojtFormRows(entries, monthKey) {
    const byDate = {};
    const totals = { a: 0, b: 0, c: 0, d: 0, total: 0, uncat: 0 };
    Object.keys(entries || {})
        .filter((k) => k.slice(0, 7) === monthKey)
        .sort()
        .forEach((dk) => {
            const day = fromKey(dk).getDate();
            (entries[dk] || []).forEach((e) => {
                const cat = String(e.cat || "").toLowerCase();
                const h = num(e.hrs);
                const row = {
                    a: 0,
                    b: 0,
                    c: 0,
                    d: 0,
                    co: e.co || "",
                    show: e.note || "",
                    hrs: h,
                };
                if (cat === "a" || cat === "b" || cat === "c" || cat === "d") {
                    row[cat] = h;
                    totals[cat] += h;
                } else totals.uncat += h;
                totals.total += h;
                (byDate[day] = byDate[day] || []).push(row);
            });
        });
    return { byDate, totals };
}

function downloadPdf(name, data) {
    try {
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++)
            bytes[i] = data.charCodeAt(i) & 0xff;
        const url = URL.createObjectURL(
            new Blob([bytes], { type: "application/pdf" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 100);
        return true;
    } catch (e) {
        return false;
    }
}

/* ---------- OJT: paper-form export ---------- */
function padR(v, n) {
    const s = String(v == null ? "" : v);
    return s.length >= n
        ? s.slice(0, n - 1) + " "
        : s + " ".repeat(n - s.length);
}
function padL(v, n) {
    const s = String(v == null ? "" : v);
    return s.length > n ? s.slice(0, n) : " ".repeat(n - s.length) + s;
}

function OjtExport({ entries, months, roll, profile }) {
    const t0 = todayMid();
    const withHours = Object.keys(roll).sort();
    const [mk, setMk] = useState(
        withHours.length
            ? withHours[withHours.length - 1]
            : mKey(t0.getFullYear(), t0.getMonth()),
    );
    const [reason, setReason] = useState("");
    const [done, setDone] = useState("");

    const form = useMemo(() => ojtFormRows(entries, mk), [entries, mk]);
    const p = mParse(mk);
    const prior = ojtTotals(months.filter((x) => x.m < mk)).total;
    const sub = months.find((x) => x.m === mk);
    const st = ojtState(mk, months);
    const dayCount = Object.keys(form.byDate).length;
    const splitDays = Object.keys(form.byDate).filter(
        (d) => form.byDate[d].length > 1,
    );

    const savePdf = () => {
        const pdf = buildOjtPdf({
            monthName: MON_FULL[p.m],
            year: p.y,
            byDate: form.byDate,
            totals: form.totals,
            name: profile.name,
            last4: profile.last4,
            reason: form.totals.total === 0 ? reason : "",
        });
        setDone(
            downloadPdf("OJT_" + MON_FULL[p.m] + "_" + p.y + ".pdf", pdf)
                ? "pdf"
                : "fail",
        );
        setTimeout(() => setDone(""), 2200);
    };

    const text = useMemo(() => {
        const L = [];
        L.push("CA TRADESHOW & SIGN CRAFTS JATC — ON-THE-JOB TRAINING");
        L.push(mLong(mk).toUpperCase());
        L.push("");
        L.push(
            "APPRENTICE  " + profile.name + "   LAST 4 SSN  " + profile.last4,
        );
        L.push("");
        L.push(
            padR("DATE", 6) +
                padL("A", 6) +
                padL("B", 6) +
                padL("C", 6) +
                padL("D", 6) +
                "  " +
                padR("COMPANY", 24) +
                "SHOW",
        );
        L.push("-".repeat(76));
        Object.keys(form.byDate)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((d) => {
                form.byDate[d].forEach((r, i) => {
                    const cell = (v) => padL(v ? num(v).toFixed(1) : "-", 6);
                    L.push(
                        padR(i === 0 ? String(d) : "", 6) +
                            cell(r.a) +
                            cell(r.b) +
                            cell(r.c) +
                            cell(r.d) +
                            "  " +
                            padR(r.co, 24) +
                            r.show,
                    );
                });
            });
        L.push("-".repeat(76));
        L.push(
            padR("TOTAL", 6) +
                padL(form.totals.a.toFixed(1), 6) +
                padL(form.totals.b.toFixed(1), 6) +
                padL(form.totals.c.toFixed(1), 6) +
                padL(form.totals.d.toFixed(1), 6),
        );
        L.push("END OF MONTH TOTAL  " + form.totals.total.toFixed(1));
        L.push("");
        L.push("Cumulative before this month: " + prior.toFixed(1) + " hrs");
        if (sub)
            L.push(
                "Already submitted for this month: " +
                    monthTotal(sub).toFixed(1) +
                    " hrs",
            );
        if (form.totals.uncat > 0)
            L.push(
                "WARNING: " +
                    form.totals.uncat.toFixed(1) +
                    " hrs are not tagged A/B/C/D.",
            );
        return L.join("\n");
    }, [form, mk, months, prior, sub, profile]);

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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <button
                    className="foc"
                    onClick={() => setMk((k) => mAdd(k, -1))}
                    aria-label="Previous month"
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: C.raise,
                        border: "1px solid " + C.line,
                        color: C.hi,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronLeft size={17} />
                </button>
                <div style={{ flex: 1, textAlign: "center" }}>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 14,
                            fontWeight: 800,
                            letterSpacing: 1.5,
                            color: C.hi,
                        }}
                    >
                        {mMed(mk)}
                    </div>
                    <div
                        style={{
                            fontFamily: FM,
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: st.c,
                            marginTop: 2,
                        }}
                    >
                        {st.t}
                    </div>
                </div>
                <button
                    className="foc"
                    onClick={() => setMk((k) => mAdd(k, 1))}
                    aria-label="Next month"
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: C.raise,
                        border: "1px solid " + C.line,
                        color: C.hi,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronRight size={17} />
                </button>
            </div>

            {/* what the form will say */}
            <div
                style={{
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 11,
                    padding: "16px 17px",
                    marginBottom: 12,
                }}
            >
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {["A", "B", "C", "D"].map((k) => {
                        const v = form.totals[k.toLowerCase()];
                        const meta = CATS_META[k];
                        return (
                            <div
                                key={k}
                                style={{
                                    flex: 1,
                                    textAlign: "center",
                                    background: v
                                        ? meta.color + "1C"
                                        : "transparent",
                                    border:
                                        "1px solid " +
                                        (v ? meta.color + "66" : C.line),
                                    borderRadius: 8,
                                    padding: "7px 2px",
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 10,
                                        fontWeight: 800,
                                        color: v ? meta.color : C.lo,
                                    }}
                                >
                                    {k}
                                </div>
                                <div
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 15,
                                        fontWeight: 800,
                                        color: v ? C.hi : C.lo,
                                        marginTop: 2,
                                    }}
                                >
                                    {hrsFmt(v)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: C.mid }}>
                        {dayCount} day{dayCount === 1 ? "" : "s"}
                        {splitDays.length
                            ? " · " +
                              splitDays.length +
                              " split between two shops"
                            : ""}
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontFamily: FM,
                            fontSize: 17,
                            fontWeight: 800,
                            color: form.totals.total ? C.working : C.lo,
                        }}
                    >
                        {hrsFmt(form.totals.total)} hrs
                    </span>
                </div>
                {form.totals.uncat > 0 && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginTop: 9,
                            background: "rgba(232,146,124,0.1)",
                            border: "1px solid " + C.danger + "55",
                            borderRadius: 8,
                            padding: "8px 10px",
                        }}
                    >
                        <Ban
                            size={12}
                            color={C.danger}
                            style={{ flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 11.5, color: C.mid }}>
                            {hrsFmt(form.totals.uncat)} hrs have no category.
                            The office sends those back.
                        </span>
                    </div>
                )}
            </div>

            {form.totals.total === 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.5,
                            color: C.lo,
                            fontFamily: FM,
                            marginBottom: 5,
                        }}
                    >
                        REASON FOR 0 HOURS
                    </div>
                    <input
                        className="foc"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="medical, out of town…"
                        style={{
                            width: "100%",
                            background: C.sunk,
                            color: C.hi,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "10px 11px",
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
                        You still turn one in every month, worked or not — and
                        "lack of work" isn't an accepted reason if work was
                        available.
                    </div>
                </div>
            )}

            <button
                className="foc"
                onClick={savePdf}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "14px",
                    borderRadius: 11,
                    background: done === "pdf" ? C.working : C.brand,
                    color: done === "pdf" ? "#06120C" : "#1A1206",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 14.5,
                }}
            >
                {done === "pdf" ? <Check size={17} /> : <Upload size={17} />}
                {done === "pdf"
                    ? "Downloaded"
                    : done === "fail"
                      ? "Couldn't save — try the text below"
                      : "Download the OJT form (PDF)"}
            </button>
            <div
                style={{
                    fontSize: 11,
                    color: C.lo,
                    marginTop: 8,
                    lineHeight: 1.5,
                    textAlign: "center",
                }}
            >
                Filled out and ready to email — sign it and send it to the JATC
                by the 1st, 4:00 PM.
            </div>

            <div
                style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: "1px solid " + C.line,
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.5,
                        color: C.lo,
                        fontFamily: FM,
                        marginBottom: 8,
                    }}
                >
                    PLAIN TEXT — IF YOU'D RATHER PASTE IT
                </div>
                <textarea
                    readOnly
                    value={text}
                    rows={9}
                    onFocus={(e) => e.target.select()}
                    style={{
                        width: "100%",
                        resize: "vertical",
                        background: C.sunk,
                        color: C.hi,
                        border: "1px solid " + C.line,
                        borderRadius: 10,
                        padding: "10px 11px",
                        fontSize: 10.5,
                        fontFamily: FM,
                        lineHeight: 1.6,
                        whiteSpace: "pre",
                        overflowX: "auto",
                    }}
                />
                <button
                    className="foc"
                    onClick={copy}
                    style={{
                        width: "100%",
                        marginTop: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        padding: "11px",
                        borderRadius: 10,
                        background: C.raise,
                        color: copied ? C.working : C.hi,
                        border: "1px solid " + C.line,
                        fontWeight: 700,
                        fontSize: 13,
                    }}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy text"}
                </button>
            </div>
        </div>
    );
}


/* ---------- main nav: bottom bar on a phone, top pills on a desktop ---------- */
const TABS = [
    ["home", "Home", LayoutDashboard],
    ["board", "Board", LayoutList],
    ["cal", "Calendar", CalendarDays],
    ["ojt", "OJT", GraduationCap],
];

function NavBar({ tab, setTab, variant }) {
    if (variant === "bottom") {
        return (
            <div style={{ display: "flex" }}>
                {TABS.map(([k, lab, Ico]) => {
                    const on = tab === k;
                    return (
                        <button
                            key={k}
                            className="foc"
                            onClick={() => setTab(k)}
                            style={{
                                flex: 1,
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                padding: "9px 0 8px",
                                background: "transparent",
                                border: "none",
                            }}
                        >
                            {on && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: 26,
                                        height: 2.5,
                                        borderRadius: 2,
                                        background: C.brand,
                                    }}
                                />
                            )}
                            <Ico size={19} color={on ? C.brand : C.lo} />
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    letterSpacing: 0.2,
                                    color: on ? C.brand : C.lo,
                                }}
                            >
                                {lab}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    }
    return (
        <div
            style={{
                display: "flex",
                gap: 6,
                background: C.panel,
                borderRadius: 12,
                padding: 4,
                border: "1px solid " + C.edge,
                boxShadow: SHADOW,
            }}
        >
            {TABS.map(([k, lab, Ico]) => {
                const on = tab === k;
                return (
                    <button
                        key={k}
                        className="foc"
                        onClick={() => setTab(k)}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            padding: "11px 4px",
                            borderRadius: 9,
                            fontSize: 13.5,
                            fontWeight: 800,
                            background: on ? C.brand : "transparent",
                            color: on ? "#1A1206" : C.mid,
                            border: "none",
                        }}
                    >
                        <Ico size={16} />
                        {lab}
                    </button>
                );
            })}
        </div>
    );
}


/* ---------- main app ---------- */
export default function App() {
    // tab (and, on Board, which show is focused) live in the URL, not local
    // state — that's what gives us back-button support and bookmarkable/
    // deep-linkable tabs for free. router.push() (not replace) so every tab
    // switch is a real history entry.
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab") || "home";
    const setTab = (name) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", name);
        params.delete("show");
        router.push(`${pathname}?${params.toString()}`);
    };
    // set by the "no password on file" nudge on Home so it can jump to the
    // OJT tab AND pop the Change Password modal open, not just switch tabs.
    const [pwIntent, setPwIntent] = useState(false);
    const [shows, setShows] = useState([]);
    const [pins, setPins] = useState(DEFAULT_PINS);
    const [entries, setEntries] = useState({});
    const [customCos, setCustomCos] = useState([]);
    const [ojt, setOjt] = useState(OJT_DEFAULT);
    const [rates, setRates] = useState({});
    const [bookings, setBookings] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ ok: true, message: "" });
    const [view, setView] = useState("upcoming");
    const [regionsOn, setRegionsOn] = useState(() =>
        REGION_KEYS.reduce((a, r) => ((a[r] = true), a), {}),
    );
    const [query, setQuery] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const focusedShowRef = useRef(null);
    const [modal, setModal] = useState(null);
    const [showDates, setShowDates] = useState(false);
    const [openMonths, setOpenMonths] = useState({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [email, setEmail] = useState(null);
    const [hasPassword, setHasPassword] = useState(true); // assume set until load() says otherwise — avoids a flash of the nudge
    const [needsWelcome, setNeedsWelcome] = useState(false); // load() flips this true for a genuinely new apprentice, false by default so it never flashes for existing users
    const [profile, setProfile] = useState({
        name: "",
        memberId: "",
        last4: "",
        local: "IUPAT Local 831",
        rsiCredits: 0,
        joined: "",
    });
    const [doNotHire, setDoNotHire] = useState({ on: false, reason: "", since: null });
    const [certs, setCerts] = useState([]);
    const [completedClasses, setCompletedClasses] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [jatcContacts, setJatcContacts] = useState([]);
    const t0 = todayMid();
    const [cur, setCur] = useState({ y: t0.getFullYear(), m: t0.getMonth() });

    useEffect(() => {
        let live = true;
        store.load().then((data) => {
            if (!live) return;
            setShows(
                data && Array.isArray(data.shows)
                    ? mergeSeed(data.shows)
                    : SEED,
            );
            setPins(
                data && Array.isArray(data.pins) ? data.pins : DEFAULT_PINS,
            );
            setEntries(
                data && data.entries && typeof data.entries === "object"
                    ? data.entries
                    : {},
            );
            setCustomCos(
                data && Array.isArray(data.customCos) ? data.customCos : [],
            );
            setOjt(
                data && data.ojt && Array.isArray(data.ojt.months)
                    ? { ...OJT_DEFAULT, ...data.ojt }
                    : OJT_DEFAULT,
            );
            setRates(
                data && data.rates && typeof data.rates === "object"
                    ? data.rates
                    : {},
            );
            setBookings(
                data && Array.isArray(data.bookings) ? data.bookings : [],
            );
            setClasses(data && Array.isArray(data.classes) ? data.classes : []);
            // admin/apprentice routing is resolved in middleware.js, before this
            // page ever renders — no client-side redirect needed (or wanted:
            // that would flash the apprentice board first on every admin login).
            setIsAdmin(!!(data && data.isAdmin));
            setEmail((data && data.email) || null);
            setHasPassword(!!(data && data.hasPassword));
            setNeedsWelcome(!!(data && data.needsWelcome));
            setProfile(
                data && data.profile
                    ? data.profile
                    : {
                          name: "",
                          memberId: "",
                          last4: "",
                          local: "IUPAT Local 831",
                          rsiCredits: 0,
                          joined: "",
                      },
            );
            setDoNotHire(
                data && data.doNotHire
                    ? data.doNotHire
                    : { on: false, reason: "", since: null },
            );
            setCerts(data && Array.isArray(data.certs) ? data.certs : []);
            setCompletedClasses(data && Array.isArray(data.completedClasses) ? data.completedClasses : []);
            setNotifications(
                data && Array.isArray(data.notifications)
                    ? data.notifications
                    : [],
            );
            setCompanies(data && Array.isArray(data.companies) ? data.companies : []);
            setJatcContacts(data && Array.isArray(data.jatcContacts) ? data.jatcContacts : []);
            setLoaded(true);
        });
        return () => {
            live = false;
        };
    }, []);

    useEffect(() => {
        if (!loaded) return;
        const t = setTimeout(() => {
            store.save({
                shows,
                pins,
                entries,
                customCos,
                ojt,
                rates,
                bookings,
                classes,
            });
        }, 250);
        return () => clearTimeout(t);
    }, [
        shows,
        pins,
        entries,
        customCos,
        ojt,
        rates,
        bookings,
        classes,
        loaded,
    ]);

    /* store.js's sync used to fail silently — surface it so a stuck save
       (rate limit, offline, server error) reads as "will retry" instead of
       looking identical to a working save. */
    useEffect(() => subscribeSyncStatus(setSyncStatus), []);

    /* clear just the hours for one month — bookings, classes and the board stay put */
    const clearMonth = (prefix) =>
        setEntries((prev) => {
            const next = {};
            Object.keys(prev).forEach((k) => {
                if (k.indexOf(prefix) !== 0) next[k] = prev[k];
            });
            return next;
        });

    /* clearing is a direct server call (not part of the diffed save() blob) —
       optimistically drop it locally either way so the dismiss feels instant. */
    const clearNotification = (id) => {
        setNotifications((prev) =>
            id === "all" ? [] : prev.filter((n) => n.id !== id),
        );
        store.clearNotification(id);
    };

    /* same optimistic-then-sync shape as clearNotification — self-reported,
       not cross-checked against anything, so there's no reason to wait on
       the server before reflecting the tap. */
    const toggleCompletedClass = (courseId) => {
        const done = !completedClasses.includes(courseId);
        setCompletedClasses((prev) =>
            done ? [...prev, courseId] : prev.filter((id) => id !== courseId),
        );
        store.toggleCompletedClass(courseId, done);
    };

    /* switch tabs and, if a show id came along for the ride (tapping a show
       from the Home tab), land on the Board tab with that exact show already
       expanded — the show id lives in the URL (?tab=board&show=<id>) so this
       is also what makes a focused show bookmarkable/shareable, not just a
       one-off in-app jump. */
    const goto = (tabName, showId, opts) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tabName);
        if (showId) params.set("show", showId);
        else params.delete("show");
        router.push(`${pathname}?${params.toString()}`);
        if (opts?.openPassword) setPwIntent(true);
    };

    // Runs whenever ?show=<id> changes (including a cold load straight into
    // a deep link, before `shows` has even finished fetching — the `shows`
    // dependency lets it wait and fire once the data lands). Sets expandedId
    // here too (not in goto()) so a bookmarked/shared URL expands the right
    // card on its own, without ever routing through goto(). focusedShowRef
    // stops it from re-clearing filters every time `shows` changes for an
    // unrelated reason (e.g. patch()) while the same show stays focused.
    const focusShowId = searchParams.get("show");
    useEffect(() => {
        if (!focusShowId) {
            focusedShowRef.current = null;
            return;
        }
        if (focusedShowRef.current === focusShowId) return;
        const target = shows.find((s) => s.id === focusShowId);
        if (!target) return;
        setExpandedId(focusShowId);
        setQuery("");
        setRegionsOn(REGION_KEYS.reduce((a, r) => ((a[r] = true), a), {}));
        const past = isPast(target);
        setView(past ? "past" : "upcoming");
        const mk = past
            ? monthKey(target)
            : Math.max(monthKey(target), monthKeyNow());
        const label = mk === 999999 ? "SCHEDULED" : labelFromKey(mk);
        setOpenMonths((prev) => ({ ...prev, [label]: true }));
        requestAnimationFrame(() => {
            document
                .getElementById("show-" + focusShowId)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        focusedShowRef.current = focusShowId;
    }, [focusShowId, shows]);

    // bookmarkable "log today" entry point — a URL like /?action=log-today
    // (e.g. saved to a phone home screen) opens straight to the day-log
    // modal for today, then cleans the param off the URL via replace so it
    // doesn't re-fire or clutter the address bar.
    const actionParam = searchParams.get("action");
    const handledActionRef = useRef(null);
    useEffect(() => {
        if (!actionParam || handledActionRef.current === actionParam) return;
        handledActionRef.current = actionParam;
        if (actionParam === "log-today") {
            setModal({ type: "day", key: keyOf(todayMid()) });
        }
        const params = new URLSearchParams(searchParams.toString());
        params.delete("action");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [actionParam]);


    const patch = (id, p) =>
        setShows((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
    const togglePin = (name) =>
        setPins((prev) =>
            prev.includes(name)
                ? prev.filter((n) => n !== name)
                : [...prev, name],
        );
    const addCo = (name) =>
        setCustomCos((prev) =>
            prev.includes(name) || companies.some((c) => c.n === name)
                ? prev
                : [...prev, name],
        );
    const saveEntry = (k, e) =>
        setEntries((prev) => {
            const list = (prev[k] || []).filter((x) => x.id !== e.id);
            return { ...prev, [k]: [...list, e] };
        });
    const saveMonth = (row) =>
        setOjt((prev) => {
            const months = (prev.months || []).filter((m) => m.m !== row.m);
            months.push(row);
            months.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
            return { ...prev, months };
        });
    const delMonth = (key) =>
        setOjt((prev) => ({
            ...prev,
            months: (prev.months || []).filter((m) => m.m !== key),
        }));
    /* "" keeps the company listed at scale; removeRate drops it from the panel entirely */
    const setRate = (co, lvKey) =>
        setRates((prev) => ({ ...prev, [co]: lvKey || null }));
    const removeRate = (co) =>
        setRates((prev) => {
            const n = { ...prev };
            delete n[co];
            return n;
        });
    const saveBooking = (b) =>
        setBookings((prev) => {
            const rest = prev.filter((x) => x.id !== b.id);
            return b.dates && b.dates.length ? [...rest, b] : rest;
        });
    const delBooking = (id) =>
        setBookings((prev) => prev.filter((x) => x.id !== id));
    const lvIdx = levelIndex(ojtTotals(ojt.months).total);
    const delEntry = (k, id) =>
        setEntries((prev) => {
            const list = (prev[k] || []).filter((x) => x.id !== id);
            const next = { ...prev };
            if (list.length) next[k] = list;
            else delete next[k];
            return next;
        });


    const css = `
    .sb *{ -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
    .sb .wrap{ max-width: 576px; }
    .sb .page{ padding: 0 12px 172px; }
    .sb .navtop{ display: none; }
    .sb .navbot{ display: block; padding-bottom: env(safe-area-inset-bottom, 0px); }
    .sb .dgrid{ display: flex; flex-direction: column; gap: 10px; }
    .sb .bgrid{ display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .sb .dcell{ height: 54px; }
    .sb .wcell{ height: 58px; }
    .sb .modal-ovl{ display: flex; flex-direction: column; justify-content: flex-end; }
    .sb .modal-panel{ width: 100%; max-width: 576px; margin: 0 auto; border-top-left-radius: 18px; border-top-right-radius: 18px; border-top: 1px solid ${C.edge}; max-height: 92vh; }
    @media (min-width: 900px){
      .sb .wrap{ max-width: 1280px; }
      .sb .page{ padding: 0 20px 108px; }
      .sb .navtop{ display: block; margin-bottom: 10px; }
      .sb .navbot{ display: none; }
      .sb .dgrid{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
      .sb .dspan{ grid-column: 1 / -1; }
      .sb .bgrid{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
      .sb .m4{ grid-template-columns: repeat(4, 1fr) !important; }
      .sb .dcell{ height: 84px; }
      .sb .wcell{ height: 74px; }
      .sb .htitle{ font-size: 32px !important; }
      .sb .modal-ovl{ justify-content: center; align-items: center; padding: 24px; }
      .sb .modal-panel{ max-width: 520px; max-height: 88vh; border-radius: 16px; border: 1px solid ${C.edge}; }
    }
    .sb button{ cursor: pointer; }
    .sb input, .sb textarea, .sb select{ outline: none; }
    .sb input::placeholder, .sb textarea::placeholder{ color: #565d6b; }
    .sb ::-webkit-scrollbar{ width: 6px; height: 6px; }
    .sb ::-webkit-scrollbar-thumb{ background: #2B323D; border-radius: 3px; }
    .sb .foc:focus-visible{ box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.brand}; }
    .sb .signout-btn:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
    .sb .truncate{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sb .noscroll{ scrollbar-width:none; } .sb .noscroll::-webkit-scrollbar{ display:none; }
    @media (prefers-reduced-motion: reduce){ .sb *{ transition:none !important; animation:none !important; } }
  `;

    const emptyMsg = {
        upcoming:
            "No upcoming shows on the board. Import the latest schedule when the union posts it, or add a call yourself.",
        past: "Nothing in the archive yet. Old shows land here once they wrap.",
        working:
            "Nothing marked as working yet. Open a show and hit Working to track your calls.",
        targets:
            "No targets flagged. Tap a show and hit Target to line up the ones you want.",
    }[view];

    return (
        <DirectoryContext.Provider value={{ companies, jatcContacts }}>
        <div
            className="sb"
            style={{
                minHeight: "100vh",
                background: C.bg,
                color: C.hi,
                fontFamily: FS,
            }}
        >
            <style>{css}</style>
            <div className="wrap page mx-auto">
                {/* header */}
                <div style={{ paddingTop: 18, paddingBottom: 18 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 10,
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 10,
                                    letterSpacing: 2.5,
                                    color: C.brand,
                                    fontFamily: FM,
                                    fontWeight: 700,
                                }}
                            >
                                LOCAL 831 · TRADESHOW &amp; SIGN
                            </div>
                            <div
                                className="htitle"
                                style={{
                                    fontSize: 25,
                                    fontWeight: 800,
                                    letterSpacing: -0.4,
                                    marginTop: 6,
                                }}
                            >
                                {tab === "home"
                                    ? "Dashboard"
                                    : tab === "board"
                                      ? "Show Board"
                                      : tab === "cal"
                                        ? "Work Calendar"
                                        : "Apprenticeship"}
                            </div>
                            <div
                                style={{
                                    fontSize: 11.5,
                                    color: C.lo,
                                    marginTop: 6,
                                }}
                            >
                                {tab === "home"
                                    ? longDate(todayMid()) +
                                      " · " +
                                      LEVELS[
                                          levelIndex(
                                              ojtTotals(ojt.months).total,
                                          )
                                      ].label
                                    : tab === "board"
                                      ? "Out-of-work list · LA & SD · " +
                                        UNION_LINE_PRETTY
                                      : tab === "cal"
                                        ? "Tap a day to log the company and your hours"
                                        : LEVELS[
                                              levelIndex(
                                                  ojtTotals(ojt.months).total,
                                              )
                                          ].label +
                                          " · " +
                                          hrsFmt(ojtTotals(ojt.months).total) +
                                          " hrs on file with the JATC"}
                            </div>
                        </div>
                        <a
                            className="foc"
                            href={"tel:" + UNION_LINE}
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                background: C.brand,
                                color: "#1A1206",
                                textDecoration: "none",
                                padding: "9px 12px",
                                borderRadius: 10,
                                fontWeight: 800,
                                fontSize: 12.5,
                            }}
                        >
                            <Phone size={15} /> Call for work
                        </a>
                    </div>
                </div>

                {!syncStatus.ok && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: C.danger + "1a",
                            border: "1px solid " + C.danger + "55",
                            borderRadius: 10,
                            padding: "9px 12px",
                            marginBottom: 12,
                            fontSize: 12,
                            color: C.hi,
                        }}
                    >
                        <CloudOff
                            size={15}
                            color={C.danger}
                            style={{ flexShrink: 0 }}
                        />
                        {syncStatus.message}
                    </div>
                )}

                {/* tabs + controls */}
                <div
                    style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        background: C.bg,
                        paddingBottom: tab === "board" ? 10 : 0,
                    }}
                >
                    <div className="navtop">
                        <NavBar tab={tab} setTab={setTab} variant="top" />
                    </div>

                </div>

                {!loaded ? (
                    <div className="dgrid">
                        <div
                            className="skeleton dspan"
                            style={{ height: 148 }}
                        />
                        <div
                            className="skeleton dspan"
                            style={{ height: 160 }}
                        />
                        <div
                            className="skeleton dspan"
                            style={{ height: 108 }}
                        />
                    </div>
                ) : tab === "home" ? (
                    <HomeTab
                        shows={shows}
                        entries={entries}
                        ojt={ojt}
                        rates={rates}
                        bookings={bookings}
                        classes={classes}
                        hasPassword={hasPassword}
                        notifications={notifications}
                        doNotHire={doNotHire}
                        onClearNotification={clearNotification}
                        onOpenDay={(k) => setModal({ type: "day", key: k })}
                        onGoto={goto}
                        onOpenDir={() => setModal({ type: "dir" })}
                    />
                ) : tab === "cal" ? (
                    <CalTab
                        shows={shows}
                        entries={entries}
                        cur={cur}
                        setCur={setCur}
                        lvIdx={lvIdx}
                        rates={rates}
                        bookings={bookings}
                        classes={classes}
                        onOpenSummary={() => setModal({ type: "summary" })}
                        onClearMonth={clearMonth}
                        onOpenDay={(k) => setModal({ type: "day", key: k })}
                    />
                ) : tab === "ojt" ? (
                    <OjtTab
                        ojt={ojt}
                        entries={entries}
                        rates={rates}
                        classes={classes}
                        onSetRate={setRate}
                        onRemoveRate={removeRate}
                        onAddRateCo={() => setModal({ type: "ratecos" })}
                        onAddMonth={(k) =>
                            setModal({ type: "month", prefill: k })
                        }
                        onEditMonth={(row) =>
                            setModal({ type: "month", month: row })
                        }
                        onImportMonths={() =>
                            setModal({ type: "ojt-import" })
                        }
                        onOpenRules={() =>
                            setModal({ type: "jatc-rules" })
                        }
                        email={email}
                        isAdmin={isAdmin}
                        profile={profile}
                        certs={certs}
                        completedClasses={completedClasses}
                        onToggleCompletedClass={toggleCompletedClass}
                        onPasswordSet={() => setHasPassword(true)}
                        pwIntent={pwIntent}
                        onPwIntentConsumed={() => setPwIntent(false)}
                        onSignOut={() =>
                            store.signOut().then(() => {
                                window.location.href = "/login";
                            })
                        }
                    />
                ) : (
                    <BoardTab
                        shows={shows}
                        entries={entries}
                        bookings={bookings}
                        view={view}
                        setView={setView}
                        regionsOn={regionsOn}
                        setRegionsOn={setRegionsOn}
                        query={query}
                        setQuery={setQuery}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        showDates={showDates}
                        setShowDates={setShowDates}
                        openMonths={openMonths}
                        setOpenMonths={setOpenMonths}
                        onPatchShow={patch}
                        onOpenDir={() => setModal({ type: "dir" })}
                        onOpenBooking={(payload) =>
                            setModal({ type: "booking", ...payload })
                        }
                    />
                )}
            </div>

            {/* bottom bar */}
            <div
                style={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 30,
                }}
            >
                <div
                    style={{
                        padding: "14px 12px 10px",
                        background:
                            "linear-gradient(to top, " +
                            C.bg +
                            " 68%, rgba(13,15,19,0))",
                    }}
                >
                    <div
                        className="wrap mx-auto"
                        style={{ display: "flex", gap: 8 }}
                    >
                        {tab === "home" ? (
                            <>
                                <button
                                    className="foc"
                                    onClick={() => setModal({ type: "dir" })}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 7,
                                        padding: "13px",
                                        borderRadius: 12,
                                        background: C.panel,
                                        color: C.hi,
                                        border: "1px solid " + C.edge,
                                        fontWeight: 700,
                                        fontSize: 14,
                                        boxShadow: SHADOW,
                                    }}
                                >
                                    <Building2 size={17} /> Companies
                                </button>
                                <button
                                    className="foc"
                                    onClick={() =>
                                        setModal({
                                            type: "day",
                                            key: keyOf(todayMid()),
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 7,
                                        padding: "13px",
                                        borderRadius: 12,
                                        background: C.working,
                                        color: "#06120C",
                                        border: "none",
                                        fontWeight: 800,
                                        fontSize: 14,
                                        boxShadow: SHADOW,
                                    }}
                                >
                                    <Clock size={17} /> Log today
                                </button>
                            </>
                        ) : tab === "board" ? null : tab === "ojt" ? (
                            <>
                                {!OJT_IMPORT_ENABLED && (
                                    <button
                                        className="foc"
                                        onClick={() => setModal({ type: "month" })}
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 7,
                                            padding: "13px",
                                            borderRadius: 12,
                                            background: C.panel,
                                            color: C.hi,
                                            border: "1px solid " + C.edge,
                                            fontWeight: 700,
                                            fontSize: 14,
                                            boxShadow: SHADOW,
                                        }}
                                    >
                                        <Plus size={17} /> Add month
                                    </button>
                                )}
                                {OJT_IMPORT_ENABLED && (
                                    <button
                                        className="foc"
                                        onClick={() =>
                                            setModal({ type: "ojt-import" })
                                        }
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 7,
                                            padding: "13px",
                                            borderRadius: 12,
                                            background: C.panel,
                                            color: C.hi,
                                            border: "1px solid " + C.edge,
                                            fontWeight: 700,
                                            fontSize: 14,
                                            boxShadow: SHADOW,
                                        }}
                                    >
                                        <Upload size={17} /> Upload
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    className="foc"
                                    onClick={() =>
                                        setModal({ type: "booking" })
                                    }
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 7,
                                        padding: "13px",
                                        borderRadius: 12,
                                        background: C.panel,
                                        color: BOOKED,
                                        border: "1px solid " + BOOKED + "55",
                                        fontWeight: 700,
                                        fontSize: 14,
                                        boxShadow: SHADOW,
                                    }}
                                >
                                    <CalendarDays size={16} /> Schedule days
                                </button>
                                <button
                                    className="foc"
                                    onClick={() =>
                                        setModal({
                                            type: "day",
                                            key: keyOf(todayMid()),
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 7,
                                        padding: "13px",
                                        borderRadius: 12,
                                        background: C.working,
                                        color: "#06120C",
                                        border: "none",
                                        fontWeight: 800,
                                        fontSize: 14,
                                        boxShadow: SHADOW,
                                    }}
                                >
                                    <Clock size={17} /> Log today
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div
                    className="navbot"
                    style={{
                        background: C.bg,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <div className="wrap mx-auto" style={{ padding: "0 8px" }}>
                        <NavBar tab={tab} setTab={setTab} variant="bottom" />
                    </div>
                </div>
            </div>

            {modal?.type === "dir" && (
                <Modal
                    title="Companies & labor lines"
                    onClose={() => setModal(null)}
                >
                    <DirList
                        pins={pins}
                        onTogglePin={togglePin}
                        customCos={customCos}
                    />
                </Modal>
            )}
            {modal?.type === "summary" && (
                <Modal
                    title={MONTHS[cur.m] + " " + cur.y + " summary"}
                    onClose={() => setModal(null)}
                >
                    <Summary entries={entries} cur={cur} />
                </Modal>
            )}
            {modal?.type === "booking" && (
                <Modal
                    title={
                        modal.booking && !modal.fresh
                            ? "Edit schedule"
                            : "Schedule days"
                    }
                    sub="Days you've been asked to work"
                    onClose={() => setModal(null)}
                >
                    <BookingForm
                        initial={modal.booking}
                        fresh={modal.fresh}
                        span={modal.span}
                        shows={shows}
                        pins={pins}
                        customCos={customCos}
                        onAddCo={addCo}
                        onSave={(b) => {
                            saveBooking(b);
                            setModal(null);
                        }}
                        onDelete={() => {
                            if (modal.booking) delBooking(modal.booking.id);
                            setModal(null);
                        }}
                        onClose={() => setModal(null)}
                    />
                </Modal>
            )}
            {modal?.type === "ratecos" && (
                <Modal
                    title="Add a company"
                    sub="Then set what they pay you"
                    onClose={() => setModal(null)}
                >
                    <CoPicker
                        value=""
                        pins={pins}
                        customCos={customCos}
                        onAddCo={addCo}
                        onPick={(n) => {
                            setRate(n, "");
                            setModal(null);
                        }}
                        onClose={() => setModal(null)}
                    />
                </Modal>
            )}
            {modal?.type === "month" && (
                <Modal
                    title={
                        modal.month
                            ? "Edit " + mMed(modal.month.m)
                            : "Add submitted month"
                    }
                    sub="Hours as turned in to the union"
                    onClose={() => setModal(null)}
                >
                    <MonthForm
                        initial={
                            modal.month ||
                            (modal.prefill
                                ? {
                                      m: modal.prefill,
                                      a: "",
                                      b: "",
                                      c: "",
                                      d: "",
                                  }
                                : null)
                        }
                        roll={rollupEntries(entries)}
                        existing={ojt.months || []}
                        onSave={(row) => {
                            saveMonth(row);
                            setModal(null);
                        }}
                        onDelete={() => {
                            delMonth(modal.month.m);
                            setModal(null);
                        }}
                        onClose={() => setModal(null)}
                    />
                </Modal>
            )}
            {modal?.type === "ojt-import" && (
                <Modal
                    title="Upload OJT slips"
                    sub="Scan old slips instead of retyping them"
                    onClose={() => setModal(null)}
                >
                    <OjtImportFlow
                        onSubmit={async (rows) => {
                            rows.forEach(saveMonth);
                            setModal(null);
                        }}
                        onCancel={() => setModal(null)}
                    />
                </Modal>
            )}
            {needsWelcome && !modal && (
                <WelcomeModal
                    onOpenOjtImport={() => {
                        setNeedsWelcome(false);
                        store.markWelcomed();
                        setModal({ type: "ojt-import" });
                    }}
                    onClose={() => {
                        setNeedsWelcome(false);
                        store.markWelcomed();
                    }}
                />
            )}
            {modal?.type === "jatc-rules" && (
                <Modal
                    title="JATC Rules & Regulations"
                    sub="The complete reference"
                    onClose={() => setModal(null)}
                >
                    <JatcRulesModal />
                </Modal>
            )}
            {modal?.type === "ojtform" && (
                <Modal
                    title="OJT form"
                    sub="Formatted for the JATC paper report"
                    onClose={() => setModal(null)}
                >
                    <OjtExport
                        entries={entries}
                        months={ojt.months || []}
                        roll={rollupEntries(entries)}
                        profile={profile}
                    />
                </Modal>
            )}
            {modal?.type === "day" && (
                <Modal
                    title={longDate(fromKey(modal.key))}
                    sub={"Log the company and hours you worked"}
                    onClose={() => setModal(null)}
                >
                    <DaySheet
                        dayKey={modal.key}
                        shows={shows}
                        entries={entries}
                        pins={pins}
                        customCos={customCos}
                        lvIdx={lvIdx}
                        rates={rates}
                        bookings={bookings}
                        classes={classes}
                        onDelBooking={delBooking}
                        onSaveBooking={saveBooking}
                        onSave={(k, e) => {
                            saveEntry(k, e);
                            setModal(null);
                        }}
                        onDelete={delEntry}
                        onAddCo={addCo}
                    />
                </Modal>
            )}
        </div>
        </DirectoryContext.Provider>
    );
}
