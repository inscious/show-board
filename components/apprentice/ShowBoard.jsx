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

// shimmer placeholders for the code-split boundary below — shown while the
// chunk itself downloads (matters most exactly when this app matters most:
// no bars). TabLoading roughly matches a full tab's shape; ModalLoading
// matches a bottom-sheet form's. Plain "Loading…" text used to sit here for
// all eight of these regardless of destination shape.
function TabLoading() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="skeleton" style={{ height: 148 }} />
            <div className="skeleton" style={{ height: 160 }} />
            <div className="skeleton" style={{ height: 260 }} />
        </div>
    );
}
function ModalLoading() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
            <div className="skeleton" style={{ height: 48, borderRadius: 9 }} />
            <div className="skeleton" style={{ height: 48, borderRadius: 9 }} />
            <div className="skeleton" style={{ height: 48, borderRadius: 9 }} />
        </div>
    );
}

// loaded only when the OJT tab is actually opened — it's the single largest
// tab (rules reference, curriculum, pay-scale panels), no reason a Home-tab
// visit should pay to parse it. No SSR needed either: this only ever
// renders after the client-side store.load() finishes, same as every other
// tab here.
const OjtTab = dynamic(() => import("@/components/apprentice/tabs/OjtTab").then((m) => m.OjtTab), {
    ssr: false,
    loading: TabLoading,
});

// swapped in for the same "ojt" tab key when profile.graduatedAt is set —
// no OJT left to track for a CJ, this is the pay/certs/contacts/account
// hub instead. Only one of the two ever mounts for a given user.
const CjAccountTab = dynamic(() => import("@/components/apprentice/tabs/CjAccountTab").then((m) => m.CjAccountTab), {
    ssr: false,
    loading: TabLoading,
});

// same treatment for Calendar — Summary is its own dynamic() pointed at the
// same module (rather than a plain import) so opening "month summary" from
// the shell's modal dispatch doesn't pull CalTab's code back into the main
// bundle just because something outside the lazy boundary references it.
const CalTab = dynamic(() => import("@/components/apprentice/tabs/CalTab").then((m) => m.CalTab), {
    ssr: false,
    loading: TabLoading,
});
const Summary = dynamic(() => import("@/components/apprentice/tabs/CalTab").then((m) => m.Summary), { ssr: false });

// promoted to its own top-level tab (was a fold inside OJT) — same
// on-demand treatment, own-rows RLS reads/writes, nothing shared with the
// blob-synced tabs above.
const PortfolioSection = dynamic(() => import("@/components/ojt/PortfolioSection").then((m) => m.PortfolioSection), {
    ssr: false,
    loading: TabLoading,
});

// only ever rendered for the rare apprentice/CJ with profile.foremanOfCompanyId
// set — same on-demand, own-rows-RLS treatment as Portfolio, nothing shared
// with the blob-synced tabs either.
const ForemanTab = dynamic(() => import("@/components/apprentice/tabs/ForemanTab").then((m) => m.ForemanTab), {
    ssr: false,
    loading: TabLoading,
});

// Board is the last tab to get this treatment — unlike the other three it
// wasn't a standalone component to begin with, so this took real
// restructuring (see components/apprentice/tabs/BoardTab.jsx's own header
// comment for why its filter/search state stays owned here and gets passed
// down as controlled props, rather than moving into the tab itself).
const BoardTab = dynamic(() => import("@/components/apprentice/tabs/BoardTab").then((m) => m.BoardTab), {
    ssr: false,
    loading: TabLoading,
});

// DaySheet only ever opens on demand (tap a day, or "Log today") — never on
// initial paint — so it gets the same on-demand treatment as the tabs above,
// even though it's usually the very next click. ~1,650 lines that don't need
// to ship in the first bundle just because they're used soon after.
const DaySheet = dynamic(() => import("@/components/apprentice/DaySheet").then((m) => m.DaySheet), {
    ssr: false,
    loading: ModalLoading,
});

// same on-demand treatment — "I got scheduled" only opens from a Board-tab
// action, not initial paint.
const BookingForm = dynamic(() => import("@/components/apprentice/BookingForm").then((m) => m.BookingForm), {
    ssr: false,
    loading: ModalLoading,
});

// same on-demand treatment — the "Companies & labor lines" directory only
// opens from a button, never on initial paint.
const DirList = dynamic(() => import("@/components/apprentice/DirList").then((m) => m.DirList), {
    ssr: false,
    loading: ModalLoading,
});

// same on-demand treatment — "Add month" / editing a submitted month.
const MonthForm = dynamic(() => import("@/components/apprentice/MonthForm").then((m) => m.MonthForm), {
    ssr: false,
    loading: ModalLoading,
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
    Sparkles,
    Megaphone,
    User,
} from "lucide-react";
import { store, subscribeSyncStatus } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
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
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
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
const BASE_TABS = [
    ["home", "Home", LayoutDashboard],
    ["board", "Board", LayoutList],
    ["cal", "Calendar", CalendarDays],
    ["portfolio", "Portfolio", Sparkles],
    ["ojt", "OJT", GraduationCap],
];
// only the rare real foreman ever sees a 6th tab — an ordinary apprentice's
// nav is completely unchanged, per platform_architecture_scoping's "one
// person, two hats" model (Foreman is a capability grant, not a role switch).
const FOREMAN_TAB = ["foreman", "Hiring", Megaphone];

function NavBar({ tab, setTab, variant, tabs }) {
    const [hovered, setHovered] = useState(null);
    if (variant === "bottom") {
        return (
            <div style={{ display: "flex" }}>
                {tabs.map(([k, lab, Ico]) => {
                    const on = tab === k;
                    const hi = !on && hovered === k;
                    return (
                        <button
                            key={k}
                            className="foc navfoc"
                            onClick={() => setTab(k)}
                            onMouseEnter={() => setHovered(k)}
                            onMouseLeave={() => setHovered(null)}
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
                            <Ico size={19} color={on ? C.brand : hi ? C.hi : C.lo} />
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    letterSpacing: 0.2,
                                    color: on ? C.brand : hi ? C.hi : C.lo,
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
            {tabs.map(([k, lab, Ico]) => {
                const on = tab === k;
                const hi = !on && hovered === k;
                return (
                    <button
                        key={k}
                        className="foc navfoc"
                        onClick={() => setTab(k)}
                        onMouseEnter={() => setHovered(k)}
                        onMouseLeave={() => setHovered(null)}
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
                            color: on ? C.ink : hi ? C.hi : C.mid,
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
        avatarUrl: null,
    });
    const [doNotHire, setDoNotHire] = useState({ on: false, reason: "", since: null });
    const [certs, setCerts] = useState([]);
    const [completedClasses, setCompletedClasses] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [jatcContacts, setJatcContacts] = useState([]);
    const [dc36Contacts, setDc36Contacts] = useState([]);
    const [unionNotices, setUnionNotices] = useState([]);
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
                          avatarUrl: null,
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
            setUnionNotices(data && Array.isArray(data.unionNotices) ? data.unionNotices : []);
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

    /* Open labor calls (Home's "Open Labor Calls" section) — fetched here,
       not inside HomeTab itself, on purpose: HomeTab unmounts/remounts on
       every tab switch same as every other tab, and labor_calls isn't part
       of the offline-first store.ts blob (real-time marketplace data, same
       reasoning as Portfolio/Foreman), so a HomeTab-local fetch would
       refire — and re-flash its loading state — every single time you left
       Home and came back, the exact bug already fixed once this session for
       Console/Portfolio/admin Settings. Living up here (ShowBoard never
       remounts) is the fix applied up front instead of after the fact. */
    const [laborCalls, setLaborCalls] = useState([]);
    const [myLaborCallStatus, setMyLaborCallStatus] = useState({});
    const loadLaborCalls = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
        const [callsRes, respRes] = await Promise.all([
            supabase
                .from("labor_calls")
                .select("id, title, needed_count, category, starts_at, companies(name), shows(name)")
                .eq("status", "open")
                .gt("starts_at", cutoff)
                .order("starts_at", { ascending: true }),
            // explicit user_id filter, not just RLS's implicit scoping —
            // labor_call_responses also has a *second* select policy
            // ("foreman reads responses to own calls") that grants a
            // foreman visibility into OTHER people's responses to calls
            // they posted; without this filter, an unscoped select() here
            // would pick up those rows too and mislabel someone else's
            // response as the current user's own.
            supabase.from("labor_call_responses").select("labor_call_id, status").eq("user_id", user.id),
        ]);
        setLaborCalls(callsRes.data || []);
        const byCall = {};
        (respRes.data || []).forEach((r) => { byCall[r.labor_call_id] = r.status; });
        setMyLaborCallStatus(byCall);
    };
    useEffect(() => { loadLaborCalls(); }, []);

    /* The data for every tab is already sitting in memory after the one
       store.load() above — every tab's felt lag on first visit is the JS
       chunk itself downloading (Board/Calendar/OJT/Portfolio are all
       next/dynamic, split out of the main bundle on purpose). Warming
       those chunks in the background, once, right after Home's own paint
       is done, means the first tap on any of them resolves from cache
       instead of a fresh network round trip — the exact case ("often with
       no signal") this app can least afford a stall in. requestIdleCallback
       isn't in Safari, hence the setTimeout fallback. */
    useEffect(() => {
        if (!loaded) return;
        const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 300));
        const cancelIdle = window.cancelIdleCallback || clearTimeout;
        const id = idle(() => {
            import("@/components/apprentice/tabs/BoardTab");
            import("@/components/apprentice/tabs/CalTab");
            import("@/components/apprentice/tabs/OjtTab");
            import("@/components/ojt/PortfolioSection");
        });
        return () => cancelIdle(id);
    }, [loaded]);

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

    /* marking available/withdrawn on a labor call — optimistic, same shape
       as clearNotification: not a commitment either way, so no reason to
       wait on the round-trip before the button reflects the tap. */
    const respondToLaborCall = (laborCallId, status) => {
        setMyLaborCallStatus((prev) => ({ ...prev, [laborCallId]: status }));
        fetch("/api/labor-calls/responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ laborCallId, status }),
        }).catch(() => {});
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
    // a CJ's pay is pinned to the top of the ladder, not hours-derived —
    // everything downstream (Calendar, DaySheet, Home's gross-pay card,
    // PayRatesCard) reads off this one value, so fixing it here is the
    // whole fix, no prop-threading needed anywhere else.
    const lvIdx = profile.graduatedAt ? LEVELS.length - 1 : levelIndex(ojtTotals(ojt.months).total);
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
    .sb .hero-grid{ display: flex; flex-direction: column; gap: 10px; }
    .sb .hero-chart-plot{ width: 100%; height: 160px; }
    .sb .bgrid{ display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .sb .dcell{ height: 54px; }
    .sb .wcell{ height: 58px; }
    .sb .dnum{ font-size: 14px; }
    .sb .dcap{ font-size: 9px; }
    .sb .dcap-unit{ display: none; font-size: 10px; font-weight: 600; color: ${C.mid}; margin-left: 3px; }
    .sb .modal-ovl{ display: flex; flex-direction: column; justify-content: flex-end; }
    .sb .modal-panel{ width: 100%; max-width: 576px; margin: 0 auto; border-top-left-radius: 18px; border-top-right-radius: 18px; border-top: 1px solid ${C.edge}; max-height: 92vh; }
    @keyframes modal-fade-in{ from{ opacity: 0; } to{ opacity: 1; } }
    @keyframes modal-fade-out{ from{ opacity: 1; } to{ opacity: 0; } }
    @keyframes modal-slide-in{ from{ transform: translateY(100%); } to{ transform: translateY(0); } }
    @keyframes modal-slide-out{ from{ transform: translateY(0); } to{ transform: translateY(100%); } }
    @keyframes modal-scale-in{ from{ transform: scale(0.96); opacity: 0; } to{ transform: scale(1); opacity: 1; } }
    @keyframes modal-scale-out{ from{ transform: scale(1); opacity: 1; } to{ transform: scale(0.96); opacity: 0; } }
    .sb .modal-ovl{ animation: modal-fade-in 0.2s ease-out; }
    .sb .modal-ovl.closing{ animation: modal-fade-out 0.18s ease-in forwards; }
    .sb .modal-panel{ animation: modal-slide-in 0.2s ease-out; }
    .sb .modal-panel.closing{ animation: modal-slide-out 0.18s ease-in forwards; }
    .sb .fold-body{ display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.2s ease; }
    .sb .fold-body.open{ grid-template-rows: 1fr; }
    .sb .fold-body-inner{ overflow: hidden; opacity: 0; transition: opacity 0.15s ease; }
    .sb .fold-body.open .fold-body-inner{ opacity: 1; transition-delay: 0.05s; }
    @media (prefers-reduced-motion: reduce){
      .sb .modal-ovl, .sb .modal-panel, .sb .modal-ovl.closing, .sb .modal-panel.closing{ animation: none; }
      .sb .fold-body, .sb .fold-body-inner{ transition: none; }
    }
    @media (min-width: 900px){
      .sb .wrap{ max-width: 1280px; }
      .sb .page{ padding: 0 20px 108px; }
      .sb .navtop{ display: block; margin-bottom: 10px; }
      .sb .navbot{ display: none; }
      .sb .dgrid{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
      .sb .dspan{ grid-column: 1 / -1; }
      .sb .hero-grid{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: stretch; }
      .sb .hero-chart-card{ display: flex; flex-direction: column; }
      .sb .hero-chart-plot{ flex: 1; height: auto; min-height: 160px; }
      .sb .bgrid{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
      .sb .m4{ grid-template-columns: repeat(4, 1fr) !important; }
      .sb .dcell{ height: 84px; }
      .sb .wcell{ height: 74px; }
      .sb .htitle{ font-size: 32px !important; }
      .sb .dnum{ font-size: 14px; }
      .sb .dcap{ font-size: 10px; }
      .sb .dcap-unit{ display: inline; }
      .sb .modal-ovl{ justify-content: center; align-items: center; padding: 24px; }
      .sb .modal-panel{ max-width: 520px; max-height: 88vh; border-radius: 16px; border: 1px solid ${C.edge}; animation: modal-scale-in 0.18s ease-out; }
      .sb .modal-panel.closing{ animation: modal-scale-out 0.15s ease-in forwards; }
    }
    .sb button{ cursor: pointer; }
    .sb input, .sb textarea, .sb select{ outline: none; }
    .sb input::placeholder, .sb textarea::placeholder{ color: #565d6b; }
    .sb ::-webkit-scrollbar{ width: 6px; height: 6px; }
    .sb ::-webkit-scrollbar-thumb{ background: #2B323D; border-radius: 3px; }
    .sb .foc:focus-visible{ box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.brand}; }
    .sb .signout-btn:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
    /* Gated on the input device, not screen width — a mouse can hover, a
       touchscreen cannot, so this stays invisible on the phone-in-a-
       convention-hall case this app is built for even at a narrow width
       (a desktop browser resized small still has a real mouse and still
       gets it). transform/filter instead of background/border so it layers
       cleanly over every .foc element without a fight over its own inline
       colors. .navfoc opts a .foc element out of this treatment — the nav
       pills get their own hover (icon/label color, handled in NavBar via its
       own state) instead, since the lift/shadow read wrong on a nav bar. */
    @media (hover: hover) and (pointer: fine){
      .sb .foc{ transition: transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease; }
      .sb .foc:hover:not(:disabled){ filter: brightness(1.28); transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,0.45); }
      .sb .foc:active:not(:disabled){ transform: translateY(0); filter: brightness(1.1); }
      .sb .navfoc:hover:not(:disabled){ filter: none; transform: none; box-shadow: none; }
      .sb .navfoc:active:not(:disabled){ filter: none; transform: none; }
    }
    .sb .truncate{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sb .noscroll{ scrollbar-width:none; } .sb .noscroll::-webkit-scrollbar{ display:none; }
    @keyframes pulse-dot{ 0%, 100%{ opacity: 1; transform: scale(1); } 50%{ opacity: 0.45; transform: scale(0.8); } }
    .sb .pulse-dot{ animation: pulse-dot 1.6s ease-in-out infinite; }
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
    // CJs get the same "ojt" tab key/route (no deep-link change) but a
    // relabeled entry — there's no OJT left to track, it's a pay/certs/
    // contacts hub now.
    const baseTabs = profile.graduatedAt
        ? BASE_TABS.map((t) => (t[0] === "ojt" ? ["ojt", "Account", User] : t))
        : BASE_TABS;
    const navTabs = profile.foremanOfCompanyId ? [...baseTabs, FOREMAN_TAB] : baseTabs;

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
            <ImpersonationBanner />
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
                                        : tab === "portfolio"
                                          ? "Portfolio"
                                          : tab === "foreman"
                                            ? "Hiring"
                                            : tab === "ojt" && profile.graduatedAt
                                              ? "Account"
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
                                      (profile.graduatedAt
                                          ? "Certified Journeyman"
                                          : LEVELS[
                                                levelIndex(
                                                    ojtTotals(ojt.months).total,
                                                )
                                            ].label)
                                    : tab === "board"
                                      ? "Out-of-work list · LA & SD · " +
                                        orgProfile.outOfWorkLinePretty
                                      : tab === "cal"
                                        ? "Tap a day to log the company and your hours"
                                        : tab === "portfolio"
                                          ? "Turn the booths you've built into a shareable career record"
                                          : tab === "foreman"
                                            ? "Post a call, see who's available"
                                            : profile.graduatedAt
                                              ? "Pay, certifications & contacts"
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
                        <NavBar tab={tab} setTab={setTab} variant="top" tabs={navTabs} />
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
                        profile={profile}
                        shows={shows}
                        entries={entries}
                        ojt={ojt}
                        rates={rates}
                        bookings={bookings}
                        classes={classes}
                        certs={certs}
                        unionNotices={unionNotices}
                        hasPassword={hasPassword}
                        notifications={notifications}
                        doNotHire={doNotHire}
                        onClearNotification={clearNotification}
                        onOpenDay={(k) => setModal({ type: "day", key: k })}
                        onGoto={goto}
                        onOpenDir={() => setModal({ type: "dir" })}
                        laborCalls={laborCalls}
                        myLaborCallStatus={myLaborCallStatus}
                        onRespondLaborCall={respondToLaborCall}
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
                        unionNotices={unionNotices}
                        onOpenSummary={() => setModal({ type: "summary" })}
                        onClearMonth={clearMonth}
                        onOpenDay={(k) => setModal({ type: "day", key: k })}
                    />
                ) : tab === "ojt" ? (
                    profile.graduatedAt ? (
                        <CjAccountTab
                            ojt={ojt}
                            entries={entries}
                            rates={rates}
                            onSetRate={setRate}
                            onRemoveRate={removeRate}
                            onAddRateCo={() => setModal({ type: "ratecos" })}
                            email={email}
                            isAdmin={isAdmin}
                            profile={profile}
                            onPasswordSet={() => setHasPassword(true)}
                            onOpenWelcome={() => setModal({ type: "welcome" })}
                            pwIntent={pwIntent}
                            onPwIntentConsumed={() => setPwIntent(false)}
                            onSignOut={() =>
                                store.signOut().then(() => {
                                    window.location.href = "/login";
                                })
                            }
                            certs={certs}
                            onSaveCert={saveCert}
                        />
                    ) : (
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
                        onAvatarChange={(avatarUrl) =>
                            setProfile((p) => ({ ...p, avatarUrl }))
                        }
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
                    )
                ) : tab === "portfolio" ? (
                    <PortfolioSection standalone />
                ) : tab === "foreman" ? (
                    <ForemanTab profile={profile} shows={shows} />
                ) : (
                    <BoardTab
                        shows={shows}
                        entries={entries}
                        bookings={bookings}
                        unionNotices={unionNotices}
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
                        ) : tab === "board" ? null : tab === "foreman" ? null : tab === "ojt" && profile.graduatedAt ? null : tab === "ojt" ? (
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
                        <NavBar tab={tab} setTab={setTab} variant="bottom" tabs={navTabs} />
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
            {((needsWelcome && !modal && !profile.graduatedAt) || modal?.type === "welcome") && (
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
                        unionNotices={unionNotices}
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
