"use client";

/* The "I got scheduled" modal — pick a company, a show, and the days,
   reusing CoPicker and its own inline month-grid day picker. Fully
   prop-driven, same extraction pattern as DaySheet.jsx. */
import { useState } from "react";
import { Ban, Building2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { CoPicker } from "@/components/apprentice/CoPicker";
import {
    BOOKED,
    C,
    DOW,
    FM,
    FS,
    MONTHS,
    coColor,
    fromKey,
    isPast,
    keyOf,
    monthGrid,
    sameDay,
    sortDate,
    todayMid,
} from "@/lib/core";

export function BookingForm({
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
