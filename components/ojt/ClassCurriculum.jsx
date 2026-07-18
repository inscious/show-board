"use client";

/* The full 3-year, 61-class curriculum reference — Year 1/2/3 pill
   selector, classes grouped by category within the year (mirrors the
   printed color-coded reference sheet). Read-only: no completion state,
   since nothing yet links a curriculum classNumber to a scheduled `classes`
   row (see JATC_CURRICULUM's comment in lib/core.ts). Content only, mounted
   inside an existing <Fold> in components/ShowBoard.jsx. */
import { useState, useMemo } from "react";
import { C, FM, JATC_CURRICULUM, CURRICULUM_CATEGORY_COLOR } from "@/lib/core";

const YEARS = ["1", "2", "3"];

export function ClassCurriculum() {
  const [year, setYear] = useState("1");
  const classes = JATC_CURRICULUM.years[year];

  const grouped = useMemo(() => {
    const byCat = {};
    classes.forEach((c) => {
      (byCat[c.category] = byCat[c.category] || []).push(c);
    });
    return Object.entries(byCat);
  }, [classes]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {YEARS.map((y) => {
          const on = y === year;
          return (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                background: on ? C.brand : C.sunk,
                color: on ? "#1A1206" : C.mid,
                border: "1px solid " + (on ? C.brand : C.line),
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              Year {y}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.map(([category, rows]) => (
          <div key={category}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CURRICULUM_CATEGORY_COLOR[category] || C.lo, flexShrink: 0 }} />
              <span style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM }}>{category.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rows.map((c) => (
                <div key={c.classNumber} style={{ display: "flex", alignItems: "center", gap: 9, background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.lo }}>
                    {c.classNumber}
                  </span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>
                    {c.description}
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, color: C.lo }}>
                    #{c.courseId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: C.lo, marginTop: 12, lineHeight: 1.5 }}>
        Every class in the program, for reference — your admin still assigns actual dates on the Class Schedule card above.
      </div>
    </div>
  );
}
