"use client";

/* Expand/collapse reference card — used throughout the OJT tab for the
   static/reference panels (pay rules, curriculum, contacts, ...). Matches
   the components/ui/ convention (Modal.jsx, Stat.jsx): a generic shell,
   not tied to one tab. */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { C } from "@/lib/core";

export function Fold({ icon: Ico, title, color, children }) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button
                className="foc"
                onClick={() => setOpen((v) => !v)}
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
                <Ico size={15} color={color || C.brand} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
                <ChevronRight
                    size={16}
                    color={C.lo}
                    style={{
                        marginLeft: "auto",
                        transform: open ? "rotate(90deg)" : "none",
                        transition: "transform .15s",
                    }}
                />
            </button>
            {open && (
                <div
                    style={{
                        marginTop: 6,
                        background: C.panel,
                        border: "1px solid " + C.line,
                        borderRadius: 10,
                        padding: "16px 17px",
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
