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
import { CoPicker } from "@/components/apprentice/CoPicker";
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

// DaySheet only ever opens on demand (tap a day, or "Log today") — never on
// initial paint — so it gets the same on-demand treatment as the tabs above,
// even though it's usually the very next click. ~1,650 lines that don't need
// to ship in the first bundle just because they're used soon after.
const DaySheet = dynamic(() => import("@/components/apprentice/DaySheet").then((m) => m.DaySheet), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});

// same on-demand treatment — "I got scheduled" only opens from a Board-tab
// action, not initial paint.
const BookingForm = dynamic(() => import("@/components/apprentice/BookingForm").then((m) => m.BookingForm), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});

// same on-demand treatment — the "Companies & labor lines" directory only
// opens from a button, never on initial paint.
const DirList = dynamic(() => import("@/components/apprentice/DirList").then((m) => m.DirList), {
    ssr: false,
    loading: () => (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#6B7383", fontSize: 13 }}>
            Loading…
        </div>
    ),
});

// same on-demand treatment — "Add month" / editing a submitted month.
const MonthForm = dynamic(() => import("@/components/apprentice/MonthForm").then((m) => m.MonthForm), {
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
    Upload,
    Building2,
    CalendarDays,
    Clock,
    LayoutList,
    GraduationCap,
    LayoutDashboard,
    CloudOff,
} from "lucide-react";
import { store, subscribeSyncStatus } from "@/lib/store";
import {
    BOOKED,
    C,
    DEFAULT_PINS,
    FM,
    FS,
    JATC,
    LEVELS,
    MONTHS,
    OJT_DEFAULT,
    REGION_KEYS,
    SEED,
    SHADOW,
    UNION_NAME,
    UNION_LINE,
    UNION_LINE_PRETTY,
    fromKey,
    hrsFmt,
    isPast,
    keyOf,
    labelFromKey,
    levelIndex,
    longDate,
    mMed,
    mergeSeed,
    monthKey,
    monthKeyNow,
    ojtTotals,
    rollupEntries,
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
   deep (DaySheet -> CoPicker, ...) and change once per app load.
   Lives in its own module (components/DirectoryContext.js) so the split-out
   tab files can import the same instance without a circular import. */


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
                            color: on ? C.ink : C.mid,
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
    const [dc36Contacts, setDc36Contacts] = useState([]);
    const [orgProfile, setOrgProfile] = useState({
        unionName: UNION_NAME,
        outOfWorkLine: UNION_LINE,
        outOfWorkLinePretty: UNION_LINE_PRETTY,
        jatcOfficeAddress: JATC.office,
    });
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
            setDc36Contacts(data && Array.isArray(data.dc36Contacts) ? data.dc36Contacts : []);
            if (data && data.orgProfile) setOrgProfile(data.orgProfile);
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

    /* same optimistic-then-sync shape — picking a cert from COMMON_CERTS
       reuses an existing row's id (renewal) or generates a fresh one (new). */
    const saveCert = (id, name, exp) => {
        setCerts((prev) => {
            const next = prev.filter((c) => c.id !== id);
            next.push({ id, n: name, exp });
            return next;
        });
        store.saveCert(id, name, exp);
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
        <DirectoryContext.Provider value={{ companies, jatcContacts, dc36Contacts, orgProfile }}>
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
                                        orgProfile.outOfWorkLinePretty
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
                            href={"tel:" + orgProfile.outOfWorkLine}
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                background: C.brand,
                                color: C.ink,
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
                        onOpenWelcome={() =>
                            setModal({ type: "welcome" })
                        }
                        email={email}
                        isAdmin={isAdmin}
                        profile={profile}
                        certs={certs}
                        onSaveCert={saveCert}
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
                                        color: C.inkGood,
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
                                        color: C.inkGood,
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
                        onSubmit={async ({ months, entries }) => {
                            months.forEach(saveMonth);
                            if (entries.length > 0) {
                                const res = await fetch("/api/entries/bulk", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(entries),
                                });
                                const body = await res.json().catch(() => ({}));
                                if (res.ok && Array.isArray(body.entries)) {
                                    body.entries.forEach((e) =>
                                        saveEntry(e.dayKey, { id: e.id, co: e.co, cat: e.cat, hrs: e.hrs }),
                                    );
                                }
                            }
                            setModal(null);
                        }}
                        onCancel={() => setModal(null)}
                    />
                </Modal>
            )}
            {((needsWelcome && !modal) || modal?.type === "welcome") && (
                <WelcomeModal
                    onOpenOjtImport={() => {
                        setNeedsWelcome(false);
                        store.markWelcomed();
                        setModal({ type: "ojt-import" });
                    }}
                    onClose={() => {
                        setNeedsWelcome(false);
                        store.markWelcomed();
                        setModal(null);
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
