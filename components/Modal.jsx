"use client";

/* The generic overlay modal — used everywhere (Home, Board, Calendar, OJT,
   and ShowBoard's own top-level modal dispatch). Split into its own module
   (same reasoning as DirectoryContext/Stat) so the per-tab files under
   components/tabs/ can share it without a circular import back through
   ShowBoard.jsx. */
import { X } from "lucide-react";
import { C } from "@/lib/core";

export function Modal({ title, sub, onClose, children }) {
    return (
        <div
            className="modal-ovl"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                background: "rgba(0,0,0,0.62)",
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="modal-panel"
                style={{
                    background: C.panel,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 18px 12px",
                        borderBottom: "1px solid " + C.line,
                    }}
                >
                    <div style={{ minWidth: 0 }}>
                        <div
                            className="truncate"
                            style={{
                                fontWeight: 800,
                                fontSize: 16,
                                letterSpacing: 0.2,
                            }}
                        >
                            {title}
                        </div>
                        {sub && (
                            <div
                                className="truncate"
                                style={{
                                    fontSize: 11.5,
                                    color: C.lo,
                                    marginTop: 2,
                                }}
                            >
                                {sub}
                            </div>
                        )}
                    </div>
                    <button
                        className="foc"
                        onClick={onClose}
                        style={{
                            flexShrink: 0,
                            background: C.raise,
                            border: "1px solid " + C.line,
                            borderRadius: 8,
                            padding: 6,
                            color: C.mid,
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
                <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
            </div>
        </div>
    );
}
