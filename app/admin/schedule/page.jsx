"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdmin } from "@/lib/AdminContext";
import { ScheduleTab } from "@/components/admin/tabs/ScheduleTab";

function AdminScheduleInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { shows, load } = useAdmin();
  const focusId = searchParams.get("show");

  return (
    <ScheduleTab shows={shows} onChanged={load} focusId={focusId}
      onFocusHandled={() => router.replace("/admin/schedule")} />
  );
}

export default function AdminSchedulePage() {
  return (
    <Suspense fallback={null}>
      <AdminScheduleInner />
    </Suspense>
  );
}
