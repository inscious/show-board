"use client";

/* "On the floor today" / "next move-ins" — the same shared `shows` table the
   apprentice's own Home tab reads, just not filtered to "mine" since admin
   cares about the whole union schedule. Self-fetches the company directory
   for the phone-number lookup, same pattern as CompanyDirectoryPanel.

   First piece pulled out of the once-monolithic AdminBoard.jsx (2026-07) —
   splitting it further, file by file, as later admin work touches each part. */
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, REGION, todayMid, showsOn, sortDate, mkDate, showYear, matchCo, countdown, fmtTel } from "@/lib/core";

export function OnTheFloorPanel({ shows, onSelectShow }) {
  const [companies, setCompanies] = useState(null);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("companies").select("*");
      setCompanies((data || []).map((c) => ({ n: c.name, city: c.city || "", st: c.state || "", tel: c.labor_line || "", fm: c.foreman || "" })));
    })();
  }, []);

  const today = todayMid();
  const onFloor = useMemo(() => showsOn(shows, today).sort((a, b) => sortDate(a) - sortDate(b)), [shows, today.getTime()]);
  const nextUp = useMemo(() => shows
    .filter((s) => { const mi = mkDate(s.mi, showYear(s)) || mkDate(s.start, showYear(s)); return mi && mi > today; })
    .sort((a, b) => sortDate(a) - sortDate(b))
    .slice(0, 3), [shows, today.getTime()]);

  if (onFloor.length === 0 && nextUp.length === 0) return null;

  // grid, not a single-column stack — a full-width row of text reads fine on
  // a 380px phone but turns into an absurdly wide, mostly-empty card on a
  // desktop monitor. Cards stay a sane width and wrap into columns instead.
  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 };

  const ShowCard = (s) => {
    const region = REGION[s.region] || REGION.OTHER;
    const gc = companies ? matchCo(s.co, s.region, companies) : null;
    // gc.name carries the region-resolved branch (e.g. "Freeman Expo (SD)"
    // vs "(LA)") — the bare s.co code alone ("FREEMAN") doesn't say which
    // office actually called this show. Directory names are kept short
    // ("Freeman Expo", "GES", "Spiro") specifically so this fits a card.
    const coLabel = gc?.name || (s.co || "TBD").toUpperCase();
    return (
      <button
        key={s.id}
        className="foc"
        onClick={() => onSelectShow?.(s.id)}
        style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 8, background: C.raise, border: "1px solid " + region.color + "3A", borderRadius: 9, padding: "13px 12px", cursor: "pointer" }}
      >
        <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: region.color, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{s.name}</div>
          <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
            {s.loc}{s.booth && s.booth !== "TBD" ? " · " + s.booth : ""}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", maxWidth: 140 }}>
          <div className="truncate" style={{ fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.gc }}>{coLabel}</div>
          {gc && gc.tel && <div style={{ fontFamily: FM, fontSize: 10, color: C.lo, marginTop: 2 }}>{fmtTel(gc.tel)}</div>}
        </div>
      </button>
    );
  };

  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 12 }}>
      {onFloor.length > 0 && (
        <div style={{ marginBottom: nextUp.length ? 13 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: C.working, boxShadow: "0 0 8px " + C.working }} />
            <span style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.working, fontFamily: FM, fontWeight: 800 }}>ON THE FLOOR TODAY</span>
            <span style={{ marginLeft: "auto", fontFamily: FM, fontSize: 10, color: C.lo }}>{onFloor.length}</span>
          </div>
          <div style={gridStyle}>{onFloor.slice(0, 5).map(ShowCard)}</div>
        </div>
      )}
      {nextUp.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: 0.8, color: C.lo, fontFamily: FM, marginBottom: 8 }}>NEXT MOVE-INS</div>
          <div style={gridStyle}>
            {nextUp.map((s) => {
              const cd = countdown(s);
              const region = REGION[s.region] || REGION.OTHER;
              return (
                <button
                  key={s.id}
                  className="foc"
                  onClick={() => onSelectShow?.(s.id)}
                  style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "13px 12px", cursor: "pointer" }}
                >
                  <div style={{ flexShrink: 0, width: 42, textAlign: "center" }}>
                    <div style={{ fontFamily: FM, fontSize: 14, fontWeight: 800, color: region.color, lineHeight: 1.1 }}>{s.mi}</div>
                    <div style={{ fontFamily: FM, fontSize: 8.5, color: C.lo, marginTop: 1 }}>MOVE IN</div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{s.name}</div>
                    <div className="truncate" style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>{s.loc} · {s.co || "TBD"}</div>
                  </div>
                  {cd && (
                    <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color: cd.c, border: "1px solid " + cd.c + "55", borderRadius: 5, padding: "2px 6px" }}>{cd.t}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
