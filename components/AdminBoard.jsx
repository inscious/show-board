"use client";

/* Admin console — a genuinely separate experience from the apprentice
   dashboard (components/ShowBoard.jsx), not just extra buttons bolted onto
   it. Roster of apprentices (profile + OJT progress, editable), pending
   OJT-month approvals, and shared schedule management. */
import React, { useState, useEffect, useMemo } from "react";
import { HardHat, Users, CalendarDays, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS } from "@/lib/core";
import { AdminAccountsPanel } from "@/components/admin/AdminAccountsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { CompanyDirectoryPanel } from "@/components/admin/CompanyDirectoryPanel";
import { JatcContactsPanel } from "@/components/admin/JatcContactsPanel";
import { SelfSignupPanel } from "@/components/admin/SelfSignupPanel";
import { NewAdminForm } from "@/components/admin/NewAdminForm";
import { DashboardTab } from "@/components/admin/tabs/DashboardTab";
import { ScheduleTab } from "@/components/admin/tabs/ScheduleTab";
import { RosterTab, NewApprenticeForm, AssignClassForm, BulkDnhForm, BulkArchiveForm } from "@/components/admin/tabs/RosterTab";
import { ApprenticeDetail } from "@/components/admin/ApprenticeDetail";
import { Modal, groupByUser } from "@/components/admin/shared";

const ADMIN_TABS = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["roster", "Roster", Users],
  ["schedule", "Schedule", CalendarDays],
  ["settings", "Settings", SettingsIcon],
];

/* ---------- top pills (desktop, >=900px) / bottom tab bar (phone) — same
   split as the apprentice side's own NavBar (ShowBoard.jsx). This console
   didn't have a bottom-bar variant at all before; on a phone the pill row
   just sat at the top like a second header, out of thumb reach. ---------- */
function AdminNavBar({ tab, onSelect, variant }) {
  if (variant === "bottom") {
    return (
      <div style={{ display: "flex" }}>
        {ADMIN_TABS.map(([k, label, Icon]) => {
          const on = tab === k;
          return (
            <button key={k} className="foc" onClick={() => onSelect(k)}
              style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 0 8px", background: "transparent", border: "none" }}>
              {on && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 26, height: 2.5, borderRadius: 2, background: C.brand }} />}
              <Icon size={19} color={on ? C.brand : C.lo} />
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.2, color: on ? C.brand : C.lo }}>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, background: C.panel, borderRadius: 12, padding: 4, border: "1px solid " + C.edge, boxShadow: SHADOW, overflowX: "auto" }}>
      {ADMIN_TABS.map(([k, label, Icon]) => (
        <button key={k} className="foc tab-btn" data-active={tab === k} onClick={() => onSelect(k)}
          style={{ flex: 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 9, fontSize: 13, fontWeight: 800, background: tab === k ? C.brand : "transparent", color: tab === k ? "#1A1206" : C.mid, border: "none" }}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

/* ---------- shell ---------- */
export default function AdminBoard() {
  const [state, setState] = useState("loading"); // loading | ready
  const [email, setEmail] = useState(null);
  const [apprentices, setApprentices] = useState([]);
  const [monthsByUser, setMonthsByUser] = useState({});
  const [bookingsByUser, setBookingsByUser] = useState({});
  const [flagsByUser, setFlagsByUser] = useState({});
  const [classesByUser, setClassesByUser] = useState({});
  const [certsByUser, setCertsByUser] = useState({});
  const [completedClassesByUser, setCompletedClassesByUser] = useState({});
  const [shows, setShows] = useState([]);
  const [tab, setTab] = useState("dashboard"); // dashboard | roster | schedule | settings
  const [selectedId, setSelectedId] = useState(null);
  const [scheduleFocusId, setScheduleFocusId] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [classModal, setClassModal] = useState(false); // false | array of preselected userIds
  const [dnhModal, setDnhModal] = useState(false);
  const [bulkArchiveModal, setBulkArchiveModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = async () => {
    const supabase = createClient();
    // bookings/show_flags/classes each need their own "admin read"/"admin
    // write" RLS policy (see supabase/schema.sql) — until those are applied
    // they just come back empty and the relevant section quietly shows nothing.
    const [profilesRes, monthsRes, showsRes, bookingsRes, flagsRes, classesRes, certsRes, completedClassesRes] = await Promise.all([
      // a self-signed-up account with approved_at still null isn't real yet
      // (see PendingSignupsPanel) — excluded here so it can't clutter the
      // normal roster, Falling Behind, or Do Not Hire before it is.
      supabase.from("profiles").select("*").eq("is_admin", false).not("approved_at", "is", null),
      supabase.from("ojt_months").select("*"),
      supabase.from("shows").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("show_flags").select("*"),
      supabase.from("classes").select("*"),
      supabase.from("certifications").select("*"),
      supabase.from("completed_classes").select("*"),
    ]);
    setApprentices(profilesRes.data || []);
    // normalize to the {m,a,b,c,d,status} shape lib/core.js's ojtTotals/etc.
    // expect — raw Supabase columns are cat_a/cat_b/cat_c/cat_d/month, and
    // passing those straight through silently zeroes every total (ojtTotals
    // reads m.a/m.b/m.c/m.d, not m.cat_a).
    const months = (monthsRes.data || []).map((r) => ({
      user_id: r.user_id, m: r.month,
      a: Number(r.cat_a) || 0, b: Number(r.cat_b) || 0, c: Number(r.cat_c) || 0, d: Number(r.cat_d) || 0,
      status: r.status,
    }));
    setMonthsByUser(groupByUser(months));
    setBookingsByUser(groupByUser(bookingsRes.data || []));
    setFlagsByUser(groupByUser((flagsRes.data || []).map((f) => ({ ...f, user_id: f.user_id }))));
    setClassesByUser(groupByUser((classesRes.data || []).map((c) => ({
      id: c.id, user_id: c.user_id, name: c.name, start: c.start_min, loc: c.location || "", note: c.note || "", dates: c.dates || [],
      missedDates: c.missed_dates || [],
    }))));
    setCertsByUser(groupByUser(certsRes.data || []));
    setCompletedClassesByUser(groupByUser(completedClassesRes.data || []));
    setShows((showsRes.data || []).map((r) => ({
      id: r.id, name: r.name, mi: r.move_in || "", start: r.starts_on || "", end: r.ends_on || "",
      loc: r.location || "", booth: r.booth || "", co: r.gc || "", region: r.region || "", src: r.source || "union",
      sheetMonth: r.sheet_month || "",
    })));
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!me?.is_admin) { window.location.href = "/"; return; }
      if (!live) return;
      setEmail(user.email);
      await load();
      if (!live) return;
      setState("ready");
    })();
    return () => { live = false; };
  }, []);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const selected = selectedId ? apprentices.find((a) => a.id === selectedId) : null;
  const goToApprentice = (id) => { setTab("roster"); setSelectedId(id); };
  const goToShow = (id) => { setTab("schedule"); setScheduleFocusId(id); };
  const activeApprentices = useMemo(() => apprentices.filter((a) => !a.archived_at), [apprentices]);
  const archivedApprentices = useMemo(() => apprentices.filter((a) => a.archived_at), [apprentices]);

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
          <div className="skeleton" style={{ width: 160, height: 20, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div className="skeleton" style={{ height: 64 }} />
            <div className="skeleton" style={{ height: 64 }} />
          </div>
          <div className="skeleton" style={{ height: 96, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 44, marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton" style={{ height: 68 }} />
            <div className="skeleton" style={{ height: 68 }} />
            <div className="skeleton" style={{ height: 68 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell" style={{ minHeight: "100dvh", background: C.bg, fontFamily: FS }}>
      <style>{`
        .admin-shell, .admin-shell input, .admin-shell button, .admin-shell textarea, .admin-shell select{ font-family: ${FS}; }
        .admin-shell .foc:focus-visible{ box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.brand}; }
        .admin-shell button{ transition: background-color .12s, border-color .12s, filter .12s, opacity .12s; cursor: pointer; }
        .admin-shell .signout-btn:hover:not(:disabled){ background: ${C.raise}; color: ${C.hi}; border-color: ${C.danger}66; }
        .admin-shell .approve-btn:hover:not(:disabled){ filter: brightness(1.12); }
        .admin-shell .reject-btn:hover:not(:disabled){ background: rgba(232,146,124,0.12); border-color: ${C.danger}88; }
        .admin-shell .icon-btn:hover{ background: ${C.raise}; color: ${C.hi}; }
        .admin-shell .roster-row:hover{ border-color: ${C.brand}66; background: ${C.raise}; }
        .admin-shell .tab-btn:hover:not([data-active="true"]){ background: rgba(255,255,255,0.04); color: ${C.hi}; }
        .admin-shell .wrap{ max-width: 720px; margin: 0 auto; padding: 24px 16px 96px; }
        .admin-shell .navtop{ display: none; }
        .admin-shell .navbot{ display: block; padding-bottom: env(safe-area-inset-bottom, 0px); }
        @media (min-width: 900px){
          .admin-shell .wrap{ max-width: 1160px; padding-bottom: 60px; }
          .admin-shell .navtop{ display: block; margin-bottom: 16px; }
          .admin-shell .navbot{ display: none; }
        }
      `}</style>
      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <HardHat size={20} color={C.brand} />
          <div style={{ fontSize: 17, fontWeight: 800, color: C.hi }}>Local 831 Admin</div>
          <button className="foc signout-btn" disabled={signingOut} onClick={signOut}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, opacity: signingOut ? 0.6 : 1 }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <div className="truncate" style={{ fontSize: 11.5, color: C.lo, fontFamily: FM, marginBottom: 14 }}>{email}</div>

        <div className="navtop">
          <AdminNavBar tab={tab} onSelect={(k) => { setTab(k); if (k !== "roster") setSelectedId(null); }} variant="top" />
        </div>

        {tab === "dashboard" && (
          <DashboardTab apprentices={activeApprentices} monthsByUser={monthsByUser} shows={shows} classesByUser={classesByUser} certsByUser={certsByUser}
            onOpenApprentice={goToApprentice} onOpenDay={() => setTab("schedule")} onSelectShow={goToShow} onChanged={load} />
        )}

        {tab === "roster" && (
          selected ? (
            <ApprenticeDetail apprentice={selected} months={monthsByUser[selected.id] || []}
              bookings={bookingsByUser[selected.id] || []} flags={flagsByUser[selected.id] || []}
              classes={classesByUser[selected.id] || []} certs={certsByUser[selected.id] || []} shows={shows}
              completedClasses={completedClassesByUser[selected.id] || []}
              onAssignClass={() => setClassModal([selected.id])}
              onBack={() => setSelectedId(null)} onChanged={load} />
          ) : (
            <RosterTab apprentices={activeApprentices} archivedApprentices={archivedApprentices} monthsByUser={monthsByUser} onSelect={setSelectedId}
              onAddApprentice={() => setNewModal(true)} onAssignClass={() => setClassModal([])} onDoNotHire={() => setDnhModal(true)}
              onBulkArchive={() => setBulkArchiveModal(true)} />
          )
        )}

        {tab === "schedule" && (
          <ScheduleTab shows={shows} onChanged={load} focusId={scheduleFocusId} onFocusHandled={() => setScheduleFocusId(null)} />
        )}

        {tab === "settings" && (
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
        )}
      </div>

      <div className="navbot" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: C.bg, borderTop: "1px solid " + C.line }}>
        <div className="wrap" style={{ padding: "0 8px" }}>
          <AdminNavBar tab={tab} onSelect={(k) => { setTab(k); if (k !== "roster") setSelectedId(null); }} variant="bottom" />
        </div>
      </div>

      {newModal && (
        <Modal title="Add apprentice" onClose={() => setNewModal(false)}>
          <NewApprenticeForm onCreated={load} onClose={() => setNewModal(false)} />
        </Modal>
      )}
      {classModal !== false && (
        <Modal title="Assign class" onClose={() => setClassModal(false)}>
          <AssignClassForm apprentices={activeApprentices} preselected={classModal} onAssigned={load} onClose={() => setClassModal(false)} />
        </Modal>
      )}
      {dnhModal && (
        <Modal title="Add to do-not-hire list" onClose={() => setDnhModal(false)}>
          <BulkDnhForm apprentices={activeApprentices.filter((a) => !a.do_not_hire_at)} onDone={load} onClose={() => setDnhModal(false)} />
        </Modal>
      )}
      {bulkArchiveModal && (
        <Modal title="Archive apprentices" onClose={() => setBulkArchiveModal(false)}>
          <BulkArchiveForm apprentices={activeApprentices} onDone={load} onClose={() => setBulkArchiveModal(false)} />
        </Modal>
      )}
    </div>
  );
}
