"use client";

import { useAdmin } from "@/lib/AdminContext";
import { RosterTab } from "@/components/admin/tabs/RosterTab";

export default function AdminRosterPage() {
  const { activeApprentices, archivedApprentices, monthsByUser, goToApprentice, openNewApprentice, openAssignClass, openDoNotHire, openBulkArchive, load } = useAdmin();
  return (
    <RosterTab apprentices={activeApprentices} archivedApprentices={archivedApprentices} monthsByUser={monthsByUser} onSelect={goToApprentice}
      onAddApprentice={openNewApprentice} onAssignClass={() => openAssignClass([])} onDoNotHire={openDoNotHire}
      onBulkArchive={openBulkArchive} onChanged={load} />
  );
}
