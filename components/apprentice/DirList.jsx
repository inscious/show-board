"use client";

/* Company directory — pinned + searchable list, opened from the "Companies"
   modal on Home/Board. Fully prop-driven, same extraction pattern as
   CoPicker/DaySheet/BookingForm. */
import { useContext, useMemo, useState } from "react";
import { Phone, Search, Star, X } from "lucide-react";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { C, FM, FS, fmtTel } from "@/lib/core";

export function DirList({ pins, onTogglePin, customCos }) {
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
