"use client";

import { C, SHADOW, FM } from "@/lib/core";
import { usePlatform } from "@/lib/PlatformContext";
import { Stat } from "@/components/admin/shared";

const TYPE_LABEL = {
  union: "Union",
  labor_provider: "Labor provider",
  district_council: "District council",
  general_contractor: "General contractor",
  training_center: "Training center",
};

function MetricsStrip({ metrics }) {
  if (!metrics) {
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ flex: 1, height: 62, borderRadius: 12 }} />
        <div className="skeleton" style={{ flex: 1, height: 62, borderRadius: 12 }} />
        <div className="skeleton" style={{ flex: 1, height: 62, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <Stat label="ORGANIZATIONS" value={metrics.organizations} />
      <Stat label="ACCOUNTS" value={metrics.accounts} />
      <Stat label="PLATFORM ADMINS" value={metrics.platformAdmins} />
    </div>
  );
}

function PlatformSettingsCard({ settings }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "14px 16px", boxShadow: SHADOW, marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PLATFORM SETTINGS</div>
      <div style={{ fontSize: 11, color: C.lo, lineHeight: 1.5, marginBottom: 10 }}>
        Local 831's settings specifically — every union now has its own row, but the console has no
        "view into a union" picker yet, so this always shows Local 831's.
      </div>
      {settings === null ? (
        <div className="skeleton" style={{ height: 20 }} />
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: settings.self_signup_enabled ? C.working : C.lo, border: "1px solid " + (settings.self_signup_enabled ? C.working : C.line) + "66", borderRadius: 6, padding: "3px 8px" }}>
            SELF-SIGNUP {settings.self_signup_enabled ? "ON" : "OFF"}
          </span>
          <span style={{ fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: settings.ojt_auto_approve ? C.working : C.lo, border: "1px solid " + (settings.ojt_auto_approve ? C.working : C.line) + "66", borderRadius: 6, padding: "3px 8px" }}>
            OJT AUTO-APPROVE {settings.ojt_auto_approve ? "ON" : "OFF"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PlatformHqPage() {
  const { organizations, metrics, settings } = usePlatform();

  return (
    <div>
      <MetricsStrip metrics={metrics} />
      <PlatformSettingsCard settings={settings} />
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
