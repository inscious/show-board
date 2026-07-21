"use client";

import { C, SHADOW, FM } from "@/lib/core";
import { usePlatform } from "@/lib/PlatformContext";

const TYPE_LABEL = {
  union: "Union",
  labor_provider: "Labor provider",
  district_council: "District council",
  general_contractor: "General contractor",
  training_center: "Training center",
};

export default function PlatformHqPage() {
  const { organizations } = usePlatform();

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, marginBottom: 8 }}>
        ORGANIZATIONS — {organizations.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {organizations.map((org) => (
          <div key={org.id} style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "14px 16px", boxShadow: SHADOW }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.hi }}>{org.name}</div>
              <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, whiteSpace: "nowrap" }}>
                {TYPE_LABEL[org.type] || org.type}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: C.mid, marginTop: 4 }}>
              Created {new Date(org.created_at).toLocaleDateString()}
              {org.archived_at && <span style={{ color: C.danger }}> · Archived</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
