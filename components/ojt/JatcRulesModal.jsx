"use client";

/* The complete JATC Rules & Regulations reference — every section from
   JATC_RULES (lib/core.ts), rendered in one place so "where can I read the
   whole thing" has one obvious answer. Content only, no modal chrome of its
   own: mounted inside components/ShowBoard.jsx's existing <Modal>, same
   split as OjtImportFlow (a shared content component, not a modal wrapper),
   since Modal itself isn't exported from that file. */
import { C, FM, JATC_RULES } from "@/lib/core";

export function JatcRulesModal() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {JATC_RULES.map((section) => (
        <div key={section.id}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.brand, fontFamily: FM, fontWeight: 800, marginBottom: 8 }}>
            {section.title.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section.points.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: C.mid, lineHeight: 1.5 }}>
                <span style={{ color: C.line, flexShrink: 0 }}>•</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: C.lo, lineHeight: 1.5, paddingTop: 8, borderTop: "1px solid " + C.line }}>
        Summarized from the JATC Rules & Regulations packet — real names and direct phone numbers aren't repeated here; see the JATC office card for current contacts.
      </div>
    </div>
  );
}
