"use client";

/* The full 3-year, 61-class curriculum reference — Year 1/2/3 pill
   selector, classes grouped by category within the year (mirrors the
   printed color-coded reference sheet). Completion is optional: pass
   `completed` (a Set of course IDs) to highlight what's done, and
   `onToggle(courseId)` on top of that to make rows admin-editable — off
   the official JATC Student Progress Report, not self-reported. Without
   either prop this is pure read-only reference (the apprentice view before
   an admin has entered anything). Content only, mounted inside an existing
   <Fold>/panel in ShowBoard.jsx and AdminBoard.jsx. */
import { useState, useMemo } from "react";
import { Check } from "lucide-react";
import { C, FM, JATC_CURRICULUM, CURRICULUM_CATEGORY_COLOR } from "@/lib/core";

const YEARS = ["1", "2", "3"];
const ALL_CLASSES = [...JATC_CURRICULUM.years["1"], ...JATC_CURRICULUM.years["2"], ...JATC_CURRICULUM.years["3"]];

export function ClassCurriculum({ completed, onToggle }) {
  const [year, setYear] = useState("1");
  const classes = JATC_CURRICULUM.years[year];
  const editable = typeof onToggle === "function";
  const doneCount = completed ? ALL_CLASSES.filter((c) => completed.has(c.courseId)).length : null;

  const grouped = useMemo(() => {
    const byCat = {};
    classes.forEach((c) => {
      (byCat[c.category] = byCat[c.category] || []).push(c);
    });
    return Object.entries(byCat);
  }, [classes]);

  return (
    <div>
      {doneCount !== null && (
        <div style={{ fontSize: 11.5, color: C.mid, marginBottom: 12 }}>
          <span style={{ fontWeight: 800, color: C.working }}>{doneCount}</span> of {ALL_CLASSES.length} classes completed
        </div>
      )}

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
              {rows.map((c) => {
                const done = !!completed?.has(c.courseId);
                const Row = editable ? "button" : "div";
                return (
                  <Row
                    key={c.classNumber}
                    type={editable ? "button" : undefined}
                    onClick={editable ? () => onToggle(c.courseId) : undefined}
                    className={editable ? "foc" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      background: done ? "rgba(47,176,122,0.09)" : C.sunk,
                      border: "1px solid " + (done ? "rgba(47,176,122,0.4)" : C.line),
                      borderRadius: 8, padding: "8px 10px",
                      width: editable ? "100%" : undefined,
                      textAlign: editable ? "left" : undefined,
                    }}
                  >
                    {completed !== undefined && (
                      <span style={{
                        flexShrink: 0, width: 16, height: 16, borderRadius: 5,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done ? C.working : "transparent",
                        border: "1px solid " + (done ? C.working : C.line),
                      }}>
                        {done && <Check size={11} color="#06120C" />}
                      </span>
                    )}
                    <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.lo }}>
                      {c.classNumber}
                    </span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>
                      {c.description}
                    </span>
                    <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 10, color: C.lo }}>
                      #{c.courseId}
                    </span>
                  </Row>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: C.lo, marginTop: 12, lineHeight: 1.5 }}>
        {editable
          ? "Tap a class to mark it complete or not — cross-check against the apprentice's JATC Student Progress Report (Course ID column matches the # shown here)."
          : "Every class in the program, for reference — your admin still assigns actual dates on the Class Schedule card above."}
      </div>
    </div>
  );
}
