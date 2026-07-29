"use client";

/* Read-only apprenticeship history for a CJ who actually has real OJT
   months on file — either a fresh graduate promoted straight through the
   app (full history, most levels DONE) or a veteran who logged a handful
   before certifying. Reuses LevelList/OjtLog exactly as the active
   apprentice OJT tab does (same ojtRows/ojtTotals data prep) — the only
   difference is framing (a Fold titled "history", not a tracker) and no
   edit affordance on the monthly rows. Caller is responsible for only
   rendering this when there's actually something to show — a CJ with zero
   months (never did a formal apprenticeship) should see no trace of it. */
import { useMemo } from "react";
import { History } from "lucide-react";
import { C, ojtRows, ojtTotals, rollupEntries } from "@/lib/core";
import { Fold } from "@/components/ui/Fold";
import { LevelList } from "@/components/ojt/LevelList";
import { OjtLog } from "@/components/ojt/OjtLog";

export function PreviousProgressionCard({ ojt, entries }) {
    const approvedMonths = useMemo(
        () => (ojt.months || []).filter((m) => m.status === "approved"),
        [ojt.months],
    );
    const rows = useMemo(() => ojtRows(approvedMonths), [approvedMonths]);
    const t = useMemo(() => ojtTotals(approvedMonths), [approvedMonths]);
    const roll = useMemo(() => rollupEntries(entries), [entries]);
    const avg = approvedMonths.length ? t.total / approvedMonths.length : 0;
    const lastMonth = rows.length ? rows[rows.length - 1].m : null;

    return (
        <Fold icon={History} title="Apprenticeship History" color={C.mid}>
            <div style={{ fontSize: 11.5, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
                Your record from before you certified — read-only, kept for reference.
            </div>
            <LevelList total={t.total} avg={avg} lastMonth={lastMonth} />
            <div style={{ marginTop: 14 }}>
                <OjtLog rows={rows} roll={roll} onEdit={() => {}} />
            </div>
        </Fold>
    );
}
