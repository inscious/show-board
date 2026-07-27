"use client";

/* "On the floor today" / "next move-ins" — the same shared `shows` table the
   apprentice's own Home tab reads, just not filtered to "mine" since admin
   cares about the whole union schedule. Cards are the apprentice side's own
   MiniShowCard (same spine/date-block/badges/chips as the Board tab's
   ShowCard) — literal reuse, not a lookalike, so this stays in sync with
   whatever that looks like going forward.

   First piece pulled out of the once-monolithic AdminBoard.jsx (2026-07) —
   splitting it further, file by file, as later admin work touches each part. */
import { useMemo } from "react";
import { C, SHADOW, FM, todayMid, showsOn, sortDate } from "@/lib/core";
import { MiniShowCard } from "@/components/apprentice/tabs/MiniShowCard";

export function OnTheFloorPanel({ shows, onSelectShow }) {
  const today = todayMid();
  const onFloor = useMemo(() => showsOn(shows, today).sort((a, b) => sortDate(a) - sortDate(b)), [shows, today.getTime()]);
  const nextUp = useMemo(() => shows
    .filter((s) => sortDate(s) > today)
    .sort((a, b) => sortDate(a) - sortDate(b))
    .slice(0, 3), [shows, today.getTime()]);

  if (onFloor.length === 0 && nextUp.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      {onFloor.length > 0 && (
        <div style={{ marginBottom: nextUp.length ? 16 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 9, background: C.working, boxShadow: "0 0 8px " + C.working }} />
            <span style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.working, fontFamily: FM, fontWeight: 800 }}>ON THE FLOOR TODAY</span>
            <span style={{ marginLeft: "auto", fontFamily: FM, fontSize: 10, color: C.lo }}>{onFloor.length}</span>
          </div>
          <div className="floor-grid">
            {onFloor.slice(0, 5).map((s) => (
              <MiniShowCard key={s.id} show={s} onClick={() => onSelectShow?.(s.id)} />
            ))}
          </div>
        </div>
      )}
      {nextUp.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.lo, fontFamily: FM, marginBottom: 8 }}>NEXT MOVE-INS</div>
          <div className="floor-grid">
            {nextUp.map((s) => (
              <MiniShowCard key={s.id} show={s} onClick={() => onSelectShow?.(s.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
