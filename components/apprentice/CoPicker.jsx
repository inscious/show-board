"use client";

/* Company picker — shared by DaySheet, BookingForm, and the Board tab's own
   "co-picker" modal dispatch in ShowBoard.jsx's App. Pulled out on its own
   (rather than moving into DaySheet.jsx) because it has three call sites,
   not one. */
import { useContext, useMemo, useState } from "react";
import { Star, Check, Search, X, Plus } from "lucide-react";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { C, FM, FS, coColor } from "@/lib/core";

export function CoPicker({ value, pins, customCos, onPick, onAddCo, onClose }) {
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
