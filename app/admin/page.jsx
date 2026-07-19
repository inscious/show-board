"use client";

import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/AdminContext";
import { DashboardTab } from "@/components/admin/tabs/DashboardTab";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { activeApprentices, monthsByUser, shows, classesByUser, certsByUser, goToApprentice, goToShow, load } = useAdmin();
  return (
    <DashboardTab apprentices={activeApprentices} monthsByUser={monthsByUser} shows={shows} classesByUser={classesByUser} certsByUser={certsByUser}
      onOpenApprentice={goToApprentice} onOpenDay={() => router.push("/admin/schedule")} onSelectShow={goToShow} onChanged={load} />
  );
}
