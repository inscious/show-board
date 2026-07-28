"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Plus, Upload, Search, Trash2 } from "lucide-react";
import { C, SHADOW, FM, FS, REGION, sortDate, monthLabel, monthKey, monthKeyNow, labelFromKey, isPast } from "@/lib/core";
import { ShowForm, ImportForm, EMPTY } from "@/components/ShowEditor";
import { Modal, ConfirmModal, req, Stat } from "@/components/admin/shared";
import { ShowCardHeader } from "@/components/apprentice/tabs/ShowCard";
import { NoticeForm } from "@/components/admin/UnionNoticesPanel";

/* ---------- schedule ---------- */
export function ScheduleTab({ shows, onChanged, focusId, onFocusHandled }) {
  const [modal, setModal] = useState(null); // "add" | "edit" | "import"
  const [importStep, setImportStep] = useState("shows"); // "shows" | "notices", only while modal === "import"
  const [importSheetMonth, setImportSheetMonth] = useState(null);
  const [importedNotices, setImportedNotices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // monthLabel -> bool, overrides the default
  const [expandedId, setExpandedId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  /* landing here from "On the floor today" (a show tapped on the dashboard)
     — clear any filter that could be hiding it, force its month group open
     even if it was previously collapsed, expand the show itself, and scroll
     it into view once the DOM reflects that. */
  useEffect(() => {
    if (!focusId) return;
    const target = shows.find((s) => s.id === focusId);
    if (target) {
      setQ("");
      setRegionFilter("");
      // matches how currentGroups labels a still-running show that started
      // last month — clamp to "now" the same way, or this would try to
      // open a group label nothing is actually rendered under.
      const label = isPast(target) ? monthLabel(target) : labelFromKey(Math.max(monthKey(target), monthKeyNow()));
      setCollapsed((prev) => ({ ...prev, [label]: false }));
      setExpandedId(focusId);
      requestAnimationFrame(() => {
        document.getElementById("show-" + focusId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    onFocusHandled?.();
  }, [focusId]);

  const regionsPresent = useMemo(() => Array.from(new Set(shows.map((s) => s.region).filter(Boolean))), [shows]);
  const filteredShows = useMemo(() => shows.filter((s) => {
    if (regionFilter && s.region !== regionFilter) return false;
    if (q.trim()) {
      const hay = (s.name + " " + (s.loc || "") + " " + (s.co || "")).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [shows, regionFilter, q]);
  const anyFilterActive = regionFilter || q.trim();
  const inputStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px", color: C.hi, fontSize: 12.5, fontFamily: FS };

  const genId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const saveOne = async (d) => {
    await req("POST", "/api/shows", { id: editing?.id || genId("u"), ...d });
    setModal(null);
    setEditing(null);
    onChanged();
  };
  const removeShow = async (id) => {
    await req("DELETE", "/api/shows", { id });
    onChanged();
  };
  const [confirmRemoveShow, setConfirmRemoveShow] = useState(null); // show row, or null
  const addImported = async (rows, sheetMonth) => {
    const withIds = rows.map((r, i) => ({ id: genId("i") + i, ...r }));
    await req("POST", "/api/shows/import", { shows: withIds });
    onChanged();
    // same sheet the notices are printed on — chain straight into that step
    // instead of closing, so the admin does not need a second trip to
    // Settings to keep the calendar's union-notice dots current.
    setImportSheetMonth(sheetMonth);
    setImportStep("notices");
  };
  const closeImport = () => {
    setModal(null);
    setImportStep("shows");
    setImportSheetMonth(null);
    setImportedNotices([]);
  };

  // Split into past/current PER SHOW first, then group each bucket by
  // month separately — a show that's already ended has to disappear into
  // Past the moment it ends, not wait for every other show sharing its
  // calendar month to end too. Grouping-then-classifying-the-whole-group
  // (the previous approach) left already-ended shows sitting in the open
  // "current" section for as long as anything else that month hadn't
  // happened yet. Same split the apprentice Board tab already does.
  const { pastGroups, currentGroups } = useMemo(() => {
    const now = monthKeyNow();
    const buildGroups = (list, reverseOrder) => {
      const byMonth = {};
      const order = [];
      list.forEach((s) => {
        // a show still running that started last month belongs under THIS
        // month's header, not a stale one — only matters for the current
        // (non-reversed) bucket; past shows use their own real month.
        const mk = reverseOrder ? monthKey(s) : Math.max(monthKey(s), now);
        const label = mk === 999999 ? "SCHEDULED" : labelFromKey(mk);
        if (!byMonth[label]) {
          byMonth[label] = { key: mk, label, list: [] };
          order.push(label);
        }
        byMonth[label].list.push(s);
      });
      const out = order.map((label) => byMonth[label]);
      out.sort((a, b) => (reverseOrder ? b.key - a.key : a.key - b.key));
      return out;
    };
    const current = filteredShows.filter((s) => !isPast(s)).sort((a, b) => sortDate(a) - sortDate(b));
    // archive reads newest first — same reverse-chronological convention as
    // the apprentice Board's Past view.
    const past = filteredShows.filter(isPast).sort((a, b) => sortDate(b) - sortDate(a));
    return { pastGroups: buildGroups(past, true), currentGroups: buildGroups(current, false) };
  }, [filteredShows]);
  const pastShowCount = useMemo(() => pastGroups.reduce((s, g) => s + g.list.length, 0), [pastGroups]);

  const renderGroup = (g) => {
    const allPast = g.list.every(isPast);
    const isOpen = !(collapsed[g.label] ?? allPast);
    return (
      <div key={g.label}>
        <button className="foc tab-btn navfoc" onClick={() => setCollapsed((p) => ({ ...p, [g.label]: !(p[g.label] ?? allPast) }))}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "6px 2px", color: allPast ? C.lo : C.hi }}>
          <ChevronRight size={14} color={C.lo} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, fontFamily: FM }}>{g.label.toUpperCase()}</span>
          <span style={{ fontSize: 10.5, color: C.lo, fontFamily: FM }}>{g.list.length}</span>
          {allPast && <span style={{ fontSize: 9.5, fontFamily: FM, color: C.lo, marginLeft: "auto" }}>PAST</span>}
        </button>
        {isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {g.list.map((s) => {
              const past = isPast(s);
              const open = expandedId === s.id;
              return (
                <div key={s.id} id={"show-" + s.id} style={{
                  background: C.panel,
                  borderRadius: 13,
                  overflow: "hidden",
                  opacity: past ? 0.66 : 1,
                  border: "1px solid " + (open ? "rgba(127,178,255,0.45)" : C.edge),
                  boxShadow: open ? "0 6px 20px rgba(0,0,0,0.5)" : SHADOW,
                }}>
                  <ShowCardHeader show={s} onClick={() => setExpandedId(open ? null : s.id)} />
                  {open && (
                    <div style={{ padding: "0 12px 12px", borderTop: "1px solid " + C.line }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, marginBottom: 10 }}>
                        <Stat label="MOVE IN" value={s.mi || "—"} />
                        <Stat label="START" value={s.start || "—"} />
                        <Stat label="END" value={s.end || "—"} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: C.mid, marginBottom: 12 }}>
                        <div><span style={{ color: C.lo }}>Location</span> · {s.loc || "—"}{s.booth ? " · Booth " + s.booth : ""}</div>
                        <div><span style={{ color: C.lo }}>General contractor</span> · {s.co || "—"}</div>
                        <div><span style={{ color: C.lo }}>Source</span> · {s.src || "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="foc" onClick={() => { setEditing(s); setModal("edit"); }}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, background: C.raise, color: C.hi, border: "1px solid " + C.line, fontSize: 13, fontWeight: 700 }}>Edit</button>
                        <button className="foc" onClick={() => setConfirmRemoveShow(s)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "transparent", color: C.danger, border: "1px solid " + C.line, fontSize: 13, fontWeight: 700 }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="foc" onClick={() => { setEditing(null); setModal("add"); }}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.panel, color: C.hi, border: "1px dashed " + C.line, fontWeight: 700, fontSize: 13.5 }}>
          <Plus size={15} /> Add show
        </button>
        <button className="foc" onClick={() => { setImportStep("shows"); setImportedNotices([]); setModal("import"); }}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.brand, color: C.ink, border: "none", fontWeight: 800, fontSize: 13.5, boxShadow: "0 4px 14px rgba(255,176,32,0.22)" }}>
          <Upload size={15} /> Import schedule
        </button>
      </div>

      <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "12px 13px", boxShadow: SHADOW, marginBottom: 12 }}>
        <div style={{ position: "relative", marginBottom: regionsPresent.length > 0 ? 8 : 0 }}>
          <Search size={14} color={C.lo} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search show, location, or company…"
            style={{ ...inputStyle, width: "100%", padding: "8px 10px 8px 30px" }} />
        </div>
        {regionsPresent.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }}>
              <option value="">All regions</option>
              {regionsPresent.map((r) => <option key={r} value={r}>{(REGION[r] || REGION.OTHER).label}</option>)}
            </select>
            {anyFilterActive && (
              <button className="foc" onClick={() => { setQ(""); setRegionFilter(""); }}
                style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: "8px 12px", borderRadius: 9, background: "transparent", color: C.lo, border: "1px solid " + C.line }}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {currentGroups.length === 0 && pastGroups.length === 0 && (
          <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No shows match these filters.</div>
        )}
        {currentGroups.map(renderGroup)}

        {pastGroups.length > 0 && (
          <button className="foc" onClick={() => setShowPast((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.panel, border: "1px solid " + C.edge, borderRadius: 10, padding: "11px 13px", color: C.mid, fontSize: 12.5, fontWeight: 700 }}>
            <ChevronRight size={14} color={C.lo} style={{ transform: showPast ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
            {showPast ? "Hide" : "Show"} {pastGroups.length} past month{pastGroups.length === 1 ? "" : "s"}
            <span style={{ marginLeft: "auto", fontFamily: FM, fontSize: 11, color: C.lo }}>{pastShowCount} shows</span>
          </button>
        )}

        {showPast && pastGroups.map(renderGroup)}
      </div>

      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "edit" ? "Edit show" : "Add show"} onClose={() => setModal(null)}>
          <ShowForm initial={editing ? { ...EMPTY, ...editing } : undefined} onClose={() => setModal(null)} onSave={saveOne} />
        </Modal>
      )}
      {modal === "import" && importStep === "shows" && (
        <Modal title="Import from schedule" onClose={closeImport}>
          <ImportForm onAdd={addImported} />
        </Modal>
      )}
      {modal === "import" && importStep === "notices" && (
        <Modal title="This sheet's union dates & dues" onClose={closeImport}>
          <div style={{ color: C.mid, fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
            Same sheet the shows just came off — add any meeting, dues, or holiday lines
            printed on it so they show up on the calendar too. Skip if there is nothing new.
          </div>
          {importedNotices.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {importedNotices.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ flexShrink: 0, width: 78, fontFamily: FM, fontSize: 10.5, fontWeight: 800, color: C.brand }}>{n.dateLabel}</div>
                  <div className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.hi }}>{n.body}</div>
                </div>
              ))}
            </div>
          )}
          <NoticeForm
            resetAfterSave
            defaultSheetMonth={importSheetMonth}
            onSaved={(saved) => setImportedNotices((p) => [...p, saved])}
            onClose={closeImport}
          />
          <button className="foc" onClick={closeImport}
            style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 10, background: "transparent", color: C.mid, border: "1px solid " + C.line, fontWeight: 700, fontSize: 13.5 }}>
            {importedNotices.length > 0 ? "Done" : "Skip — nothing new"}
          </button>
        </Modal>
      )}
      {confirmRemoveShow && (
        <ConfirmModal
          title="Delete this show?"
          message={<>This permanently removes <strong style={{ color: C.hi }}>{confirmRemoveShow.name}</strong> from the schedule.</>}
          confirmLabel="Delete show"
          onClose={() => setConfirmRemoveShow(null)}
          onConfirm={async () => { await removeShow(confirmRemoveShow.id); setConfirmRemoveShow(null); }}
        />
      )}
    </div>
  );
}
