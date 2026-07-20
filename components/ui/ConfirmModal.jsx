"use client";

/* Generic yes/no confirmation dialog, apprentice-facing. Extracted after
   the third near-identical copy (MonthForm, OjtImportFlow, /pending) —
   admin has its own separate copy in components/admin/shared.jsx, kept
   decoupled since admin/ and apprentice/ don't otherwise cross-import.
   tone "danger" (delete, the default) reads red; tone "confirm" (a
   positive action that still deserves a deliberate second tap, like
   OJT auto-approve) reads brand-colored instead of alarming. */
import { C } from "@/lib/core";
import { Modal } from "@/components/ui/Modal";

export function ConfirmModal({ title, message, confirmLabel = "Delete", tone = "danger", onConfirm, onClose }) {
    const color = tone === "danger" ? C.danger : C.brand;
    const ink = tone === "danger" ? C.inkBad : C.ink;
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
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: color, color: ink, border: "none", fontWeight: 800, fontSize: 14 }}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}
