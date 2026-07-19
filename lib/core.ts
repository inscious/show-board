/* ============================================================
   core.ts — every constant, seed and pure helper. No React, no DOM.
   No personal data lives here (or anywhere the client bundle can see) —
   name, member ID, SSN last-4, OJT hours, pay rates, bookings and classes
   all live in Supabase now (see supabase/schema.sql, lib/store.js) and are
   fetched per-user at runtime. lib/personal-data.js still exists, gitignored,
   but only scripts/seed.mjs (never bundled, never deployed) reads it — to
   backfill your own historical data into your Supabase account once.

   Third-party contact info is out of here too, same reasoning: the labor/
   I&D company directory (COMPANIES) and JATC office staff (JATC.contacts)
   are real people's names and phone numbers, and this file ships in the
   public client bundle — they live in Supabase (`companies`, `jatc_contacts`)
   and get fetched per-session in lib/store.js instead.

     SHARED — same for everyone in Local 831, seeded once
       RAW_MAY / RAW_JUNE / RAW_JULY, LEVELS, CATS_META, PAY, JATC.office

   Types below describe the app's runtime data shapes (Show, Entry, Split,
   OjtMonth, Booking, Klass, Company) — they mirror the zod schemas in
   lib/schemas.ts where a route validates the same shape, but aren't
   generated from them 1:1: the local blob (what this file operates on)
   and the API POST body (what a schema validates) aren't always identical
   — e.g. an Entry here has no clock/st/ot/dt, those are derived by
   entrySplit() below, not stored on the object this file receives.
   ============================================================ */

/* ---------- constants ---------- */
export const YEAR = 2026;
/* the union's fixed RSI-credit threshold — a program rule, not personal data */
export const RSI_REQUIRED = 10;
export const UNION_LINE = "6262968075";
export const UNION_LINE_PRETTY = "(626) 296-8075";
/* the only payroll deductions confirmed flat/reliable so far — federal law,
   not company- or level-specific. Verified exact (to the cent) against 4 real
   pay stubs across 3 different companies as of 2026-07-18: Social Security
   6.2%, Medicare 1.45%, CA SDI 1.3%. Federal/CA state income tax withholding
   is genuinely progressive (climbs with gross-per-period, confirmed across
   the same stubs) and union dues scale by apprentice level — neither is
   pinned down well enough yet to hardcode, so this is deliberately a partial
   number, not a real net-pay estimate. See the paycheck-net-pay-project
   memory for the ongoing derivation. */
export const RELIABLE_PAYROLL_TAX_RATE = 0.062 + 0.0145 + 0.013;
/* no shared default — which I&D houses call an apprentice is entirely
   personal, so a brand-new account starts with nothing pinned and nothing
   highlighted as "mine" rather than guessing at one specific apprentice's
   shops (see myCompanyTokens() below for how "mine" actually gets decided
   per apprentice, from their own logged hours). */
export const DEFAULT_PINS: string[] = [];

import { Hammer, Target, Ban } from "lucide-react";
import type { ComponentType } from "react";

export const FS =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const FM =
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Roboto Mono", monospace';

export const C = {
    bg: "#0D0F13" /* page — pushed darker so cards lift off it */,
    panel: "#191D25" /* card surface */,
    sunk: "#111419" /* recessed blocks inside a card */,
    raise: "#242932" /* buttons / chips */,
    line: "#2B323D" /* hairline */,
    edge: "#3B4453" /* card border — brighter, reads as an edge */,
    hi: "#F2F5F9",
    mid: "#A7AFBD",
    lo: "#6B7383",
    brand: "#FFB020",
    working: "#2FB07A",
    passed: "#5A6070",
    gc: "#7FB2FF",
    danger: "#E8927C",
};
export const SHADOW =
    "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 14px rgba(0,0,0,0.45)";

/* ---------- shared domain types ---------- */
export type Show = {
    id: string;
    mi?: string | null;
    start?: string | null;
    end?: string | null;
    name: string;
    loc?: string | null;
    booth?: string | null;
    co?: string | null;
    region?: string | null;
    status?: "working" | "target" | "passed" | null;
    note?: string;
    src?: string;
    sheetMonth?: string;
};

export type Entry = {
    id?: string;
    co: string;
    cat?: string | null;
    note?: string | null;
    hrs?: number | null;
    in?: number | null;
    out?: number | null;
    brk?: number | null;
    // a flat dollar stipend, not rate x hours — every pay stub analyzed shows
    // it as its own line, inconsistent even by hours worked, so it's a
    // straight add to gross rather than folded into the ST/OT/DT split.
    travel?: number | null;
};

export type EntriesByDay = Record<string, Entry[]>;

/* {st,ot,dt} on their own (shiftSplit/takeBreak) vs. the fuller entrySplit()
   result that also carries clock/timed/holiday/guarantee — kept as two
   types since not every caller has (or needs) the extra fields. */
export type Hours = { st: number; ot: number; dt: number };
export type Split = Hours & {
    clock: number;
    timed: boolean;
    holiday: string | null;
    guarantee: number;
};
type SplitLike = Hours & { clock?: number; guarantee?: number };

export type Level = {
    k: string;
    label: string;
    hrs: number;
    pay: number;
    hrsEst: boolean;
    payEst: boolean;
    src?: string;
    goal?: boolean;
};

export type OjtMonth = {
    m: string;
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    status?: string;
};

export type Company = {
    n: string;
    city?: string;
    st?: string;
    tel?: string;
    fm?: string;
};
/* matchCo's return shape uses name/fm/city/tel — distinct from Company (n/fm/city/tel),
   since it's mapping a directory hit (or the hardcoded union-dispatch case) into what
   the UI actually renders, not returning a directory row verbatim. */
type MatchedCo = {
    name: string;
    fm?: string;
    city?: string;
    tel?: string;
    union?: boolean;
};

export type Booking = {
    id: string;
    co: string;
    show?: string;
    note?: string;
    dates: string[];
    dayNotes?: Record<string, string>;
};

export type Klass = {
    id: string;
    name: string;
    start?: number | null;
    loc?: string;
    note?: string;
    dates: string[];
    missedDates?: string[];
};

/* stable per-company colour — hue-spread so two shops never land on the same swatch,
   and never on a colour the calendar uses to mean something */
export function hsl2hex(h: number, sat: number, li: number): string {
    const a = (sat / 100) * Math.min(li / 100, 1 - li / 100);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const v =
            li / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * v)
            .toString(16)
            .padStart(2, "0");
    };
    return "#" + f(0) + f(8) + f(4);
}
export function coColor(n: string | null | undefined): string {
    let h = 0;
    const s = String(n || "");
    for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0;
    return hsl2hex((h * 47) % 360, 62, 68);
}
/* open the phone's default maps app */
export function mapsUrl(addr: string | null | undefined): string {
    const q = encodeURIComponent(addr || "");
    const ios =
        typeof navigator !== "undefined" &&
        /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || "");
    return ios
        ? "https://maps.apple.com/?q=" + q
        : "https://www.google.com/maps/search/?api=1&query=" + q;
}

export const STATUS: Record<
    "working" | "target" | "passed",
    { label: string; color: string; Icon: ComponentType<{ size?: number }> }
> = {
    working: { label: "Working", color: C.working, Icon: Hammer },
    target: { label: "Target", color: C.brand, Icon: Target },
    passed: { label: "Passed", color: C.passed, Icon: Ban },
};

export const REGION: Record<string, { label: string; color: string }> = {
    SD: { label: "SD", color: "#43BFB2" },
    LA: { label: "LA", color: "#B49BF0" },
    LB: { label: "LB", color: "#6FA8E8" },
    OC: { label: "OC", color: "#D2A574" },
    PS: { label: "PS", color: "#E38FB8" },
    OTHER: { label: "•", color: "#8A93A3" },
};
export const REGION_KEYS = ["SD", "LA", "LB", "OC", "PS", "OTHER"];
export const MONTHS = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
];

/* ---------- date helpers ---------- */
export function mkDate(
    md: string | null | undefined,
    year: number,
): Date | null {
    if (!md) return null;
    const p = String(md).split("/");
    if (p.length < 2) return null;
    const mo = parseInt(p[0], 10),
        d = parseInt(p[1], 10);
    if (!mo || !d) return null;
    return new Date(year, mo - 1, d);
}
export function todayMid(): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
/* every show date on the sheet is printed as bare "M/D" — no year. The sheet
   itself (`sheetMonth`, "YYYY-MM") is the only place the real year survives
   past import, so date math on a show always derives its year from there
   instead of assuming the single global YEAR — that assumption breaks the
   instant the roster spans more than one calendar year. */
export function showYear(s?: { sheetMonth?: string | null } | null): number {
    const sm = String(s?.sheetMonth || "");
    const y = parseInt(sm.slice(0, 4), 10);
    return y || YEAR;
}
export function sortDate(s: Show): Date {
    return (
        mkDate(s.mi, showYear(s)) ||
        mkDate(s.start, showYear(s)) ||
        new Date(YEAR, 11, 31)
    );
}
export function endDate(s: Show): Date {
    return (
        mkDate(s.end, showYear(s)) ||
        mkDate(s.start, showYear(s)) ||
        sortDate(s)
    );
}
export function isPast(s: Show): boolean {
    return endDate(s) < todayMid();
}
export function monthLabel(s: Show): string {
    const d = mkDate(s.start, showYear(s)) || mkDate(s.mi, showYear(s));
    return d ? MONTHS[d.getMonth()] + " " + d.getFullYear() : "SCHEDULED";
}
export function fmtTel(d: string | number | null | undefined): string {
    if (!d) return "";
    const s = ("" + d).replace(/\D/g, "");
    if (s.length === 10)
        return "(" + s.slice(0, 3) + ") " + s.slice(3, 6) + "-" + s.slice(6);
    return "" + d;
}

/* ---------- calendar helpers ---------- */
export const DOW = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_LONG = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
export function keyOf(d: Date): string {
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}
export function fromKey(k: string): Date {
    const p = String(k).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}
export function sameDay(
    a: Date | null | undefined,
    b: Date | null | undefined,
): boolean {
    return !!(a && b && a.getTime() === b.getTime());
}
export function longDate(d: Date): string {
    return (
        DAY_LONG[d.getDay()] +
        ", " +
        MONTHS[d.getMonth()].charAt(0) +
        MONTHS[d.getMonth()].slice(1).toLowerCase() +
        " " +
        d.getDate()
    );
}
export function monthGrid(y: number, m: number): Date[] {
    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + days) / 7);
    const cells: Date[] = [];
    for (let i = 0; i < weeks * 7; i++)
        cells.push(new Date(y, m, 1 - first.getDay() + i));
    return cells;
}
/* a show occupies every day from move-in through end */
export function showSpan(s: Show): [Date | null, Date | null] {
    const a = mkDate(s.mi, showYear(s)) || mkDate(s.start, showYear(s));
    const b = mkDate(s.end, showYear(s)) || mkDate(s.start, showYear(s)) || a;
    return [a, b];
}
export function showsOn(shows: Show[], d: Date): Show[] {
    return shows.filter((s) => {
        const sp = showSpan(s);
        return !!(sp[0] && sp[1] && d >= sp[0] && d <= sp[1]);
    });
}
/* flagged shows paint the calendar: working wins over target */
export function statusOn(shows: Show[], d: Date): "working" | "target" | null {
    let out: "working" | "target" | null = null;
    showsOn(shows, d).forEach((s) => {
        if (s.status === "working") out = "working";
        else if (s.status === "target" && out !== "working") out = "target";
    });
    return out;
}
/* month bucket a show belongs to, as a sortable integer */
export function monthKey(s: Show): number {
    const d = mkDate(s.start, showYear(s)) || mkDate(s.mi, showYear(s));
    return d ? d.getFullYear() * 12 + d.getMonth() : 999999;
}
export function monthKeyNow(): number {
    const t = todayMid();
    return t.getFullYear() * 12 + t.getMonth();
}
export function labelFromKey(k: number): string {
    return MONTHS[k % 12] + " " + Math.floor(k / 12);
}
export function daysUntil(d: Date | null | undefined): number | null {
    return d
        ? Math.round((d.getTime() - todayMid().getTime()) / 86400000)
        : null;
}
export function countdown(s: Show): { t: string; c: string } | null {
    const mi = mkDate(s.mi, showYear(s)) || mkDate(s.start, showYear(s));
    const end = endDate(s);
    if (!mi) return null;
    const n = daysUntil(mi);
    if (todayMid() >= mi && todayMid() <= end)
        return { t: "ON FLOOR", c: C.working };
    if (n === 0) return { t: "MOVE-IN TODAY", c: C.brand };
    if (n === 1) return { t: "MOVE-IN TMRW", c: C.brand };
    if (n !== null && n > 1 && n <= 10) return { t: "IN " + n + "D", c: C.mid };
    return null;
}
export function hrsFmt(h: number | string | null | undefined): string {
    const n = Number(h) || 0;
    return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/* ---------- region detection ---------- */
export function detectRegion(loc: string | null | undefined): string {
    const s = (loc || "").toUpperCase();
    const has = (x: string) => s.indexOf(x) !== -1;
    if (has("LA JOLLA") || has("LA COSTA")) return "SD";
    if (
        has("SDCC") ||
        has("SAN DIEGO") ||
        has(" SD") ||
        s.indexOf("SD ") === 0 ||
        has("MISSION VALLEY") ||
        has("TOWN & COUNTRY") ||
        has("T & C") ||
        has("T&C") ||
        has("MANCHESTER") ||
        has("BAYFRONT") ||
        has("CORONADO") ||
        has("DEL MAR") ||
        has("RANCHO BERNARDO") ||
        has("CARLSBAD") ||
        has("CHULA VISTA") ||
        has("GAYLORD") ||
        has("FRONTWAVE") ||
        has("OCEANSIDE") ||
        has("PARADISE POINT") ||
        has("PARADISE RESORT")
    )
        return "SD";
    if (
        has("LACC") ||
        has("LA LIVE") ||
        has("LOS ANGELES") ||
        has("BURBANK") ||
        has("PASADENA") ||
        has("DTLA") ||
        has("HOLLYWOOD") ||
        has("SO FI") ||
        has("SOFI") ||
        has("INGLEWOOD")
    )
        return "LA";
    if (has("LBCC") || has("LONG BEACH")) return "LB";
    if (
        has("ACC") ||
        has("ANAHEIM") ||
        has("DISNEY") ||
        has("GARDEN GROVE") ||
        has("ORANGE COUNTY") ||
        has(" OC") ||
        has("COSTA MESA") ||
        has("IRVINE") ||
        has("ORANGE")
    )
        return "OC";
    if (
        has("PALM SPRINGS") ||
        has("PALM DESERT") ||
        has("COACHELLA") ||
        has("INDIAN WELLS") ||
        has("D. SPRINGS") ||
        has("DESERT SPRINGS")
    )
        return "PS";
    return "OTHER";
}
/* distinct company "tokens" this apprentice has actually logged hours for —
   e.g. "Willwork Inc." -> "WILLWORK" — so isMine() below reflects whoever's
   actually calling THIS apprentice, not one specific person's shops. Only
   keeps tokens long enough (4+ chars) to be a meaningful match, not "LLC"/
   generic filler words. */
export function myCompanyTokens(
    entries: EntriesByDay | null | undefined,
): string[] {
    const seen = new Set<string>();
    Object.values(entries || {}).forEach((day) => {
        (day || []).forEach((e) => {
            const word = (e.co || "").trim().split(/\s+/)[0]?.toUpperCase();
            if (word && word.length >= 4) seen.add(word);
        });
    });
    return [...seen];
}
export function isMine(
    co: string | null | undefined,
    myCompanies?: string[],
): boolean {
    const u = (co || "").toUpperCase();
    const list = myCompanies && myCompanies.length ? myCompanies : [];
    return list.some((m) => u.indexOf(m) !== -1);
}

/* map a schedule "COMPANY" token to a directory entry (general contractor lookup) */
export const CO_ALIAS: Record<string, string> = {
    SHEPARD: "Shepard Exposition Services",
    INNOVATIVE: "Innovative Expo",
    "SHOW READY": "Show Ready",
    T3: "T3 Expo",
    FERN: "Fern Expo",
    UPA: "Union Payroll Agency",
    EAGLE: "Eagle Management Group",
    WILLWORK: "Willwork Inc.",
    CZARNOWSKI: "Czarnowski Display Serv",
    "NTH DEGREE": "Nth Degree",
    GALAXY: "Galaxy Labor Force",
    MOMENTUM: "Momentum Management",
    NIRVANA: "Nirvana Expo Services",
    OCTANE: "Octane Group",
    TRICORD: "Tricord Tradeshow Services",
    "SHO-LINK": "Sho-Link",
    "TOTAL EXPO": "Total Expo",
    SPIRO: "Spiro",
    "SPIRO / GES": "Spiro",
    "ALL EXHIBIT SOLUTIONS": "All Exhibits Solutions",
    "STEELE TRADESHOW": "Steele Tradeshow Services",
    XIME: "Xime Solutions Group",
};
export function findCo(
    name: string | null | undefined,
    companies: Company[] | null | undefined,
): Company | null {
    return (companies || []).find((c) => c.n === name) || null;
}
/* companies (the labor/I&D directory) now lives in Supabase, not here — see
   lib/store.js. Freeman/GES used to get hardcoded named-rep branches with
   their direct numbers baked into this file; that's exactly the kind of
   real-person data that shouldn't sit in a public repo, and it turned out
   redundant anyway — the directory already carries "(SD)"/"(LA)" variants
   for both, so a plain region-aware lookup covers the same ground. */
export function matchCo(
    co: string | null | undefined,
    region: string | null | undefined,
    companies: Company[] | null | undefined,
): MatchedCo | null {
    const up = (co || "").toUpperCase().trim();
    if (!up || up === "TBD") return null;
    if (up.indexOf("PLA") === 0 || up.indexOf("LU 831") !== -1)
        return {
            name: "LU 831 Dispatch",
            fm: "Union hall",
            city: "",
            tel: UNION_LINE,
            union: true,
        };
    const list = companies || [];
    const alias = CO_ALIAS[up];
    if (alias) {
        const c = findCo(alias, list);
        if (c) return { name: c.n, fm: c.fm, city: c.city, tel: c.tel };
    }
    const matches =
        up.length >= 3
            ? list.filter((c) => c.n.toUpperCase().indexOf(up) !== -1)
            : [];
    const regional =
        region &&
        matches.find(
            (c) => c.n.toUpperCase().indexOf("(" + region + ")") !== -1,
        );
    const c2 = regional || matches[0];
    if (c2) return { name: c2.n, fm: c2.fm, city: c2.city, tel: c2.tel };
    return null;
}

/* ---------- seed data: Local 831 JULY 2026 schedule ---------- */
export const RAW_JULY: string[][] = [
    ["6/25", "6/28", "6/29", "BO & MA", "LBCC", "A-C", "FREEMAN"],
    ["6/27", "6/30", "7/3", "SERVPRO", "SDCC", "160", "UPA"],
    ["6/27", "7/2", "7/5", "ANIME EXPO", "LACC", "FULL FACILITY", "SHEPARD"],
    ["7/1", "7/3", "7/7", "ACL", "GRAND HYATT SD", "27", "INNOVATIVE"],
    ["7/7", "7/10", "7/11", "SCCT", "GAYLORD", "60", "SHEPARD"],
    [
        "7/9",
        "7/10",
        "7/13",
        "TATTOO ART FESTIVAL",
        "LBCC",
        "TBD",
        "PLA - LU 831",
    ],
    ["7/6", "7/14", "7/16", "ESRI", "SDCC", "A-F", "FREEMAN"],
    ["7/14", "7/15", "7/17", "SHORE CONSULTING", "GAYLORD", "30", "FREEMAN"],
    ["7/14", "7/17", "7/19", "WEST COAST CARD SHOW", "ACC", "D", "SHOW READY"],
    ["7/17", "7/18", "7/20", "AACS", "HYATT OC", "50", "FREEMAN"],
    ["7/18", "7/18", "7/19", "USAGING", "MARRIOTT SD", "70", "INNOVATIVE"],
    ["7/15", "7/19", "7/20", "NACUB", "ACC", "A / 132", "GES"],
    ["7/19", "7/20", "7/21", "PVPC", "ANAHEIM HILTON", "18", "GES"],
    ["7/15", "7/21", "7/23", "SIGGRAPH", "LACC", "150", "FREEMAN"],
    ["7/18", "7/23", "7/28", "COMIC CON", "SDCC", "FULL FACILITY", "FREEMAN"],
    ["7/23", "7/27", "7/30", "DAC", "LBCC", "A-B / 150", "T3"],
    ["7/22", "7/28", "7/30", "AD & LM", "ACC", "A-E", "FREEMAN"],
    ["7/25", "7/28", "7/29", "PCBC", "GAYLORD", "250", "FERN"],
    [
        "7/27",
        "7/28",
        "7/30",
        "INMAN - CONNECT",
        "MARRIOTT MARQUIS SD",
        "30",
        "FREEMAN",
    ],
    ["7/27", "8/1", "8/7", "NALC", "LACC", "SOUTH", "FREEMAN"],
    ["8/6", "8/14", "8/16", "D23", "ACC", "FULL FACILITY / SPECIAL", "FREEMAN"],
];
export const RAW_MAY: string[][] = [
    ["4/25", "4/28", "4/29", "HDA TRUCK PRIDE", "GAYLORD", "130", "FREEMAN"],
    ["4/26", "4/28", "4/29", "SVC", "LBCC", "A / 210", "FREEMAN"],
    [
        "4/27",
        "4/29",
        "4/30",
        "BOOST",
        "PALM SPRINGS CC",
        "230",
        "STEELE TRADESHOW",
    ],
    ["4/28", "5/2", "5/5", "ARVO", "SDCC", "D-H / 300", "FREEMAN"],
    ["5/1", "5/3", "5/5", "AAAE", "LACC", "WEST / 165", "FREEMAN"],
    ["4/30", "5/4", "5/4", "EDGE", "GAYLORD", "209", "FREEMAN"],
    ["4/29", "5/5", "5/7", "SALESFORCE", "SDCC", "A-H", "FREEMAN"],
    ["4/30", "5/5", "5/7", "ATLASSIAN", "ACC", "SPECIAL", "FREEMAN"],
    ["5/1", "5/5", "5/7", "DISPLAY WEEK", "LACC", "SOUTH / 300", "FREEMAN"],
    ["5/3", "5/5", "5/6", "NSAA", "OMNI LA COSTA", "110", "FERN"],
    ["5/3", "5/5", "5/7", "FINOVS", "SD SHERATON", "70", "GES"],
    ["5/4", "5/5", "5/6", "PET FOODS", "DISNEYLAND HOTEL", "100", "TRICORD"],
    ["5/5", "5/7", "5/8", "NAYDO", "LBCC", "127", "XIME"],
    ["5/7", "5/8", "5/9", "PIZZA HUT", "GAYLORD", "100", "FREEMAN"],
    ["5/11", "5/12", "5/12", "IDAY", "SD T & C", "75", "TRICORD"],
    ["5/10", "5/14", "5/16", "CDA", "ACC", "C-D / 468", "GES"],
    [
        "5/13",
        "5/14",
        "5/15",
        "CORELATION",
        "SD GRAND HYATT",
        "70",
        "INNOVATIVE",
    ],
    [
        "5/15",
        "5/15",
        "5/16",
        "NATIONAL UNIVERSITY",
        "FRONTWAVE ARENA",
        "SPECIAL",
        "INNOVATIVE",
    ],
    ["5/13", "5/17", "5/20", "ATD", "LACC", "700", "FREEMAN"],
    ["5/14", "5/17", "5/19", "BLICON", "GAYLORD", "SPECIAL", "GES"],
    [
        "5/17",
        "5/18",
        "5/21",
        "CFED",
        "RENAISSANCE INDIAN WELLS",
        "81",
        "INNOVATIVE",
    ],
    ["5/13", "5/19", "5/20", "AACCN", "SDCC", "445", "FREEMAN"],
    ["5/18", "5/19", "5/20", "CCC", "HYATT ORANGE", "100", "TRICORD"],
    ["5/18", "5/19", "5/20", "CSDA", "SD T & C", "20", "INNOVATIVE"],
    ["5/18", "5/19", "5/20", "CCISDA", "SD T & C", "60", "TRICORD"],
    ["5/26", "5/27", "5/30", "IFFM", "SD HYATT REGENCY", "118", "GES"],
    ["5/26", "5/27", "5/27", "ASTA", "GAYLORD", "223", "GES"],
];
export const RAW_JUNE: string[][] = [
    ["5/25", "5/30", "6/2", "SNNMI", "LACC", "SOUTH", "ALL EXHIBIT SOLUTIONS"],
    ["5/29", "5/31", "6/4", "ASMS", "SDCC", "180", "FREEMAN"],
    ["5/29", "6/1", "6/3", "ASMS", "MARRIOTT MARQUIS SD", "180", "FREEMAN"],
    ["6/2", "6/2", "6/2", "SDCCE", "SD T & C", "SET & GO", "INNOVATIVE"],
    ["5/31", "6/2", "6/4", "REALCOMM - IBCON", "SDCC", "H / 132", "FREEMAN"],
    [
        "6/2",
        "6/3",
        "6/4",
        "MEGA RUST",
        "MARRIOTT MISSION VALLEY",
        "50",
        "TRICORD",
    ],
    ["6/1", "6/3", "6/4", "SPACE", "ACC", "357 / A", "GES"],
    [
        "6/3",
        "6/4",
        "6/6",
        "VISION TRENDS",
        "GRAND HYATT SD",
        "55",
        "INNOVATIVE",
    ],
    [
        "6/1",
        "6/6",
        "6/10",
        "MILLION DOLLAR ROUND TABLE",
        "ACC",
        "C / SPECIAL",
        "FREEMAN",
    ],
    ["6/7", "6/8", "6/10", "SUSTAINABLE CONF", "SD T & C", "30", "FREEMAN"],
    ["6/9", "6/9", "6/11", "CACTTC", "LOEWS HOLLYWOOD", "50", "TRICORD"],
    ["6/6", "6/10", "6/12", "AWSALA", "LACC", "SOUTH / SPECIAL", "SPIRO / GES"],
    ["6/8", "6/10", "6/11", "GOVERNMENT FLEET EXPO", "LBCC", "150", "SHEPARD"],
    [
        "5/13",
        "6/11",
        "7/19",
        "WORLD CUP",
        "SO FI STADIUM",
        "SPECIAL",
        "FREEMAN",
    ],
    ["6/5", "6/11", "6/12", "AIA", "SDCC", "1764", "FREEMAN"],
    ["6/12", "6/13", "6/14", "LA CARD SHOW", "LACC", "WEST", "SHOW READY"],
    ["6/11", "6/15", "6/17", "ASSP", "ACC", "A-E / 700", "FREEMAN"],
    ["6/14", "6/15", "6/16", "GWIC", "SD T & C", "22", "INNOVATIVE"],
    ["6/12", "6/15", "6/18", "AWE", "LBCC", "C-B / 135", "SHOW READY"],
    ["6/14", "6/16", "6/18", "SMME", "ANAHEIM MARRIOTT", "160", "FREEMAN"],
    ["6/15", "6/17", "6/20", "AILA", "MARRIOTT MARQUIS SD", "130", "FREEMAN"],
    ["6/15", "6/17", "6/18", "PIP", "SHERATON SD", "75", "FREEMAN"],
    ["6/17", "6/18", "6/20", "ABS", "LA LIVE", "20", "INNOVATIVE"],
    ["6/19", "6/21", "6/23", "EDTA", "LBCC", "150", "FREEMAN"],
    ["6/16", "6/22", "6/25", "BIO 2026", "SDCC", "1664", "FREEMAN"],
    ["6/20", "6/22", "6/24", "STP", "SD PARADISE RESORT", "16", "SHEPARD"],
    ["6/22", "6/23", "6/24", "NATSSC", "MARRIOTT D. SPRINGS", "84", "GES"],
    ["6/21", "6/25", "6/27", "VIDCON", "ACC", "A-E", "FREEMAN"],
    [
        "6/23",
        "6/25",
        "6/27",
        "WESTERN FOOT & ANKLE",
        "DISNEYLAND HOTEL",
        "150",
        "FREEMAN",
    ],
];

export let _idc = 0;
export function mkShow(r: string[], src: string): Show {
    const [mi, start, end, name, loc, booth, co] = r;
    return {
        id: "s" + _idc++,
        mi,
        start,
        end,
        name,
        loc,
        booth,
        co,
        region: detectRegion(loc),
        status: null,
        note: "",
        src,
    };
}
export function showKey(s: Show): string {
    return ((s.name || "") + "|" + (s.start || "")).toUpperCase().trim();
}
/* the sheets overlap month to month (WORLD CUP, ASMS, BO & MA...) — keep one of each */
export const SEED: Show[] = (() => {
    const seen: Record<string, 1> = {};
    const out: Show[] = [];
    RAW_MAY.concat(RAW_JUNE, RAW_JULY).forEach((r) => {
        const s = mkShow(r, "union");
        const k = showKey(s);
        if (seen[k]) return;
        seen[k] = 1;
        out.push(s);
    });
    return out;
})();
/* fold any schedule rows the board hasn't seen yet into a saved board, without touching saved state */
export function mergeSeed(saved: Show[]): Show[] {
    const seen: Record<string, 1> = {};
    saved.forEach((s) => {
        seen[showKey(s)] = 1;
    });
    const add = SEED.filter((s) => !seen[showKey(s)]);
    return add.length ? saved.concat(add) : saved;
}

/* July union dates & dues (from the posted July 2026 sheet) */
export const JULY_NOTES: Array<[string, string, string]> = [
    ["FRI JUL 3", "Independence Day — observed union holiday", C.passed],
    [
        "WED JUL 15",
        "Monthly meeting · 6:00 PM · 14930 Marquardt Ave, Santa Fe Springs",
        C.brand,
    ],
    [
        "THU JUL 16",
        "Informational meeting · 5:30 PM · 6225 Federal Blvd, San Diego",
        C.brand,
    ],
    ["JUL 31", "3rd-quarter dues due", C.working],
];

/* ---------- apprenticeship / OJT ---------- */
export const MON_FULL = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/* the JATC office and the rules that get you put on the do-not-hire list */
/* office address only — real names/numbers for the office staff are
   admin-managed in Supabase now (jatc_contacts), not committed here. */
export const JATC = {
    office: "14930 Marquardt Ave, Santa Fe Springs, CA 90670",
};

/* Static reference content from the JATC Rules & Regulations packet —
   program rules, not per-apprentice data, so this lives here the same way
   CATS_META/LEVELS do rather than in Supabase. No real staff names or
   direct phone numbers are stored here on purpose (see jatc_contacts,
   surfaced via DirectoryContext) — the DAS line/address is a public state
   agency, not a person, so it's fine to include. */
export type JatcRuleSection = { id: string; title: string; points: string[] };
export const JATC_RULES: JatcRuleSection[] = [
    {
        id: "program",
        title: "Program structure",
        points: [
            "3-year apprenticeship — 3,600 total OJT hours, 480 total RSI hours.",
            "The JATC may change program content or term at its sole discretion, without notice.",
        ],
    },
    {
        id: "probation",
        title: "Probationary period",
        points: [
            "The first 6 months and the first 600 OJT hours both count as probation.",
            "During probation: the full Tool Checklist, OJT hour targets, and related-instruction attendance are all required.",
            "Falling short during probation can cancel the Apprentice Agreement with no formal hearing and no right of appeal — those protections only start once probation is complete.",
        ],
    },
    {
        id: "wage",
        title: "Wage advancement",
        points: [
            "A level increase needs all three: 600 OJT hours since the last increase, a satisfactory OJT performance rating, and 80 RSI hours completed at the current level.",
            "Hours alone don't trigger an increase — RSI at that level is a separate gate. Meeting the hours without the RSI hours holds you at your current level.",
        ],
    },
    {
        id: "ojt-deadline",
        title: "OJT slip deadlines & discipline",
        points: [
            "Due monthly, worked or not — by 4:00 PM on the 1st of the following month (the next workday if that date lands on a weekend/holiday).",
            "Needs your employer's or supervisor's signature. Your own signature is accepted only if you were unemployed or on disability that month.",
            "Email submissions need a confirmation reply back or they're marked late; slips can also be turned in at related-instruction classes. Handing the slip to your employer to sign doesn't end your responsibility to get it to the JATC office.",
            "First offense: a warning letter is mailed — the delinquent slip is due within 1 week of that letter's date, or you risk being cited before the Committee.",
            "Each additional offense: immediate placement on the Do Not Hire List. Once the slip is received you're eligible for work again starting that Friday, but you're still cited to the next JATC meeting — missing that meeting's deadline too can mean being dropped from the program.",
        ],
    },
    {
        id: "rsi",
        title: "Related & Supplemental Instruction (RSI)",
        points: [
            "480 hours total over 3 years — 160 hours per year, split into 4 quarters of 40 hours each.",
            "80 hours completed at your current level makes you eligible to advance to the next period.",
            "Semesters typically start early February and early August. If the schedule hasn't reached you before the first class day, it's on you to contact the JATC office.",
        ],
    },
    {
        id: "attendance",
        title: "Attendance & grading",
        points: [
            "Classes start 8:00 AM. Tardy after 8:00; sent home (and rescheduled) if later than 8:05.",
            "2 tardies allowed per semester — a 3rd counts as an absence and can get you asked to leave.",
            "1st unexcused absence (class or OJT) may be cited before the Committee. A 2nd may be cited again.",
            "An excused absence needs a makeup arranged with the Coordinator.",
            "Passing grade is a C or better plus 70%+ on the final, each semester. Failing pushes your next advancement back 6 months and the class must be retaken.",
            "Missing the final without a valid excuse counts as absent; a makeup is scheduled on a regular workday (M–F, 7:30am–4pm) — missing that too is an automatic F for the entire semester.",
        ],
    },
    {
        id: "journey-out",
        title: "Journey Out evaluation",
        points: [
            "Must be signed up for and completed within 90 days of finishing your last class.",
            "Missing that 90-day window means being cited before the Committee.",
        ],
    },
    {
        id: "leave",
        title: "Leave of absence",
        points: [
            "Up to 6 months, any reason — full credit for prior OJT hours and school credits is retained.",
            "Re-entry must happen before the Committee-set deadline, or you risk being dropped from the program (with the option to petition the Committee for reinstatement and level).",
        ],
    },
    {
        id: "out-of-area",
        title: "Out-of-jurisdiction work",
        points: [
            "Sent out of the area and can't make an RSI class? Notify the Coordinator before you leave town so a makeup class can be arranged.",
        ],
    },
    {
        id: "prior-credit",
        title: "Credit for prior trade experience",
        points: [
            "Submit in person at a regular JATC meeting: an employer letter on letterhead stating dates and type of work performed, or prior JATC records if you were indentured elsewhere before.",
        ],
    },
    {
        id: "dispatch",
        title: "Work status / dispatch",
        points: [
            "A monthly Show Schedule lists every show for the month with the employer list on the back — you call to get scheduled.",
            "JATC sends a weekly out-of-work list to every employer. Getting on it while unemployed, and telling JATC once you're scheduled to get off it, is on you — staying current on it improves your odds of getting called.",
            "Once on the list you can open an unemployment claim with EDD and collect for weeks you attend training.",
        ],
    },
    {
        id: "mileage",
        title: "Class mileage reimbursement",
        points: [
            "Live outside a 75-mile radius of the training office? You're eligible for mileage beyond that first 75 each way, per class attended.",
            "A mileage form is required per class, verified by JATC staff, based on the drive from your residence to the training center.",
        ],
    },
    {
        id: "conduct",
        title: "Conduct & discipline",
        points: [
            "Once probation is done, you can't be terminated without a hearing, written notice by mail, and the right to appear before the Committee.",
            "If your Agreement is canceled: up to a 6-month wait to reapply, possibly needing Committee permission and re-passing current application/probation requirements. Prior hours/credits may be restored at the JATC's discretion.",
        ],
    },
    {
        id: "appeals",
        title: "Appeal rights",
        points: [
            "1. Contact the program Coordinator immediately.",
            "2. Still unresolved? Ask to be put on the agenda for the next JATC meeting.",
            "3. To appeal a JATC decision, contact your Local's Coordinator within 30 days — see the JATC office contacts below for current numbers.",
            "4. Still unsatisfied? File a written grievance with the CA Division of Apprenticeship Standards within 30 days — (213) 576-7750, or 525 Golden Gate Ave, 5th Floor, P.O. Box 603, San Francisco, CA 94102.",
            "Filing an appeal does not pause any disciplinary action already in motion.",
        ],
    },
    {
        id: "safety",
        title: "Safety & conduct basics",
        points: [
            "CPR/First-Aid and OSHA training are required within 6 months of your indenture date.",
            "No drugs or alcohol on premises or while impaired. No cell phones/radios during class hours.",
            "Dress code: no sandals, skirts/dresses, scarves, neckties, hair ornaments (except to secure hair), or jewelry. Full PPE compliance at all times.",
            "Report every accident or unsafe condition to the Coordinator immediately.",
        ],
    },
];

/* The full 3-year, 61-class curriculum — a static reference, not tied to
   the classes table (that's admin-assigned sessions with real dates; this
   is "which classes exist," no per-apprentice completion state yet since
   there's no reliable link between classNumber and a scheduled class's
   free-text name). */
export type CurriculumClass = {
    classNumber: number;
    description: string;
    courseId: number;
    category: string;
};
export const JATC_CURRICULUM: { years: Record<"1" | "2" | "3", CurriculumClass[]> } = {
    years: {
        "1": [
            { classNumber: 1, description: "Basics I", courseId: 100, category: "Basics" },
            { classNumber: 2, description: "Basics II", courseId: 101, category: "Basics" },
            { classNumber: 3, description: "Basics III", courseId: 102, category: "Basics" },
            { classNumber: 4, description: "Union History", courseId: 55, category: "Union/Orientation" },
            { classNumber: 5, description: "Carpet", courseId: 110, category: "Trade Skills" },
            { classNumber: 6, description: "Forklift/Scissor Lift extra drive", courseId: 25, category: "Equipment Certification" },
            { classNumber: 7, description: "Forklift/Genie-Lift", courseId: 140, category: "Equipment Certification" },
            { classNumber: 8, description: "CPR/First-Aid", courseId: 135, category: "Safety Certification" },
            { classNumber: 9, description: "OSHA I", courseId: 130, category: "Safety Certification" },
            { classNumber: 10, description: "OSHA II", courseId: 230, category: "Safety Certification" },
            { classNumber: 11, description: "Customer Service/Sexual Harassment", courseId: 120, category: "Soft Skills" },
            { classNumber: 12, description: "Team Building/Leadership", courseId: 150, category: "Soft Skills" },
            { classNumber: 13, description: "Communications (CTA)", courseId: 151, category: "Soft Skills" },
            { classNumber: 14, description: "Intro To Rigging", courseId: 450, category: "Rigging" },
            { classNumber: 15, description: "Lift Training", courseId: 175, category: "Equipment Certification" },
            { classNumber: 16, description: "Custom Booth I", courseId: 350, category: "Custom Booth" },
            { classNumber: 17, description: "Custom Booth II", courseId: 360, category: "Custom Booth" },
            { classNumber: 18, description: "Custom Booth III", courseId: 365, category: "Custom Booth" },
            { classNumber: 19, description: "Custom Booth IV", courseId: 145, category: "Custom Booth" },
            { classNumber: 20, description: "Custom Booth V", courseId: 180, category: "Custom Booth" },
            { classNumber: 21, description: "Custom Booth VI", courseId: 185, category: "Custom Booth" },
            { classNumber: 22, description: "Custom Booth VII", courseId: 195, category: "Custom Booth" },
            { classNumber: 23, description: "Custom Booth VIII", courseId: 240, category: "Custom Booth" },
        ],
        "2": [
            { classNumber: 24, description: "Graphics I", courseId: 250, category: "Graphics" },
            { classNumber: 25, description: "Graphics II", courseId: 255, category: "Graphics" },
            { classNumber: 26, description: "Graphics III", courseId: 260, category: "Graphics" },
            { classNumber: 27, description: "Graphics IV", courseId: 265, category: "Graphics" },
            { classNumber: 28, description: "Graphics V", courseId: 115, category: "Graphics" },
            { classNumber: 29, description: "Power Tools I", courseId: 300, category: "Power Tools" },
            { classNumber: 30, description: "Power Tools II", courseId: 305, category: "Power Tools" },
            { classNumber: 31, description: "Power Tools III", courseId: 310, category: "Power Tools" },
            { classNumber: 32, description: "Power Tools IV", courseId: 315, category: "Power Tools" },
            { classNumber: 33, description: "Power Tools V", courseId: 320, category: "Power Tools" },
            { classNumber: 34, description: "Power Tools VI", courseId: 325, category: "Power Tools" },
            { classNumber: 35, description: "Power Tools VII", courseId: 330, category: "Power Tools" },
            { classNumber: 36, description: "Power Tools VIII", courseId: 340, category: "Power Tools" },
            { classNumber: 37, description: "Power Tools IX", courseId: 345, category: "Power Tools" },
            { classNumber: 38, description: "Power Tools X", courseId: 355, category: "Power Tools" },
            { classNumber: 39, description: "Custom Booth IX", courseId: 370, category: "Custom Booth" },
            { classNumber: 40, description: "Custom Booth X", courseId: 375, category: "Custom Booth" },
            { classNumber: 41, description: "Custom Booth XI", courseId: 380, category: "Custom Booth" },
            { classNumber: 42, description: "Custom Booth XII", courseId: 385, category: "Custom Booth" },
            { classNumber: 43, description: "Custom Booth XIII", courseId: 390, category: "Custom Booth" },
        ],
        "3": [
            { classNumber: 44, description: "CPR/First-Aid Re Cert", courseId: 435, category: "Safety Certification" },
            { classNumber: 45, description: "Graphics VI", courseId: 155, category: "Graphics" },
            { classNumber: 46, description: "Graphics VII", courseId: 160, category: "Graphics" },
            { classNumber: 47, description: "Graphics VIII", courseId: 165, category: "Graphics" },
            { classNumber: 48, description: "Graphics IX", courseId: 170, category: "Graphics" },
            { classNumber: 49, description: "Graphics X", courseId: 200, category: "Graphics" },
            { classNumber: 50, description: "Custom Booth XIV", courseId: 395, category: "Custom Booth" },
            { classNumber: 51, description: "Custom Booth XV", courseId: 400, category: "Custom Booth" },
            { classNumber: 52, description: "Custom Booth XVI", courseId: 405, category: "Custom Booth" },
            { classNumber: 53, description: "Custom Booth XVII", courseId: 410, category: "Custom Booth" },
            { classNumber: 54, description: "Rigging II", courseId: 460, category: "Rigging" },
            { classNumber: 55, description: "Rigging III", courseId: 465, category: "Rigging" },
            { classNumber: 56, description: "Rigging IV", courseId: 470, category: "Rigging" },
            { classNumber: 57, description: "Rigging V", courseId: 475, category: "Rigging" },
            { classNumber: 58, description: "Rigging VI", courseId: 480, category: "Rigging" },
            { classNumber: 59, description: "Rigging VII", courseId: 495, category: "Rigging" },
            { classNumber: 60, description: "Rigging VIII", courseId: 500, category: "Rigging" },
            { classNumber: 61, description: "Journey Out Exam", courseId: 505, category: "Exam" },
        ],
    },
};

/* Fixed per-category assignment, never hashed/cycled — same convention as
   CATS_META.color/PAY_COLOR elsewhere in this file. */
export const CURRICULUM_CATEGORY_COLOR: Record<string, string> = {
    "Basics": "#8DA3C4",
    "Union/Orientation": "#FFB020",
    "Trade Skills": "#4FC1A6",
    "Equipment Certification": "#5FA8FF",
    "Safety Certification": "#E8927C",
    "Soft Skills": "#C58AF2",
    "Rigging": "#F2789B",
    "Custom Booth": "#E0B84F",
    "Power Tools": "#FF9354",
    "Graphics": "#6FD48A",
    "Exam": "#F26E6E",
};

/* an OJT slip is due the 1st of the following month, 4:00 PM. every month, worked or not. */
export function ojtDue(monthKey: string): string {
    return mAdd(monthKey, 1) + "-01";
}
export function ojtState(
    monthKey: string,
    months: OjtMonth[] | null | undefined,
): {
    k: "in" | "rejected" | "late" | "open";
    t: string;
    c: string;
    due?: Date;
    days?: number;
} {
    const row = (months || []).find((m) => m.m === monthKey);
    const due = fromKey(ojtDue(monthKey));
    const t = todayMid();
    if (row) {
        // a submitted-then-declined month still has a row on file — the
        // "SUBMITTED" badge is wrong once an admin has bounced it back, so
        // status (not just existence) decides what the badge says.
        if (row.status === "rejected") {
            return { k: "rejected", t: "DECLINED", c: C.danger };
        }
        return { k: "in", t: "SUBMITTED", c: C.working };
    }
    if (t > due) return { k: "late", t: "LATE", c: C.danger, due };
    const n = Math.round((due.getTime() - t.getTime()) / 86400000);
    return {
        k: "open",
        t: n === 0 ? "DUE TODAY 4PM" : "DUE " + MONTHS[due.getMonth()] + " 1",
        c: n <= 3 ? C.brand : C.lo,
        due,
        days: n,
    };
}

export function rateFor(
    co: string | null | undefined,
    lvIdx: number,
    rates: Record<string, string> | null | undefined,
): { rate: number; level: string; over: boolean } {
    const scale = LEVELS[lvIdx] || LEVELS[0];
    const map = rates || {};
    const hit = Object.keys(map).find(
        (k) => k.toLowerCase() === String(co || "").toLowerCase(),
    );
    const lv = hit ? LEVELS.find((l) => l.k === map[hit]) : null;
    const over = !!(lv && lv.pay > scale.pay);
    return {
        rate: over ? lv!.pay : scale.pay,
        level: over ? lv!.k : scale.k,
        over,
    };
}
/* one entry -> its split, its rate, and what it actually pays */
export function entryPay(
    dayKey: string,
    e: Entry,
    lvIdx: number,
    rates: Record<string, string> | null | undefined,
) {
    const sp = entrySplit(dayKey, e);
    const r = rateFor(e.co, lvIdx, rates);
    const paid = paidHours(sp);
    const travel = e.travel || 0;
    return {
        sp,
        paid,
        rate: r.rate,
        level: r.level,
        over: r.over,
        travel,
        gross: paid * r.rate + travel,
    };
}
/* a bucket of days -> blended gross, plus the per-company detail */
export function rangePay(
    entries: EntriesByDay,
    keys: string[],
    lvIdx: number,
    rates: Record<string, string> | null | undefined,
) {
    let gross = 0,
        paid = 0,
        travel = 0,
        split: SplitLike = ZERO_SPLIT;
    const byCo: Record<
        string,
        {
            hrs: number;
            paid: number;
            gross: number;
            rate: number;
            level: string;
            over: boolean;
        }
    > = {};
    keys.forEach((k) =>
        (entries[k] || []).forEach((e) => {
            const p = entryPay(k, e, lvIdx, rates);
            gross += p.gross;
            paid += p.paid;
            travel += p.travel;
            split = splitAdd(split, p.sp);
            const b =
                byCo[e.co] ||
                (byCo[e.co] = {
                    hrs: 0,
                    paid: 0,
                    gross: 0,
                    rate: p.rate,
                    level: p.level,
                    over: p.over,
                });
            b.hrs += splitHours(p.sp);
            b.paid += p.paid;
            b.gross += p.gross;
        }),
    );
    return { gross, paid, travel, split, byCo };
}

/* the four apprentice work processes, straight off the JATC sheet.
   their own colour family — nothing here doubles as a calendar state. */
export const CATS_META: Record<
    "A" | "B" | "C" | "D",
    { name: string; target: number; color: string; desc: string }
> = {
    A: {
        name: "General Decorating",
        target: 1350,
        color: "#F2B441",
        desc: "Taping booth lines, booth carpet and visqueen, backwall and ID signs, delivering, topping and skirting tables, floor layout.",
    },
    B: {
        name: "Exhibit Install & Dismantle",
        target: 900,
        color: "#4FC1A6",
        desc: "Set up and dismantle pop-ups (Skyline, Tigermark, Exponent) and custom exhibits — hard wall, multi-level structures.",
    },
    C: {
        name: "Extruded Metals",
        target: 600,
        color: "#7FB2FF",
        desc: "Assemble and disassemble extruded metals exhibits — GEM, MRE, Alluset, Agam, Octanorm.",
    },
    D: {
        name: "Miscellaneous",
        target: 750,
        color: "#F2789B",
        desc: "Forklift, ground rigging, sign installing, loading and unloading trucks.",
    },
};
export const CAT_TOTAL = 1350 + 900 + 600 + 750;

/* Treated as the confirmed scale throughout the app — see LevelList's
   footer in ShowBoard.jsx for the one-line explanation shown to apprentices.
   hrsEst/payEst are kept on the type and left false everywhere; a future
   level whose numbers are genuinely still in question can flip one back on
   without touching every render site that reads it. */
export const LEVELS: Level[] = [
    {
        k: "L1",
        label: "Level 1",
        hrs: 0,
        pay: 27.08,
        hrsEst: false,
        payEst: false,
    },
    {
        k: "L2",
        label: "Level 2",
        hrs: 600,
        pay: 30.24,
        hrsEst: false,
        payEst: false,
        src: "JATC letter",
    },
    {
        k: "L3",
        label: "Level 3",
        hrs: 1200,
        pay: 33.4,
        hrsEst: false,
        payEst: false,
    },
    {
        k: "L4",
        label: "Level 4",
        hrs: 1800,
        pay: 36.56,
        hrsEst: false,
        payEst: false,
        src: "Willwork paystub",
    },
    {
        k: "L5",
        label: "Level 5",
        hrs: 2400,
        pay: 39.72,
        hrsEst: false,
        payEst: false,
    },
    {
        k: "L6",
        label: "Level 6",
        hrs: 3000,
        pay: 42.88,
        hrsEst: false,
        payEst: false,
    },
    { k: "EJ", label: "EJ", hrs: 3600, pay: 45.3, hrsEst: false, payEst: false },
    {
        k: "CJ",
        label: "CJ",
        hrs: 4200,
        pay: 48.46,
        hrsEst: false,
        payEst: false,
        goal: true,
    },
];

/* Level 2 package, straight off the JATC letter */
export const L2_PACKAGE = {
    base: 30.24,
    vacHol: 2.3,
    taxable: 32.55,
    benefits: [
        ["H & W", 13.4],
        ["Pension", 16.35],
        ["Training", 0.64],
        ["FTI", 0.03],
        ["LMP", 0.02],
    ] as Array<[string, number]>,
    benefitsTotal: 30.44,
    total: 62.99,
    travel: 10,
};

export const OJT_DEFAULT: { months: OjtMonth[] } = { months: [] };

/* ---------- pay rules ----------
   MON-FRI   8:00a - 4:30p   ST
             4:30p - 8:30p   OT   x1.5
             8:30p - 8:00a   DT   x2
   SAT/SUN   every hour      DT   x2
   FED HOL   worked at all   OT, guaranteed 8 hrs minimum
   an overnight call rolls into the next day and picks up that day's rule.
   time tickets round to the half hour — nobody pays you for the odd minutes. */
export const PAY = {
    stStart: 8 * 60 /* 8:00a */,
    stEnd: 16 * 60 + 30 /* 4:30p */,
    otEnd: 20 * 60 + 30 /* 8:30p */,
    otMult: 1.5,
    dtMult: 2,
    holMinOt: 8 /* federal holiday -> at least 8 hrs at OT */,
    step: 30 /* half-hour granularity, everywhere */,
};
export const PAY_COLOR: Record<"st" | "ot" | "dt", string> = {
    st: "#8FA0B8",
    ot: "#FFB020",
    dt: "#2FB07A",
};
// was #B49BF0 (lavender), then #DD5D0E (burnt orange) — the orange only
// cleared ~10-15° of hue from brand/PAY_COLOR.ot/danger, tighter than the
// ~40° margin used elsewhere in this file, and read as too close to that
// whole warm cluster once actually alpha-blended. Cornflower/indigo clears
// 70°+ from working-green and KLASS-fuchsia, the two colors it actually
// shares a screen with.
export const BOOKED = "#7089EB"; /* scheduled to work, not logged yet */
// was #E8927C (identical to C.danger), then #6C6FD9 (indigo — too close to
// BOOKED's lavender, only ~20° apart on the hue wheel, so "class" and
// "scheduled" read as the same purple on the calendar). Fuchsia sits in the
// one open gap in the palette — 40°+ from every other color in use,
// including BOOKED — with nothing between it and the neighbors on either
// side (orange is already spoken for twice over: PAY_COLOR.ot and C.brand
// both sit there, plus C.danger next door).
export const KLASS = "#E07BE0"; /* union class — mandatory, unpaid */

/* ---------- federal holidays (observed) ---------- */
export function nthDow(y: number, m: number, dow: number, n: number): Date {
    const first = new Date(y, m, 1);
    return new Date(y, m, 1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7);
}
export function lastDow(y: number, m: number, dow: number): Date {
    const last = new Date(y, m + 1, 0);
    return new Date(y, m, last.getDate() - ((last.getDay() - dow + 7) % 7));
}
export function observedDay(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (x.getDay() === 6)
        x.setDate(x.getDate() - 1); /* Sat -> observed Friday */
    if (x.getDay() === 0)
        x.setDate(x.getDate() + 1); /* Sun -> observed Monday */
    return x;
}
export const HOL_CACHE: Record<number, Record<string, string>> = {};
export function holidaysFor(y: number): Record<string, string> {
    if (HOL_CACHE[y]) return HOL_CACHE[y];
    const list: Array<[string, Date]> = [
        ["New Year's Day", observedDay(new Date(y, 0, 1))],
        ["MLK Day", nthDow(y, 0, 1, 3)],
        ["Presidents' Day", nthDow(y, 1, 1, 3)],
        ["Memorial Day", lastDow(y, 4, 1)],
        ["Juneteenth", observedDay(new Date(y, 5, 19))],
        ["Independence Day", observedDay(new Date(y, 6, 4))],
        ["Labor Day", nthDow(y, 8, 1, 1)],
        ["Columbus Day", nthDow(y, 9, 1, 2)],
        ["Veterans Day", observedDay(new Date(y, 10, 11))],
        ["Thanksgiving", nthDow(y, 10, 4, 4)],
        ["Christmas", observedDay(new Date(y, 11, 25))],
    ];
    const out: Record<string, string> = {};
    list.forEach((x) => {
        out[keyOf(x[1])] = x[0];
    });
    HOL_CACHE[y] = out;
    return out;
}
export function holidayName(d: Date): string | null {
    return holidaysFor(d.getFullYear())[keyOf(d)] || null;
}
export function isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
}

/* ---------- clock ---------- */
export function hhmmToMin(v: string | null | undefined): number | null {
    const p = String(v || "").split(":");
    if (p.length !== 2) return null;
    const h = Number(p[0]),
        m = Number(p[1]);
    if (!isFinite(h) || !isFinite(m)) return null;
    return h * 60 + m;
}
export function minToHHMM(m: number): string {
    const x = ((m % 1440) + 1440) % 1440;
    return (
        String(Math.floor(x / 60)).padStart(2, "0") +
        ":" +
        String(x % 60).padStart(2, "0")
    );
}
export function fmtClock(m: number): string {
    const x = ((m % 1440) + 1440) % 1440;
    const h24 = Math.floor(x / 60),
        mm = x % 60;
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return h + ":" + String(mm).padStart(2, "0") + (h24 >= 12 ? "pm" : "am");
}
/* every half hour of the day — the only times a time ticket ever shows */
export const TIME_SLOTS: number[] = (() => {
    const o: number[] = [];
    for (let m = 0; m < 1440; m += PAY.step) o.push(m);
    return o;
})();
export const BREAK_SLOTS = [0, 30, 60, 90];

/* out may run past 1440 for an overnight call */
export function shiftSplit(
    d: Date,
    inM: number | null | undefined,
    outM: number | null | undefined,
): Hours {
    const acc: Hours = { st: 0, ot: 0, dt: 0 };
    if (inM == null || outM == null || outM <= inM) return acc;
    const day = (d0: Date, a: number, b: number) => {
        const ov = (x: number, y: number) =>
            Math.max(0, Math.min(b, y) - Math.max(a, x));
        if (isWeekend(d0)) {
            acc.dt += ov(0, 1440);
            return;
        } /* weekend beats everything */
        if (holidayName(d0)) {
            acc.ot += ov(0, 1440);
            return;
        } /* holiday -> all OT */
        acc.st += ov(PAY.stStart, PAY.stEnd);
        acc.ot += ov(PAY.stEnd, PAY.otEnd);
        acc.dt += ov(0, PAY.stStart) + ov(PAY.otEnd, 1440);
    };
    day(d, inM, Math.min(outM, 1440));
    if (outM > 1440) {
        const nx = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        day(nx, 0, Math.min(outM - 1440, 1440));
    }
    acc.st /= 60;
    acc.ot /= 60;
    acc.dt /= 60;
    return acc;
}
/* an unpaid break comes out of straight time first */
export function takeBreak(sp: Hours, brkMin: number | null | undefined): Hours {
    let b = num(brkMin) / 60;
    const o: Hours = { st: sp.st, ot: sp.ot, dt: sp.dt };
    (["st", "ot", "dt"] as const).forEach((k) => {
        const t = Math.min(o[k], b);
        o[k] -= t;
        b -= t;
    });
    return o;
}
/* one entry -> pay buckets AND clock hours. they are not the same number:
   a federal holiday guarantees 8 OT hrs even if you only worked 4. the union
   still only gets the 4 you actually stood on the floor. */
export function entrySplit(dayKey: string, e: Entry): Split {
    const d = fromKey(dayKey);
    const timed = e.in != null && e.out != null && e.out > e.in;
    let sp: Hours = timed
        ? takeBreak(shiftSplit(d, e.in, e.out), e.brk)
        : shiftSplit(d, PAY.stStart, PAY.stStart + num(e.hrs) * 60);
    const clock = sp.st + sp.ot + sp.dt;
    const hol = holidayName(d);
    let guarantee = 0;
    if (hol && !isWeekend(d) && clock > 0 && sp.ot < PAY.holMinOt) {
        guarantee = PAY.holMinOt - sp.ot;
        sp = { st: sp.st, ot: PAY.holMinOt, dt: sp.dt };
    }
    return {
        st: sp.st,
        ot: sp.ot,
        dt: sp.dt,
        clock,
        timed,
        holiday: hol,
        guarantee,
    };
}
export function splitAdd(
    a: SplitLike,
    b: SplitLike,
): { st: number; ot: number; dt: number; clock: number; guarantee: number } {
    return {
        st: a.st + b.st,
        ot: a.ot + b.ot,
        dt: a.dt + b.dt,
        clock: num(a.clock) + (b.clock != null ? b.clock : b.st + b.ot + b.dt),
        guarantee: num(a.guarantee) + num(b.guarantee),
    };
}
export const ZERO_SPLIT: SplitLike = {
    st: 0,
    ot: 0,
    dt: 0,
    clock: 0,
    guarantee: 0,
};
export function splitHours(sp: SplitLike): number {
    return sp.clock != null ? sp.clock : sp.st + sp.ot + sp.dt;
}
export function paidHours(sp: Hours): number {
    return sp.st + sp.ot * PAY.otMult + sp.dt * PAY.dtMult;
}

/* ---------- OJT helpers ---------- */
export function num(v: unknown): number {
    const n = Number(v);
    return isFinite(n) ? n : 0;
}
export function mKey(y: number, m: number): string {
    return y + "-" + String(m + 1).padStart(2, "0");
}
export function mParse(k: string): { y: number; m: number } {
    const p = String(k).split("-").map(Number);
    return { y: p[0], m: (p[1] || 1) - 1 };
}
export function mShort(k: string): string {
    const p = mParse(k);
    return MONTHS[p.m] + " " + String(p.y).slice(2);
}
export function mMed(k: string): string {
    const p = mParse(k);
    return MONTHS[p.m] + " " + p.y;
}
export function mLong(k: string): string {
    const p = mParse(k);
    return MON_FULL[p.m] + " " + p.y;
}
export function mAdd(k: string, n: number): string {
    const p = mParse(k);
    const d = new Date(p.y, p.m + n, 1);
    return mKey(d.getFullYear(), d.getMonth());
}
export function monthTotal(m: OjtMonth): number {
    return num(m.a) + num(m.b) + num(m.c) + num(m.d);
}

export function ojtTotals(months: OjtMonth[] | null | undefined): {
    a: number;
    b: number;
    c: number;
    d: number;
    total: number;
} {
    const t = { a: 0, b: 0, c: 0, d: 0, total: 0 };
    (months || []).forEach((m) => {
        t.a += num(m.a);
        t.b += num(m.b);
        t.c += num(m.c);
        t.d += num(m.d);
    });
    t.total = t.a + t.b + t.c + t.d;
    return t;
}
export function levelIndex(total: number): number {
    let i = 0;
    LEVELS.forEach((lv, k) => {
        if (total >= lv.hrs) i = k;
    });
    return i;
}
/* months ordered oldest-first, each carrying its running total + any level crossed that month */
export function ojtRows(
    months: OjtMonth[] | null | undefined,
): Array<OjtMonth & { total: number; run: number; crossed: Level[] }> {
    const sorted = (months || [])
        .slice()
        .sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
    let run = 0;
    return sorted.map((m) => {
        const total = monthTotal(m);
        const before = run;
        run += total;
        const crossed = LEVELS.filter(
            (lv) => lv.hrs > 0 && before < lv.hrs && run >= lv.hrs,
        );
        return { ...m, total, run, crossed };
    });
}
export function projectMonth(
    need: number,
    avg: number | null | undefined,
    fromKey: string | null | undefined,
): string | null {
    if (!avg || avg <= 0 || !fromKey || need <= 0) return null;
    return mAdd(fromKey, Math.ceil(need / avg));
}
/* what the calendar tab actually logged, bucketed by month — kept separate from what was submitted */
export function rollupEntries(
    entries: EntriesByDay | null | undefined,
): Record<
    string,
    {
        a: number;
        b: number;
        c: number;
        d: number;
        uncat: number;
        total: number;
        days: number;
    }
> {
    const out: Record<
        string,
        {
            a: number;
            b: number;
            c: number;
            d: number;
            uncat: number;
            total: number;
            days: number;
        }
    > = {};
    Object.keys(entries || {}).forEach((dk) => {
        const k = dk.slice(0, 7);
        const r =
            out[k] ||
            (out[k] = { a: 0, b: 0, c: 0, d: 0, uncat: 0, total: 0, days: 0 });
        const list = (entries || {})[dk] || [];
        if (list.length) r.days += 1;
        list.forEach((e) => {
            const h = num(e.hrs);
            const c = String(e.cat || "").toUpperCase();
            r.total += h;
            if (c === "A" || c === "B" || c === "C" || c === "D")
                r[c.toLowerCase() as "a" | "b" | "c" | "d"] += h;
            else r.uncat += h;
        });
    });
    return out;
}
export function certState(exp: string): { t: string; c: string; days: number } {
    const p = String(exp).split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    const days = Math.round((d.getTime() - todayMid().getTime()) / 86400000);
    if (days < 0) return { t: "EXPIRED", c: C.danger, days };
    if (days <= 90) return { t: "RENEW SOON", c: C.brand, days };
    return { t: "ACTIVE", c: C.working, days };
}

/* ---------- scheduled work + union classes ---------- */
export function bookingOn(
    bookings: Booking[] | null | undefined,
    dayKey: string,
): Booking[] {
    return (bookings || []).filter(
        (b) => (b.dates || []).indexOf(dayKey) !== -1,
    );
}
export function classOn(
    classes: Klass[] | null | undefined,
    dayKey: string,
): Klass[] {
    return (classes || []).filter(
        (c) => (c.dates || []).indexOf(dayKey) !== -1,
    );
}
/* every day that carries any kind of commitment, sorted */
export function commitDays(
    list: Array<{ dates?: string[] | null }> | null | undefined,
): string[] {
    const out: Record<string, 1> = {};
    (list || []).forEach((x) =>
        (x.dates || []).forEach((d) => {
            out[d] = 1;
        }),
    );
    return Object.keys(out).sort();
}
/* a class or booking that hasn't happened yet */
export function nextDates(
    x: { dates?: string[] | null },
    from: string,
): string[] {
    return (x.dates || []).filter((d) => d >= from).sort();
}
