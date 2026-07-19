"use client";

import { useRouter, useParams } from "next/navigation";
import { useAdmin } from "@/lib/AdminContext";
import { ApprenticeDetail } from "@/components/admin/ApprenticeDetail";
import { C } from "@/lib/core";

export default function AdminApprenticeDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { apprentices, monthsByUser, bookingsByUser, flagsByUser, classesByUser, certsByUser, completedClassesByUser, shows, openAssignClass, load } = useAdmin();

  const apprentice = apprentices.find((a) => a.id === id);
  if (!apprentice) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: C.lo, fontSize: 13 }}>
        Apprentice not found.
      </div>
    );
  }

  return (
    <ApprenticeDetail apprentice={apprentice} months={monthsByUser[id] || []}
      bookings={bookingsByUser[id] || []} flags={flagsByUser[id] || []}
      classes={classesByUser[id] || []} certs={certsByUser[id] || []} shows={shows}
      completedClasses={completedClassesByUser[id] || []}
      onAssignClass={() => openAssignClass([id])}
      onBack={() => router.push("/admin/roster")} onChanged={load} />
  );
}
