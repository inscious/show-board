"use client";

/* The generic overlay modal — used everywhere (Home, Board, Calendar, OJT,
   and ShowBoard's own top-level modal dispatch). Split into its own module
   (same reasoning as DirectoryContext/Stat) so the per-tab files under
   components/tabs/ can share it without a circular import back through
   ShowBoard.jsx.

   Opens with a CSS animation automatically (a plain animation on
   .modal-ovl/.modal-panel plays once whenever a fresh instance mounts —
   no class juggling needed for that direction). Closing is the harder
   direction with pure CSS, since the element normally vanishes from the
   DOM the instant the caller flips its state to null — so this holds the
   close for one animation's length via a local "closing" flag, plays the
   reverse keyframe, then calls the real onClose. Every close path
   (backdrop click, the X button) routes through requestClose so none of
   them skip the animation. */
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { C } from "@/lib/core";

const CLOSE_MS = 200;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, sub, onClose, children }) {
    const [closing, setClosing] = useState(false);
    const titleId = useId();
    const panelRef = useRef(null);
    const requestClose = () => {
        if (closing) return;
        setClosing(true);
        setTimeout(onClose, CLOSE_MS);
    };

    // focus enters the dialog on open and returns to whatever triggered it
    // once this instance actually leaves the DOM (the real unmount, after
    // the close animation above has already run onClose).
    useEffect(() => {
        const opener = document.activeElement;
        panelRef.current?.focus();
        return () => {
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, []);

    // Escape closes; Tab is trapped inside the panel so focus can't leak to
    // whatever's behind the overlay.
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === "Escape") {
                requestClose();
                return;
            }
            if (e.key !== "Tab") return;
            const focusables = panelRef.current?.querySelectorAll(FOCUSABLE);
            if (!focusables?.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closing]);

    return (
        <div
            className={"modal-ovl" + (closing ? " closing" : "")}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                background: "rgba(0,0,0,0.62)",
            }}
            onClick={requestClose}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                className={"modal-panel" + (closing ? " closing" : "")}
                style={{
                    background: C.panel,
                    display: "flex",
                    flexDirection: "column",
                    outline: "none",
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
                            id={titleId}
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
                        onClick={requestClose}
                        aria-label="Close"
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
