"use client";

/* Add/edit a submitted OJT month — opened from the OJT tab's "Add month"
   button or tapping an existing row. Fully prop-driven, same extraction
   pattern as CoPicker/DaySheet/BookingForm/DirList. ConfirmModal is bundled
   here rather than its own file since MonthForm is its only call site. */
import { useState } from "react";
import { CalendarDays, Copy, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
    C,
    CATS_META,
    FM,
    FS,
    MON_FULL,
    hrsFmt,
    mKey,
    mMed,
    mParse,
    num,
    todayMid,
} from "@/lib/core";

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
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: C.danger, color: C.inkBad, border: "none", fontWeight: 800, fontSize: 14 }}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

export function MonthForm({ initial, roll, existing, onSave, onDelete, onClose }) {
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
                        color: C.ink,
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
