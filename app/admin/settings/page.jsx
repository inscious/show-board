"use client";

import { C, FM } from "@/lib/core";
import { useAdmin } from "@/lib/AdminContext";
import { AdminAccountsPanel } from "@/components/admin/AdminAccountsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { CompanyDirectoryPanel } from "@/components/admin/CompanyDirectoryPanel";
import { JatcContactsPanel } from "@/components/admin/JatcContactsPanel";
import { SelfSignupPanel } from "@/components/admin/SelfSignupPanel";
import { NewAdminForm } from "@/components/admin/NewAdminForm";

export default function AdminSettingsPage() {
  const { email, load } = useAdmin();
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, marginBottom: 8 }}>ACCESS</div>
      <SelfSignupPanel />
      <NewAdminForm onCreated={load} />
      <AdminAccountsPanel currentEmail={email} />

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, margin: "8px 0 8px" }}>DIRECTORY</div>
      <CompanyDirectoryPanel />
      <JatcContactsPanel />

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, margin: "8px 0 8px" }}>ACTIVITY</div>
      <AuditLogPanel />
    </>
  );
}
