"use client";

/* Split out of ShowBoard.jsx so it can be next/dynamic-loaded — this is the
   single largest tab (rules reference, curriculum, pay-scale panels), and an
   apprentice checking tomorrow's show on Home shouldn't have to download and
   parse all of it. Mechanical move: behavior is unchanged, only the module
   boundary is new. Fold/LevelList/CatBars/OjtLog are exclusive to this tab
   (confirmed via grep across ShowBoard.jsx before moving) so they came with
   it rather than staying behind as shell dead weight. */
import { useState, useEffect, useMemo, useContext } from "react";
import {
    Phone,
    Plus,
    X,
    MapPin,
    Hammer,
    Upload,
    Check,
    Building2,
    CalendarDays,
    ChevronRight,
    Clock,
    GraduationCap,
    ShieldAlert,
    TriangleAlert,
    Eye,
    EyeOff,
    FileDown,
} from "lucide-react";
import {
    C,
    SHADOW,
    FM,
    CATS_META,
    CAT_TOTAL,
    LEVELS,
    L2_PACKAGE,
    hrsFmt,
    mMed,
    mParse,
    mAdd,
    mKey,
    todayMid,
    ojtDue,
    ojtState,
    ojtRows,
    ojtTotals,
    levelIndex,
    num,
    keyOf,
    fromKey,
    MONTHS,
    projectMonth,
    rateFor,
    RSI_REQUIRED,
    certState,
    rollupEntries,
    KLASS,
    coColor,
    daysUntil,
    fmtClock,
    fmtTel,
    JATC,
    longDate,
    mapsUrl,
    PAY,
    PAY_COLOR,
    COMMON_CERTS,
} from "@/lib/core";
import { store } from "@/lib/store";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { Modal } from "@/components/ui/Modal";
import { Stat } from "@/components/ui/Stat";
import { ClassCurriculum } from "@/components/ojt/ClassCurriculum";
import { LevelList } from "@/components/ojt/LevelList";
import { CatBars } from "@/components/ojt/CatBars";
import { OjtLog } from "@/components/ojt/OjtLog";
import { Fold } from "@/components/ui/Fold";

const OJT_IMPORT_ENABLED = process.env.NEXT_PUBLIC_OJT_IMPORT_ENABLED === "true";

// not a lib/core export — a tiny local formatter also defined (separately)
// in ShowBoard.jsx; duplicating 3 lines here beats adding an export just
// for this.
function money(n) {
    return "$" + num(n).toFixed(2);
}


export function OjtTab({
    ojt,
    entries,
    onAddMonth,
    onEditMonth,
    onImportMonths,
    onOpenRules,
    rates,
    onSetRate,
    onRemoveRate,
    onAddRateCo,
    classes,
    email,
    isAdmin,
    onSignOut,
    profile,
    onPasswordSet,
    certs,
    onSaveCert,
    completedClasses,
    onToggleCompletedClass,
    pwIntent,
    onPwIntentConsumed,
}) {
    const { jatcContacts, dc36Contacts } = useContext(DirectoryContext);
    const [signingOut, setSigningOut] = useState(false);
    const [pwModal, setPwModal] = useState(false);
    const [classInfo, setClassInfo] = useState(null);
    const [addingCert, setAddingCert] = useState(null); // COMMON_CERTS name, or null
    const [certExp, setCertExp] = useState("");
    const [certSaving, setCertSaving] = useState(false);
    // Home's "no password on file" nudge sends us here wanting the modal
    // open, not just the tab switched to — consume the one-shot signal.
    useEffect(() => {
        if (pwIntent) {
            setPwModal(true);
            onPwIntentConsumed?.();
        }
    }, [pwIntent, onPwIntentConsumed]);
    const months = ojt.months || [];
    // only admin-approved months count toward level/total — a submitted month
    // sits as "pending" until an admin signs off (see ojt_months.status).
    const approvedMonths = useMemo(
        () => months.filter((mo) => mo.status === "approved"),
        [months],
    );
    const awaitingApproval = useMemo(
        () =>
            months
                .filter((mo) => mo.status === "pending")
                .sort((a, b) => (a.m < b.m ? -1 : 1)),
        [months],
    );
    // rejected months would otherwise vanish — not pending, not approved,
    // never shown anywhere — leaving no way back in to fix and resubmit.
    const rejectedMonths = useMemo(
        () =>
            months
                .filter((mo) => mo.status === "rejected")
                .sort((a, b) => (a.m < b.m ? -1 : 1)),
        [months],
    );
    const rows = useMemo(() => ojtRows(approvedMonths), [approvedMonths]);
    const t = useMemo(() => ojtTotals(approvedMonths), [approvedMonths]);
    const roll = useMemo(() => rollupEntries(entries), [entries]);

    const idx = levelIndex(t.total);
    const lv = LEVELS[idx];
    const nxt = LEVELS[idx + 1];
    const avg = approvedMonths.length ? t.total / approvedMonths.length : 0;
    const lastMonth = rows.length ? rows[rows.length - 1].m : null;
    const toNext = nxt ? nxt.hrs - t.total : 0;
    const projNext = nxt ? projectMonth(toNext, avg, lastMonth) : null;

    const today = todayMid();
    const todayKey = keyOf(today);
    const thisMonth = mKey(today.getFullYear(), today.getMonth());
    const lastMonthKey = mAdd(thisMonth, -1);
    const lateSt = ojtState(lastMonthKey, months);
    const openSt = ojtState(thisMonth, months);

    /* months the calendar has hours for that were never submitted */
    const pending = Object.keys(roll)
        .filter((k) => roll[k].total > 0 && !months.some((m) => m.m === k))
        .sort();

    const classRows = (classes || []).slice().sort((a, b) => {
        const da = (a.dates || []).slice().sort()[0] || "";
        const db = (b.dates || []).slice().sort()[0] || "";
        return da < db ? -1 : da > db ? 1 : 0;
    });

    return (
        <div className="dgrid">
            {/* who / where */}
            <div
                className="dspan"
                style={{
                    background: C.panel,
                    border: "1px solid " + C.edge,
                    borderRadius: 12,
                    padding: "16px 17px",
                    boxShadow: SHADOW,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                            className="truncate"
                            style={{
                                fontSize: 14.5,
                                fontWeight: 750,
                                color: C.hi,
                            }}
                        >
                            {profile.name || "—"}
                        </div>
                        <div
                            className="truncate"
                            style={{
                                fontSize: 11,
                                color: C.lo,
                                fontFamily: FM,
                                marginTop: 3,
                            }}
                        >
                            ID {profile.memberId || "—"} · SSN ··
                            {profile.last4 || "----"} · {profile.local}
                        </div>
                    </div>
                    <span
                        style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontFamily: FM,
                            fontSize: 10,
                            fontWeight: 800,
                            color: C.working,
                            background: "rgba(47,176,122,0.12)",
                            border: "1px solid rgba(47,176,122,0.35)",
                            borderRadius: 6,
                            padding: "4px 7px",
                        }}
                    >
                        <Check size={11} />
                        RSI {profile.rsiCredits}/{RSI_REQUIRED}
                    </span>
                </div>
                {profile.joined && (
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 12,
                            marginTop: 9,
                            paddingTop: 9,
                            borderTop: "1px solid " + C.line,
                            fontSize: 11,
                            color: C.mid,
                        }}
                    >
                        <span>
                            Joined{" "}
                            <span style={{ fontFamily: FM, color: C.hi }}>
                                {profile.joined}
                            </span>
                        </span>
                    </div>
                )}
            </div>

            {/* no OJT history at all yet — nudge toward backfilling it, don't require it */}
            {months.length === 0 && (
                <div
                    className="dspan"
                    style={{
                        background: "rgba(255,176,32,0.07)",
                        border: "1px solid rgba(255,176,32,0.3)",
                        borderRadius: 12,
                        padding: "13px 15px",
                        boxShadow: SHADOW,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <TriangleAlert size={15} color={C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12.5, color: C.hi, lineHeight: 1.5 }}>
                            No OJT history yet — your level and pay scale won't track until you add some.{" "}
                            {OJT_IMPORT_ENABLED ? (
                                <button
                                    type="button"
                                    className="foc"
                                    onClick={onImportMonths}
                                    style={{ background: "transparent", border: "none", color: C.brand, fontWeight: 800, fontSize: 12.5, padding: 0, textDecoration: "underline" }}
                                >
                                    Upload old slips
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="foc"
                                    onClick={() => onAddMonth()}
                                    style={{ background: "transparent", border: "none", color: C.brand, fontWeight: 800, fontSize: 12.5, padding: 0, textDecoration: "underline" }}
                                >
                                    Add a month
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* the slip that puts you on the do-not-hire list if it's late —
                same urgent styling for "turned in, bounced back" (rejected)
                as for "never turned in" (late), since both need action. */}
            {(() => {
                const urgent = lateSt.k === "late" || openSt.k === "rejected";
                return (
                    <div
                        className="dspan"
                        style={{
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
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <CalendarDays
                                size={14}
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
                                        <span
                                            style={{ fontWeight: 800, color: C.danger }}
                                        >
                                            {mMed(lastMonthKey)} OJT is late.
                                        </span>{" "}
                                        It was due the 1st by 4:00 PM — that's the
                                        do-not-hire list.
                                    </div>
                                ) : openSt.k === "rejected" ? (
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: C.hi,
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        <span
                                            style={{ fontWeight: 800, color: C.danger }}
                                        >
                                            {mMed(thisMonth)} OJT was declined.
                                        </span>{" "}
                                        Check the hours below and resubmit.
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
                                            {mMed(thisMonth)} OJT
                                        </span>{" "}
                                        is due{" "}
                                        {MONTHS[fromKey(ojtDue(thisMonth)).getMonth()]}{" "}
                                        1 by 4:00 PM. Every month — worked or not.
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
                        </div>
                        {lateSt.k === "late" && (
                            <div style={{ fontSize: 11, color: C.mid, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid " + C.danger + "33" }}>
                                First late slip: a warning letter, with 1 week to turn it in. Any slip after that: straight to the Do Not Hire List until it's received — you're back to work that Friday, but still cited to the next JATC meeting.
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* metrics */}
            <div
                className="m4 dspan"
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                }}
            >
                <Stat
                    label="TOTAL OJT"
                    value={hrsFmt(t.total)}
                    sub={"of " + CAT_TOTAL.toLocaleString() + " to EJ"}
                    color={C.working}
                />
                <Stat
                    label="LEVEL"
                    value={lv.k}
                    sub={money(lv.pay) + "/hr scale"}
                    color={C.brand}
                />
                <Stat
                    label="AVG / MONTH"
                    value={hrsFmt(Math.round(avg * 10) / 10)}
                    sub={approvedMonths.length + " months approved"}
                />
                <Stat
                    label={nxt ? "TO " + nxt.k : "TOP RATE"}
                    value={nxt ? hrsFmt(toNext) : "—"}
                    sub={projNext ? "~" + mMed(projNext) : "at current pace"}
                    color={C.gc}
                />
            </div>

            {/* who pays over scale */}
            {(() => {
                const over = Object.keys(rates || {})
                    .filter((n) => rateFor(n, idx, rates).over)
                    .map((n) => ({ n, r: rateFor(n, idx, rates) }))
                    .sort((a, b) => b.r.rate - a.r.rate);
                if (!over.length) return null;
                return (
                    <div
                        className="dspan"
                        style={{
                            background: "rgba(255,176,32,0.07)",
                            border: "1px solid rgba(255,176,32,0.3)",
                            borderRadius: 10,
                            padding: "15px 16px",
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
                            <Hammer
                                size={13}
                                color={C.brand}
                                style={{ flexShrink: 0 }}
                            />
                            <span
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: C.brand,
                                }}
                            >
                                Paid over scale
                            </span>
                            <span
                                className="truncate"
                                style={{
                                    marginLeft: "auto",
                                    fontSize: 11,
                                    color: C.mid,
                                }}
                            >
                                everyone else pays your {lv.label}{" "}
                                <span
                                    style={{
                                        fontFamily: FM,
                                        fontWeight: 800,
                                        color: C.hi,
                                    }}
                                >
                                    {money(lv.pay)}
                                </span>
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 5,
                            }}
                        >
                            {over.map((x) => (
                                <div
                                    key={x.n}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: 9,
                                            background: coColor(x.n),
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span
                                        className="truncate"
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: 12,
                                            color: C.hi,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {x.n}
                                    </span>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontFamily: FM,
                                            fontSize: 12,
                                            fontWeight: 800,
                                            color: C.brand,
                                        }}
                                    >
                                        {money(x.r.rate)}
                                    </span>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontFamily: FM,
                                            fontSize: 10,
                                            color: C.lo,
                                            width: 78,
                                            textAlign: "right",
                                        }}
                                    >
                                        {x.r.level} · +
                                        {money(x.r.rate - lv.pay)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            <LevelList total={t.total} avg={avg} lastMonth={lastMonth} />

            {/* right column: category progress, then anything shorter — stacked to keep pace with the level ladder */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <CatBars t={t} />

                {/* months logged but never turned in */}
                {pending.length > 0 && (
                    <div
                        style={{
                            background: C.panel,
                            border: "1px solid rgba(127,178,255,0.35)",
                            borderRadius: 12,
                            padding: "16px 17px",
                            boxShadow: SHADOW,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.gc,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            LOGGED IN APP — NOT SUBMITTED
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {pending.map((k) => {
                                const r = roll[k];
                                return (
                                    <button
                                        key={k}
                                        className="foc"
                                        onClick={() => onAddMonth(k)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                            background: C.sunk,
                                            border: "1px solid " + C.line,
                                            borderRadius: 9,
                                            padding: "10px 11px",
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 12.5,
                                                    fontWeight: 800,
                                                    color: C.hi,
                                                }}
                                            >
                                                {mMed(k)}
                                            </div>
                                            <div
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 10.5,
                                                    color: C.mid,
                                                    marginTop: 2,
                                                }}
                                            >
                                                A {hrsFmt(r.a)} · B{" "}
                                                {hrsFmt(r.b)} · C {hrsFmt(r.c)}{" "}
                                                · D {hrsFmt(r.d)}
                                                {r.uncat > 0 && (
                                                    <span
                                                        style={{
                                                            color: C.brand,
                                                        }}
                                                    >
                                                        {" "}
                                                        · {hrsFmt(r.uncat)}{" "}
                                                        untagged
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 16,
                                                fontWeight: 800,
                                                color: C.gc,
                                            }}
                                        >
                                            {hrsFmt(r.total)}
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: C.lo,
                                                }}
                                            >
                                                h
                                            </span>
                                        </span>
                                        <ChevronRight
                                            size={16}
                                            color={C.lo}
                                            style={{ flexShrink: 0 }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: C.lo,
                                marginTop: 9,
                                lineHeight: 1.5,
                            }}
                        >
                            Tap a month to submit it — it goes to your admin for
                            review before it counts toward your total.
                        </div>
                    </div>
                )}

                {/* submitted, waiting on an admin to sign off */}
                {awaitingApproval.length > 0 && (
                    <div
                        style={{
                            background: "rgba(255,176,32,0.07)",
                            border: "1px solid rgba(255,176,32,0.3)",
                            borderRadius: 12,
                            padding: "16px 17px",
                            boxShadow: SHADOW,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.brand,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            PENDING ADMIN REVIEW
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {awaitingApproval.map((mo) => (
                                <button
                                    key={mo.m}
                                    className="foc"
                                    onClick={() => onEditMonth(mo)}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 9,
                                        background: C.sunk,
                                        border: "1px solid rgba(255,176,32,0.35)",
                                        borderRadius: 9,
                                        padding: "10px 11px",
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 12.5,
                                                fontWeight: 800,
                                                color: C.hi,
                                            }}
                                        >
                                            {mMed(mo.m)}
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: C.mid,
                                                marginTop: 2,
                                            }}
                                        >
                                            A {hrsFmt(mo.a)} · B {hrsFmt(mo.b)}{" "}
                                            · C {hrsFmt(mo.c)} · D{" "}
                                            {hrsFmt(mo.d)}
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontFamily: FM,
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: C.brand,
                                            border: "1px solid rgba(255,176,32,0.5)",
                                            borderRadius: 5,
                                            padding: "2px 5px",
                                        }}
                                    >
                                        PENDING
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: C.lo,
                                marginTop: 9,
                                lineHeight: 1.5,
                            }}
                        >
                            Not counted in your total yet — once your admin
                            approves it, it rolls in.
                        </div>
                    </div>
                )}

                {rejectedMonths.length > 0 && (
                    <div
                        style={{
                            background: "rgba(232,146,124,0.09)",
                            border: "1px solid " + C.danger + "66",
                            borderRadius: 12,
                            padding: "16px 17px",
                            boxShadow: SHADOW,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: 0.6,
                                color: C.danger,
                                fontFamily: FM,
                                marginBottom: 8,
                            }}
                        >
                            DECLINED — FIX & RESUBMIT
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {rejectedMonths.map((mo) => (
                                <button
                                    key={mo.m}
                                    className="foc"
                                    onClick={() => onEditMonth(mo)}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 9,
                                        background: C.sunk,
                                        border: "1px solid " + C.danger + "55",
                                        borderRadius: 9,
                                        padding: "10px 11px",
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 12.5,
                                                fontWeight: 800,
                                                color: C.hi,
                                            }}
                                        >
                                            {mMed(mo.m)}
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: C.mid,
                                                marginTop: 2,
                                            }}
                                        >
                                            A {hrsFmt(mo.a)} · B {hrsFmt(mo.b)}{" "}
                                            · C {hrsFmt(mo.c)} · D{" "}
                                            {hrsFmt(mo.d)}
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontFamily: FM,
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: C.danger,
                                            border: "1px solid " + C.danger + "55",
                                            borderRadius: 5,
                                            padding: "2px 5px",
                                        }}
                                    >
                                        DECLINED
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: C.lo,
                                marginTop: 9,
                                lineHeight: 1.5,
                            }}
                        >
                            Tap a month to check the hours and resubmit — it
                            goes back to your admin for another look.
                        </div>
                    </div>
                )}

                {/* union classes */}
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
                                color: KLASS,
                                fontFamily: FM,
                            }}
                        >
                            CLASS SCHEDULE
                        </div>
                    </div>
                    {classRows.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: C.lo }}>
                            No classes on the books yet — your admin assigns
                            these as the union emails come in.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {classRows.map((c) => {
                                const ds = (c.dates || []).slice().sort();
                                const done =
                                    ds.length > 0 &&
                                    ds[ds.length - 1] < todayKey;
                                const a = ds.length ? fromKey(ds[0]) : null;
                                const b = ds.length
                                    ? fromKey(ds[ds.length - 1])
                                    : null;
                                const n = a ? daysUntil(a) : null;
                                return (
                                    <button
                                        key={c.id}
                                        className="foc"
                                        onClick={() => setClassInfo(c)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                            background: C.sunk,
                                            border:
                                                "1px solid " +
                                                (done ? C.line : KLASS + "48"),
                                            borderRadius: 9,
                                            padding: "10px 11px",
                                            opacity: done ? 0.55 : 1,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 3,
                                                alignSelf: "stretch",
                                                borderRadius: 2,
                                                background: done
                                                    ? C.passed
                                                    : KLASS,
                                                flexShrink: 0,
                                            }}
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
                                                {c.name}
                                            </div>
                                            <div
                                                className="truncate"
                                                style={{
                                                    fontSize: 11,
                                                    color: C.mid,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {a && b
                                                    ? MONTHS[a.getMonth()] +
                                                      " " +
                                                      a.getDate() +
                                                      (ds.length > 1
                                                          ? "–" + b.getDate()
                                                          : "") +
                                                      " · " +
                                                      ds.length +
                                                      " day" +
                                                      (ds.length === 1
                                                          ? ""
                                                          : "s")
                                                    : "no dates"}
                                                {" · " + fmtClock(c.start)}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 9,
                                                fontWeight: 800,
                                                color: done ? C.lo : KLASS,
                                                border:
                                                    "1px solid " +
                                                    (done
                                                        ? C.line
                                                        : KLASS + "55"),
                                                borderRadius: 5,
                                                padding: "2px 5px",
                                            }}
                                        >
                                            {done
                                                ? "DONE"
                                                : n <= 0
                                                  ? "NOW"
                                                  : "IN " + n + "D"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div
                        style={{
                            fontSize: 10.5,
                            color: C.lo,
                            marginTop: 9,
                            lineHeight: 1.5,
                        }}
                    >
                        Mandatory and unpaid — time off the floor, not hours
                        toward OJT. Make-ups exist but count against you.
                    </div>
                    <div style={{ fontSize: 10.5, color: C.lo, marginTop: 6, lineHeight: 1.5 }}>
                        RSI requirement: 480 hours over 3 years — 160/year, 4
                        quarters of 40. 80 hours at your current level clears
                        you to advance.
                    </div>
                </div>
            </div>

            <div className="dspan">
                <OjtLog rows={rows} roll={roll} onEdit={onEditMonth} />
            </div>

            {/* per-company rate, OT/DT rules, and level pay package —
                consolidated into one Fold so the reference list below isn't
                three near-identical full-width rows back to back. */}
            <Fold icon={Building2} title="Pay & rates" color={C.brand}>
                <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                    WHAT EACH COMPANY PAYS YOU
                </div>
                <div
                    style={{
                        fontSize: 11.5,
                        color: C.mid,
                        lineHeight: 1.5,
                        marginBottom: 10,
                    }}
                >
                    Default is your scale —{" "}
                    <span
                        style={{ fontFamily: FM, fontWeight: 800, color: C.hi }}
                    >
                        {lv.label} {money(lv.pay)}
                    </span>
                    . Set an override only where a shop pays above it. Overrides
                    follow a level, not a dollar amount, so they move up with
                    you.
                </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    {(() => {
                        const worked = {};
                        Object.keys(entries).forEach((k) =>
                            (entries[k] || []).forEach((e) => {
                                worked[e.co] = (worked[e.co] || 0) + num(e.hrs);
                            }),
                        );
                        const names = Array.from(
                            new Set(
                                Object.keys(rates || {}).concat(
                                    Object.keys(worked),
                                ),
                            ),
                        ).sort();
                        if (!names.length)
                            return (
                                <div style={{ fontSize: 12.5, color: C.lo }}>
                                    Nothing here yet — add a company below.
                                </div>
                            );
                        return names.map((n) => {
                            const r = rateFor(n, idx, rates);
                            const cur = (rates || {})[n] || "";
                            return (
                                <div
                                    key={n}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        background: C.sunk,
                                        border:
                                            "1px solid " +
                                            (r.over
                                                ? "rgba(255,176,32,0.35)"
                                                : C.line),
                                        borderRadius: 9,
                                        padding: "9px 10px",
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
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            className="truncate"
                                            style={{
                                                fontSize: 12.5,
                                                fontWeight: 700,
                                                color: C.hi,
                                            }}
                                        >
                                            {n}
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: r.over ? C.brand : C.lo,
                                                marginTop: 2,
                                            }}
                                        >
                                            {money(r.rate)}
                                            {r.over
                                                ? " · " + r.level + " rate"
                                                : " · scale"}
                                            {worked[n]
                                                ? " · " +
                                                  hrsFmt(worked[n]) +
                                                  "h logged"
                                                : ""}
                                        </div>
                                    </div>
                                    <select
                                        className="foc"
                                        value={cur}
                                        onChange={(e) =>
                                            onSetRate(n, e.target.value)
                                        }
                                        style={{
                                            flexShrink: 0,
                                            width: 92,
                                            background: C.raise,
                                            color: C.hi,
                                            border: "1px solid " + C.line,
                                            borderRadius: 8,
                                            padding: "7px 4px",
                                            fontSize: 12,
                                            fontFamily: FM,
                                            fontWeight: 700,
                                        }}
                                    >
                                        <option value="">Scale</option>
                                        {LEVELS.map((l) => (
                                            <option key={l.k} value={l.k}>
                                                {l.k} {money(l.pay)}
                                            </option>
                                        ))}
                                    </select>
                                    {!worked[n] && (
                                        <button
                                            className="foc"
                                            onClick={() => onRemoveRate(n)}
                                            style={{
                                                flexShrink: 0,
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
                            );
                        });
                    })()}
                </div>
                <button
                    className="foc"
                    onClick={onAddRateCo}
                    style={{
                        width: "100%",
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        background: "transparent",
                        color: C.brand,
                        border: "1px dashed rgba(255,176,32,0.45)",
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 12.5,
                        fontWeight: 700,
                    }}
                >
                    <Plus size={14} />
                    Add a company
                </button>
                <div
                    style={{
                        fontSize: 10.5,
                        color: C.lo,
                        marginTop: 8,
                        lineHeight: 1.5,
                    }}
                >
                    Add a shop before you ever log an hour with them — Eagle,
                    Freeman, whoever calls you next.
                </div>
                <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                    TIME & A HALF / DOUBLE TIME
                </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    {[
                        ["Before 8:00am", "DT", PAY_COLOR.dt, "×2"],
                        ["8:00am – 4:30pm", "ST", PAY_COLOR.st, "×1"],
                        ["4:30pm – 8:30pm", "OT", PAY_COLOR.ot, "×1.5"],
                        ["After 8:30pm", "DT", PAY_COLOR.dt, "×2"],
                        ["Saturday & Sunday", "DT", PAY_COLOR.dt, "×2"],
                        ["Federal holiday", "OT", PAY_COLOR.ot, "8h min"],
                    ].map(([when, k, c, mult]) => (
                        <div
                            key={when}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 9,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "9px 10px",
                            }}
                        >
                            <span
                                style={{
                                    width: 3,
                                    alignSelf: "stretch",
                                    borderRadius: 2,
                                    background: c,
                                    flexShrink: 0,
                                }}
                            />
                            <span
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: 12.5,
                                    color: C.hi,
                                }}
                            >
                                {when}
                            </span>
                            <span
                                style={{
                                    fontFamily: FM,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: c,
                                    background: c + "1C",
                                    border: "1px solid " + c + "55",
                                    borderRadius: 5,
                                    padding: "2px 6px",
                                }}
                            >
                                {k}
                            </span>
                            <span
                                style={{
                                    fontFamily: FM,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: C.mid,
                                    width: 36,
                                    textAlign: "right",
                                }}
                            >
                                {mult}
                            </span>
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: C.lo,
                        marginTop: 10,
                        lineHeight: 1.5,
                    }}
                >
                    Work a federal holiday and you're guaranteed{" "}
                    <span style={{ fontFamily: FM, color: C.brand }}>
                        {PAY.holMinOt} hrs at OT
                    </span>{" "}
                    even if you only put in four — but only the hours you
                    actually stood on the floor go to the JATC. Holidays use the{" "}
                    <span style={{ color: C.hi }}>observed</span> date, so July
                    4 2026 lands on Friday July 3, same as the union sheet.
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: C.lo,
                        marginTop: 8,
                        lineHeight: 1.5,
                        paddingTop: 8,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    An overnight call rolls into the next day and picks up that
                    day's rule. Everything rounds to the half hour. OT pays{" "}
                    <span style={{ fontFamily: FM, color: C.brand }}>×1.5</span>.
                </div>
                <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                    {lv.k === "L2" ? "LEVEL 2 PAY PACKAGE" : (lv.label + " PAY").toUpperCase()}
                </div>
                {lv.k === "L2" ? (
                <>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                    {[
                        ["Base rate", L2_PACKAGE.base],
                        ["Vacation / holiday", L2_PACKAGE.vacHol],
                    ].map(([k, v]) => (
                        <div
                            key={k}
                            style={{ display: "flex", fontSize: 12.5 }}
                        >
                            <span style={{ color: C.mid }}>{k}</span>
                            <span
                                style={{
                                    marginLeft: "auto",
                                    fontFamily: FM,
                                    color: C.hi,
                                    fontWeight: 700,
                                }}
                            >
                                {money(v)}
                            </span>
                        </div>
                    ))}
                    <div
                        style={{
                            display: "flex",
                            fontSize: 12.5,
                            paddingTop: 7,
                            borderTop: "1px solid " + C.line,
                        }}
                    >
                        <span style={{ color: C.hi, fontWeight: 700 }}>
                            Taxable wage
                        </span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                color: C.brand,
                                fontWeight: 800,
                            }}
                        >
                            {money(L2_PACKAGE.taxable)}
                        </span>
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.6,
                            color: C.lo,
                            fontFamily: FM,
                            marginTop: 6,
                        }}
                    >
                        BENEFITS
                    </div>
                    {L2_PACKAGE.benefits.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", fontSize: 12 }}>
                            <span style={{ color: C.mid }}>{k}</span>
                            <span
                                style={{
                                    marginLeft: "auto",
                                    fontFamily: FM,
                                    color: C.mid,
                                }}
                            >
                                {money(v)}
                            </span>
                        </div>
                    ))}
                    <div
                        style={{
                            display: "flex",
                            fontSize: 12.5,
                            paddingTop: 7,
                            borderTop: "1px solid " + C.line,
                        }}
                    >
                        <span style={{ color: C.mid }}>Benefits total</span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                color: C.hi,
                                fontWeight: 700,
                            }}
                        >
                            {money(L2_PACKAGE.benefitsTotal)}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: "10px 11px",
                            marginTop: 4,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: C.hi,
                            }}
                        >
                            Total package
                        </span>
                        <span
                            style={{
                                marginLeft: "auto",
                                fontFamily: FM,
                                fontSize: 17,
                                fontWeight: 800,
                                color: C.working,
                            }}
                        >
                            {money(L2_PACKAGE.total)}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.lo, marginTop: 2 }}>
                        Travel pay {money(L2_PACKAGE.travel)}/day. This is the
                        scale package — only shops with an override pay above
                        it.
                    </div>
                </div>
                </>
                ) : (
                <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", fontSize: 12.5 }}>
                        <span style={{ color: C.mid }}>Base rate</span>
                        <span style={{ marginLeft: "auto", fontFamily: FM, color: C.hi, fontWeight: 700 }}>
                            {money(lv.pay)}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.lo, marginTop: 2, lineHeight: 1.5 }}>
                        The full benefits breakdown (H&W, pension, vacation, etc.) is only on file for Level 2 right now — this will fill in for other levels as that paperwork comes in.
                    </div>
                </div>
                </>
                )}
            </Fold>

            {/* the four work processes */}
            <Fold
                icon={GraduationCap}
                title="The four work processes"
                color={CATS_META.A.color}
            >
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                    {["A", "B", "C", "D"].map((k) => {
                        const m = CATS_META[k];
                        const v = t[k.toLowerCase()];
                        return (
                            <div
                                key={k}
                                style={{
                                    display: "flex",
                                    gap: 9,
                                    background: C.sunk,
                                    border: "1px solid " + C.line,
                                    borderRadius: 9,
                                    padding: "10px 11px",
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        width: 20,
                                        height: 20,
                                        borderRadius: 5,
                                        background: m.color + "22",
                                        border: "1px solid " + m.color + "66",
                                        color: m.color,
                                        fontFamily: FM,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {k}
                                </span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}
                                    >
                                        <span
                                            className="truncate"
                                            style={{
                                                fontSize: 12.5,
                                                fontWeight: 700,
                                                color: C.hi,
                                            }}
                                        >
                                            {m.name}
                                        </span>
                                        <span
                                            style={{
                                                marginLeft: "auto",
                                                flexShrink: 0,
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: C.lo,
                                            }}
                                        >
                                            {hrsFmt(v)} /{" "}
                                            {m.target.toLocaleString()}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: C.mid,
                                            marginTop: 4,
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {m.desc}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Fold>


            {/* certs — either the training center enters these, or you
                self-report by picking from COMMON_CERTS (lib/core.ts) below.
                Same table either way; a self-reported row looks identical
                to an admin-entered one once saved. */}
            <Fold icon={Check} title="Certifications" color={C.gc}>
                {certs.length === 0 && (
                    <div style={{ fontSize: 12.5, color: C.lo }}>
                        Nothing on file yet — add one below, or your admin
                        can enter it.
                    </div>
                )}
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                    {certs.map((c) => {
                        const st = certState(c.exp);
                        const pp = mParse(c.exp.slice(0, 7));
                        const day = Number(c.exp.slice(8));
                        return (
                            <div
                                key={c.id}
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
                                <span
                                    style={{
                                        width: 3,
                                        alignSelf: "stretch",
                                        borderRadius: 2,
                                        background: st.c,
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                        className="truncate"
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: C.hi,
                                        }}
                                    >
                                        {c.n}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 10.5,
                                            color: C.lo,
                                            fontFamily: FM,
                                            marginTop: 2,
                                        }}
                                    >
                                        {st.days < 0 ? "expired" : "expires"}{" "}
                                        {MONTHS[pp.m]} {day}, {pp.y}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontFamily: FM,
                                        fontSize: 9,
                                        fontWeight: 800,
                                        letterSpacing: 0.4,
                                        color: st.c,
                                        border: "1px solid " + st.c + "55",
                                        borderRadius: 5,
                                        padding: "2px 5px",
                                    }}
                                >
                                    {st.t}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* self-report picker — pick a name from COMMON_CERTS, not
                    free text, and won't save without an expiration date. */}
                <div
                    style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid " + C.line,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: 0.5,
                            color: C.lo,
                            fontFamily: FM,
                            marginBottom: 6,
                        }}
                    >
                        ADD ONE YOU HOLD
                    </div>
                    <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                    >
                        {COMMON_CERTS.map((name) => {
                            const existing = certs.find((c) => c.n === name);
                            const on = addingCert === name;
                            return (
                                <button
                                    key={name}
                                    className="foc"
                                    onClick={() => {
                                        setAddingCert(name);
                                        setCertExp(existing?.exp || "");
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "8px 11px",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: on ? C.gc + "22" : C.sunk,
                                        color: on ? C.gc : C.hi,
                                        border:
                                            "1px solid " +
                                            (on ? C.gc + "66" : C.line),
                                    }}
                                >
                                    {name}
                                    {existing && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: C.lo,
                                                fontFamily: FM,
                                            }}
                                        >
                                            on file
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {addingCert && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 10,
                            }}
                        >
                            <input
                                className="foc"
                                type="date"
                                value={certExp}
                                onChange={(e) => setCertExp(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: C.sunk,
                                    color: C.hi,
                                    border: "1px solid " + C.line,
                                    borderRadius: 8,
                                    padding: "9px 10px",
                                    fontSize: 13,
                                    fontFamily: FM,
                                }}
                            />
                            <button
                                className="foc"
                                disabled={!certExp || certSaving}
                                onClick={() => {
                                    if (!certExp) return;
                                    setCertSaving(true);
                                    const existing = certs.find(
                                        (c) => c.n === addingCert,
                                    );
                                    const id =
                                        existing?.id ||
                                        "cert" +
                                            Date.now().toString(36) +
                                            Math.random()
                                                .toString(36)
                                                .slice(2, 5);
                                    onSaveCert(id, addingCert, certExp);
                                    setCertSaving(false);
                                    setAddingCert(null);
                                    setCertExp("");
                                }}
                                style={{
                                    flexShrink: 0,
                                    padding: "9px 14px",
                                    borderRadius: 8,
                                    background: certExp
                                        ? C.working
                                        : C.raise,
                                    color: certExp ? C.inkGood : C.lo,
                                    border:
                                        "1px solid " +
                                        (certExp ? C.working : C.line),
                                    fontWeight: 800,
                                    fontSize: 12.5,
                                    opacity: certSaving ? 0.7 : 1,
                                }}
                            >
                                Save
                            </button>
                        </div>
                    )}
                    <div
                        style={{
                            fontSize: 10.5,
                            color: C.lo,
                            marginTop: 8,
                            lineHeight: 1.45,
                        }}
                    >
                        Pick what you have, then set when it expires — it
                        won't save without a date.
                    </div>
                </div>
            </Fold>

            <Fold icon={GraduationCap} title="Class curriculum" color={KLASS}>
                <ClassCurriculum completed={new Set(completedClasses)} onToggle={onToggleCompletedClass} selfReport />
            </Fold>

            <button
                className="foc"
                onClick={onOpenRules}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: C.panel,
                    border: "1px solid " + C.line,
                    borderRadius: 10,
                    padding: "15px 16px",
                    color: C.hi,
                }}
            >
                <ShieldAlert size={15} color={C.brand} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>JATC Rules & Regulations — full reference</span>
                <ChevronRight size={16} color={C.lo} style={{ marginLeft: "auto" }} />
            </button>

            <Fold icon={FileDown} title="Blank OJT form" color={C.gc}>
                <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5, marginBottom: 12 }}>
                    A blank copy of the union's monthly OJT slip — fill it out by hand, then scan it back in with Upload above when it's done.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <a
                        href="/ojt-form-blank.pdf"
                        download
                        className="foc"
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "10px",
                            borderRadius: 9,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            color: C.hi,
                            fontWeight: 700,
                            fontSize: 12.5,
                            textDecoration: "none",
                        }}
                    >
                        <FileDown size={14} /> PDF
                    </a>
                    <a
                        href="/ojt-form-blank.xlsx"
                        download
                        className="foc"
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "10px",
                            borderRadius: 9,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            color: C.hi,
                            fontWeight: 700,
                            fontSize: 12.5,
                            textDecoration: "none",
                        }}
                    >
                        <FileDown size={14} /> Excel
                    </a>
                </div>
            </Fold>

            {/* data */}
            <Fold icon={Check} title="Account" color={C.mid}>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                    {[
                        ["Signed in as", email || "—"],
                        ["Role", isAdmin ? "Admin" : "Member"],
                    ].map(([k, v]) => (
                        <div
                            key={k}
                            style={{ display: "flex", fontSize: 12.5 }}
                        >
                            <span style={{ color: C.mid }}>{k}</span>
                            <span
                                className="truncate"
                                style={{
                                    marginLeft: "auto",
                                    fontFamily: FM,
                                    color: C.hi,
                                    fontWeight: 700,
                                    maxWidth: "60%",
                                    textAlign: "right",
                                }}
                            >
                                {v}
                            </span>
                        </div>
                    ))}
                </div>
                <button
                    className="foc signout-btn"
                    disabled={signingOut}
                    onClick={() => {
                        if (signingOut) return;
                        setSigningOut(true);
                        onSignOut();
                    }}
                    style={{
                        width: "100%",
                        marginTop: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        background: "transparent",
                        color: C.mid,
                        border: "1px solid " + C.line,
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        opacity: signingOut ? 0.6 : 1,
                    }}
                >
                    {signingOut ? "Signing out…" : "Sign out"}
                </button>
                <div
                    style={{
                        fontSize: 10.5,
                        color: C.lo,
                        marginTop: 8,
                        lineHeight: 1.5,
                    }}
                >
                    Hours sync to your own account. The schedule (Board tab)
                    is shared; only an admin can add or change it.
                </div>
                <button
                    className="foc"
                    onClick={() => setPwModal(true)}
                    style={{
                        width: "100%",
                        marginTop: 8,
                        background: "transparent",
                        color: C.gc,
                        border: "1px solid " + C.line,
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 12.5,
                        fontWeight: 700,
                    }}
                >
                    Change password
                </button>
            </Fold>

            {pwModal && (
                <Modal title="Change password" onClose={() => setPwModal(false)}>
                    <PasswordSetter onSaved={onPasswordSet} />
                </Modal>
            )}

            {classInfo && (
                <Modal
                    title={classInfo.name}
                    sub="Assigned by your admin — mandatory, unpaid"
                    onClose={() => setClassInfo(null)}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {classInfo.start != null && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                <Clock size={14} color={C.lo} style={{ flexShrink: 0 }} />
                                <span style={{ color: C.hi, fontWeight: 700 }}>{fmtClock(classInfo.start)}</span>
                            </div>
                        )}
                        {classInfo.loc && (
                            <a
                                className="foc"
                                href={mapsUrl(classInfo.loc)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    background: C.raise,
                                    border: "1px solid " + C.line,
                                    borderRadius: 9,
                                    padding: "10px 11px",
                                    textDecoration: "none",
                                }}
                            >
                                <MapPin size={14} color={KLASS} style={{ flexShrink: 0 }} />
                                <span
                                    className="truncate"
                                    style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: C.hi }}
                                >
                                    {classInfo.loc}
                                </span>
                                <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, fontWeight: 800, color: KLASS }}>
                                    DIRECTIONS
                                </span>
                                <ChevronRight size={14} color={C.lo} style={{ flexShrink: 0 }} />
                            </a>
                        )}
                        {classInfo.note && (
                            <div
                                style={{
                                    background: C.sunk,
                                    border: "1px solid " + C.line,
                                    borderRadius: 9,
                                    padding: "9px 10px",
                                    fontSize: 12.5,
                                    color: C.mid,
                                    lineHeight: 1.5,
                                }}
                            >
                                {classInfo.note}
                            </div>
                        )}
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
                                DATES
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {(classInfo.dates || [])
                                    .slice()
                                    .sort()
                                    .map((d) => {
                                        const missed =
                                            (classInfo.missedDates || []).indexOf(d) !== -1;
                                        const label = missed
                                            ? "MISSED"
                                            : d < todayKey
                                              ? "ATTENDED"
                                              : "SCHEDULED";
                                        return (
                                            <div
                                                key={d}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 9,
                                                    background: C.raise,
                                                    border:
                                                        "1px solid " +
                                                        (missed ? C.danger + "55" : C.edge),
                                                    borderRadius: 8,
                                                    padding: "8px 10px",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 3,
                                                        alignSelf: "stretch",
                                                        borderRadius: 2,
                                                        background: missed ? C.danger : C.working,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontFamily: FM,
                                                        fontSize: 12.5,
                                                        fontWeight: 700,
                                                        color: C.hi,
                                                        flex: 1,
                                                    }}
                                                >
                                                    {longDate(fromKey(d))}
                                                </span>
                                                <span
                                                    style={{
                                                        fontFamily: FM,
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: missed ? C.danger : C.working,
                                                        border:
                                                            "1px solid " +
                                                            (missed ? C.danger : C.working) +
                                                            "55",
                                                        borderRadius: 5,
                                                        padding: "2px 6px",
                                                    }}
                                                >
                                                    {label}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* JATC office (training center) + District Council 36 — two
                separate tables (jatc_contacts, dc36_contacts), one Fold, so
                apprentices see one "Contacts" row instead of two. */}
            <Fold icon={Phone} title="Contacts" color={C.working}>
                <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                    JATC OFFICE
                </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    {jatcContacts.map((c) => (
                        <div
                            key={c.n}
                            style={{
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
                                <span
                                    className="truncate"
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: C.hi,
                                    }}
                                >
                                    {c.n}
                                </span>
                                {c.tel && (
                                    <a
                                        className="foc"
                                        href={
                                            "tel:" +
                                            c.tel +
                                            (c.ext ? "," + c.ext : "")
                                        }
                                        style={{
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 5,
                                            background: "rgba(47,176,122,0.14)",
                                            color: C.working,
                                            textDecoration: "none",
                                            padding: "6px 8px",
                                            borderRadius: 7,
                                            fontWeight: 800,
                                            fontSize: 11,
                                            border: "1px solid rgba(47,176,122,0.3)",
                                        }}
                                    >
                                        <Phone size={11} />
                                        {fmtTel(c.tel)}{c.ext ? " x" + c.ext : ""}
                                    </a>
                                )}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 10,
                                    marginTop: 6,
                                }}
                            >
                                {c.email && (
                                    <a
                                        className="foc"
                                        href={"mailto:" + c.email}
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 10.5,
                                            color: C.gc,
                                            textDecoration: "none",
                                        }}
                                    >
                                        {c.email}
                                    </a>
                                )}
                                {c.sms && (
                                    <a
                                        className="foc"
                                        href={"sms:" + c.sms}
                                        style={{
                                            fontFamily: FM,
                                            fontSize: 10.5,
                                            color: C.lo,
                                            textDecoration: "none",
                                        }}
                                    >
                                        text {fmtTel(c.sms)}
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    <a
                        className="foc"
                        href={mapsUrl(JATC.office)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "10px 11px",
                            textDecoration: "none",
                        }}
                    >
                        <MapPin
                            size={13}
                            color={C.working}
                            style={{ flexShrink: 0 }}
                        />
                        <span
                            className="truncate"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12,
                                color: C.hi,
                            }}
                        >
                            {JATC.office}
                        </span>
                        <ChevronRight
                            size={14}
                            color={C.lo}
                            style={{ flexShrink: 0 }}
                        />
                    </a>
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: C.lo,
                        marginTop: 9,
                        lineHeight: 1.5,
                    }}
                >
                    Out-of-work lists go to the employers every Friday — it's on
                    you to tell the office when you're off a job, and again when
                    you get scheduled.
                </div>
                {dc36Contacts.length > 0 && (
                <>
                <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                    DISTRICT COUNCIL (DC36)
                </div>
                    <div
                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                    >
                        {dc36Contacts.map((c) => (
                            <div
                                key={c.n}
                                style={{
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
                                    <span
                                        className="truncate"
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: C.hi,
                                        }}
                                    >
                                        {c.n}
                                    </span>
                                    {c.tel && (
                                        <a
                                            className="foc"
                                            href={
                                                "tel:" +
                                                c.tel +
                                                (c.ext ? "," + c.ext : "")
                                            }
                                            style={{
                                                flexShrink: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 5,
                                                background: "rgba(127,178,255,0.14)",
                                                color: C.gc,
                                                textDecoration: "none",
                                                padding: "6px 8px",
                                                borderRadius: 7,
                                                fontWeight: 800,
                                                fontSize: 11,
                                                border: "1px solid rgba(127,178,255,0.3)",
                                            }}
                                        >
                                            <Phone size={11} />
                                            {fmtTel(c.tel)}{c.ext ? " x" + c.ext : ""}
                                        </a>
                                    )}
                                </div>
                                {(c.email || c.sms) && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 10,
                                            marginTop: 6,
                                        }}
                                    >
                                        {c.email && (
                                            <a
                                                className="foc"
                                                href={"mailto:" + c.email}
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 10.5,
                                                    color: C.gc,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                {c.email}
                                            </a>
                                        )}
                                        {c.sms && (
                                            <a
                                                className="foc"
                                                href={"sms:" + c.sms}
                                                style={{
                                                    fontFamily: FM,
                                                    fontSize: 10.5,
                                                    color: C.lo,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                text {fmtTel(c.sms)}
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
                )}
            </Fold>
        </div>
    );
}

function PwInput({ value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
            }}
        >
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={{
                    width: "100%",
                    background: C.sunk,
                    border: "1px solid " + C.line,
                    borderRadius: 8,
                    padding: "9px 34px 9px 10px",
                    color: C.hi,
                    fontSize: 12.5,
                }}
            />
            <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                style={{
                    position: "absolute",
                    right: 8,
                    background: "transparent",
                    border: "none",
                    color: C.lo,
                    padding: 2,
                    display: "flex",
                }}
            >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    );
}

function PasswordSetter({ onSaved }) {
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [state, setState] = useState("idle"); // idle | saving | done | error
    const [msg, setMsg] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (pw.length < 8) {
            setState("error");
            setMsg("At least 8 characters.");
            return;
        }
        if (pw !== pw2) {
            setState("error");
            setMsg("Passwords don't match.");
            return;
        }
        setState("saving");
        setMsg("");
        const res = await store.setPassword(pw);
        if (res.ok) {
            setState("done");
            setPw("");
            setPw2("");
            setMsg(
                "Password set. You'll get an email confirming it, and can sign in with it next time.",
            );
            onSaved?.();
        } else {
            setState("error");
            setMsg(res.error || "Couldn't set password.");
        }
    };

    return (
        <form onSubmit={submit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <PwInput
                    value={pw}
                    onChange={(e) => {
                        setPw(e.target.value);
                        setState("idle");
                    }}
                    placeholder="new password (8+ characters)"
                />
                <PwInput
                    value={pw2}
                    onChange={(e) => {
                        setPw2(e.target.value);
                        setState("idle");
                    }}
                    placeholder="retype password"
                />
                <button
                    className="foc"
                    type="submit"
                    disabled={state === "saving" || !pw || !pw2}
                    style={{
                        background: state === "done" ? C.working : C.brand,
                        color: state === "done" ? C.inkGood : C.ink,
                        border: "none",
                        borderRadius: 10,
                        padding: "12px",
                        fontSize: 14,
                        fontWeight: 800,
                        opacity: state === "saving" ? 0.6 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                    }}
                >
                    {state === "done" && <Check size={13} />}
                    {state === "saving"
                        ? "Saving…"
                        : state === "done"
                          ? "Saved"
                          : "Save"}
                </button>
            </div>
            {msg && (
                <div
                    style={{
                        marginTop: 7,
                        fontSize: 11.5,
                        color: state === "error" ? C.danger : C.working,
                    }}
                >
                    {msg}
                </div>
            )}
            <div
                style={{
                    fontSize: 10.5,
                    color: C.lo,
                    marginTop: 7,
                    lineHeight: 1.5,
                }}
            >
                Lets you sign in with email + password next time instead of
                waiting on a link.
            </div>
        </form>
    );
}
