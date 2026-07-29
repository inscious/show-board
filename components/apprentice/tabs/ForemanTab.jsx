"use client";

/* The Foreman section — only ever rendered when profile.foremanOfCompanyId
   is set (gated in ShowBoard.jsx's nav, same "capability grant on an
   existing login" model as CJ status). Reads/writes its own data straight
   from Supabase (own-rows RLS) same as PortfolioSection — foreman activity
   isn't every-load content for the vast majority of users who never see
   this tab, so it doesn't ride the localStorage-synced blob in lib/store.ts.

   Real-world grounding (platform_architecture_scoping memory): a foreman
   posts a call, workers raise their hand (not a commitment), the foreman
   still closes the loop by actually calling/texting them directly — this
   tab surfaces who raised their hand and their contact info, it doesn't
   try to manage real scheduling itself. */
import { useEffect, useState } from "react";
import { Check, ChevronRight, Mail, Megaphone, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, FM, FS, SHADOW, TIME_SLOTS, fmtClock, fromKey, keyOf, longDate, showsOn, todayMid } from "@/lib/core";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getCached, setCached } from "@/lib/clientCache";

async function req(method, path, body) {
    const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
}

const CATS = [
    { k: "", label: "General / unspecified" },
    { k: "A", label: "Category A" },
    { k: "B", label: "Category B" },
    { k: "C", label: "Category C" },
    { k: "D", label: "Category D" },
];

function Badge({ color, children }) {
    return (
        <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9, fontWeight: 800, color, border: "1px solid " + color + "55", borderRadius: 5, padding: "1px 6px" }}>
            {children}
        </span>
    );
}

function StatusBadge({ status }) {
    const meta = {
        open: { label: "OPEN", color: C.working },
        filled: { label: "FILLED", color: C.gc },
        cancelled: { label: "CANCELLED", color: C.lo },
    }[status] || { label: String(status || "").toUpperCase(), color: C.lo };
    return <Badge color={meta.color}>{meta.label}</Badge>;
}

function PostCallForm({ companyId, companyName, shows, onPosted }) {
    const [dateKey, setDateKey] = useState(keyOf(todayMid()));
    const [minute, setMinute] = useState(7 * 60); // 7:00am — the common call time
    const [neededCount, setNeededCount] = useState(1);
    const [category, setCategory] = useState("");
    const [title, setTitle] = useState("");
    const [showId, setShowId] = useState(null);
    const [state, setState] = useState("idle"); // idle | saving | error
    const [msg, setMsg] = useState("");

    const candidateShows = showsOn(shows || [], fromKey(dateKey));

    const pickShow = (s) => {
        if (showId === s.id) {
            setShowId(null);
        } else {
            setShowId(s.id);
            if (!title.trim()) setTitle(s.name);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setState("saving");
        setMsg("");
        const d = fromKey(dateKey);
        d.setMinutes(d.getMinutes() + minute);
        try {
            await req("POST", "/api/labor-calls", {
                companyId,
                showId: showId || null,
                title: title.trim() || null,
                neededCount,
                category: category || null,
                startsAt: d.toISOString(),
            });
            setTitle("");
            setNeededCount(1);
            setCategory("");
            setShowId(null);
            setState("idle");
            onPosted();
        } catch (err) {
            setState("error");
            setMsg(err.message);
        }
    };

    const fieldStyle = { width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "10px 10px", color: C.hi, fontSize: 13.5, fontFamily: FS };

    return (
        <form onSubmit={submit} style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "16px 17px", boxShadow: SHADOW, marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 4 }}>POST A CALL</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: C.hi, fontWeight: 700 }}>{companyName || "—"}</span>
                <span style={{ fontSize: 9.5, letterSpacing: 0.4, color: C.lo, fontFamily: FM }}>POSTING AS</span>
            </div>

            {candidateShows.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>SHOW ON THIS DATE (OPTIONAL)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {candidateShows.map((s) => (
                            <button key={s.id} type="button" onClick={() => pickShow(s)}
                                style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: showId === s.id ? "rgba(127,178,255,0.1)" : "transparent", border: "1px solid " + (showId === s.id ? C.gc + "88" : C.line), borderRadius: 9, padding: "9px 11px" }}>
                                <span className="truncate" style={{ fontSize: 12.5, color: C.hi, flex: 1 }}>{s.name}</span>
                                {showId === s.id && <Check size={14} color={C.gc} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>TITLE (OPTIONAL)</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SIGGRAPH move-in" style={{ ...fieldStyle, marginBottom: 12 }} />

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>DATE</div>
                    <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} style={{ ...fieldStyle, fontFamily: FM }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>TIME</div>
                    <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} style={{ ...fieldStyle, fontFamily: FM, fontWeight: 700 }}>
                        {TIME_SLOTS.map((m) => (<option key={m} value={m}>{fmtClock(m)}</option>))}
                    </select>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>NEEDED</div>
                    <input type="number" min={1} max={200} value={neededCount}
                        onChange={(e) => setNeededCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                        style={{ ...fieldStyle, fontFamily: FM, fontWeight: 700 }} />
                </div>
                <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 5 }}>TYPE OF WORK</div>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
                        {CATS.map((c) => (<option key={c.k || "none"} value={c.k}>{c.label}</option>))}
                    </select>
                </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.lo, lineHeight: 1.4, marginBottom: 14 }}>
                A label describing the work, not a filter — everyone approved sees every open call regardless of category.
            </div>

            <button type="submit" disabled={state === "saving"}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 10, background: C.working, color: C.inkGood, border: "none", fontWeight: 800, fontSize: 14, opacity: state === "saving" ? 0.7 : 1 }}>
                <Megaphone size={15} /> {state === "saving" ? "Posting…" : "Post the call"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
        </form>
    );
}

function CallRow({ call, onSelect }) {
    return (
        <button className="foc" onClick={() => onSelect(call.id)}
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "13px 14px", boxShadow: SHADOW }}>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                    <span className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: C.hi }}>{call.title || "Labor call"}</span>
                    <StatusBadge status={call.status} />
                </div>
                <div style={{ fontSize: 11, color: C.lo, fontFamily: FM }}>
                    {longDate(new Date(call.starts_at))} · {call.responseCount || 0}/{call.needed_count} available
                </div>
            </div>
            <ChevronRight size={16} color={C.lo} style={{ flexShrink: 0 }} />
        </button>
    );
}

function ResponderRow({ r, onConfirm }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid " + C.line }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.sunk, border: "1px solid " + C.line, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM, fontWeight: 800, fontSize: 12, color: C.mid, flexShrink: 0 }}>
                {(r.name || r.email || "?").trim().slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{r.name || r.email || "—"}</span>
                    {r.isCJ && <Badge color={C.working}>CJ</Badge>}
                    {r.doNotHire && <Badge color={C.danger}>DNH</Badge>}
                    {r.status === "confirmed" && <Badge color={C.gc}>CONFIRMED</Badge>}
                    {r.status === "withdrawn" && <Badge color={C.lo}>WITHDREW</Badge>}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    {r.phone && (
                        <a href={"tel:" + r.phone} style={{ fontSize: 11, color: C.gc, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                            <Phone size={11} /> {r.phone}
                        </a>
                    )}
                    {r.email && (
                        <a href={"mailto:" + r.email} style={{ fontSize: 11, color: C.gc, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                            <Mail size={11} /> Email
                        </a>
                    )}
                </div>
                {r.doNotHire && r.doNotHireReason && (
                    <div style={{ fontSize: 10.5, color: C.danger, marginTop: 3 }}>{r.doNotHireReason}</div>
                )}
            </div>
            {r.status === "available" && (
                <button className="foc" onClick={() => onConfirm(r.userId)}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: C.gc, background: "rgba(127,178,255,0.1)", border: "1px solid " + C.gc + "55", borderRadius: 8, padding: "7px 11px" }}>
                    Confirm
                </button>
            )}
        </div>
    );
}

function CallDetail({ call, onClose, onChanged }) {
    const [responses, setResponses] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    const load = () => {
        req("GET", `/api/labor-calls/${call.id}/responses`)
            .then((j) => setResponses(j.responses || []))
            .catch((e) => setError(e.message));
    };
    useEffect(load, [call.id]);

    const setStatus = async (status) => {
        setBusy(true);
        setError("");
        try {
            await req("POST", `/api/labor-calls/${call.id}/status`, { status });
            onChanged();
            onClose();
        } catch (e) {
            setError(e.message);
            setBusy(false);
        }
    };

    const confirmResponder = async (userId) => {
        setError("");
        try {
            await req("POST", `/api/labor-calls/${call.id}/confirm`, { userId });
            load();
            onChanged();
        } catch (e) {
            setError(e.message);
        }
    };

    const open = call.status === "open";

    return (
        <Modal title={call.title || "Labor call"} onClose={onClose}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <StatusBadge status={call.status} />
                <span style={{ fontSize: 12, color: C.lo, fontFamily: FM }}>
                    {longDate(new Date(call.starts_at))} at {new Date(call.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
            </div>
            <div style={{ fontSize: 12, color: C.mid, marginBottom: 14 }}>{call.needed_count} needed</div>

            {open && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button className="foc" disabled={busy} onClick={() => setStatus("filled")}
                        style={{ flex: 1, padding: "10px", borderRadius: 9, background: "rgba(79,193,166,0.12)", color: C.working, border: "1px solid " + C.working + "55", fontWeight: 800, fontSize: 12.5, opacity: busy ? 0.6 : 1 }}>
                        Mark filled
                    </button>
                    <button className="foc" disabled={busy} onClick={() => setConfirmCancel(true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 9, background: "transparent", color: C.mid, border: "1px solid " + C.line, fontWeight: 700, fontSize: 12.5 }}>
                        Cancel call
                    </button>
                </div>
            )}
            {error && <div style={{ fontSize: 12.5, color: C.danger, marginBottom: 12 }}>{error}</div>}

            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 6 }}>RESPONSES</div>
            {responses === null ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="skeleton" style={{ height: 44 }} />
                    <div className="skeleton" style={{ height: 44 }} />
                </div>
            ) : responses.length === 0 ? (
                <div style={{ color: C.lo, fontSize: 12.5, padding: "12px 0" }}>No one has raised their hand yet.</div>
            ) : (
                <div>{responses.map((r) => <ResponderRow key={r.userId} r={r} onConfirm={confirmResponder} />)}</div>
            )}

            {confirmCancel && (
                <ConfirmModal
                    title="Cancel this call?"
                    message="Workers who raised their hand will no longer see it as open. This can't be undone from here."
                    confirmLabel="Cancel the call"
                    onClose={() => setConfirmCancel(false)}
                    onConfirm={() => { setConfirmCancel(false); setStatus("cancelled"); }}
                />
            )}
        </Modal>
    );
}

export function ForemanTab({ profile, shows }) {
    const [calls, setCalls] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState("");
    // the app's shared company directory (lib/store.ts's `companies`) is
    // remapped down to a display-only {n, city, st, tel, fm} shape with no
    // id — this needs the real id to match against foremanOfCompanyId, so
    // it self-fetches, same "own-rows" reasoning as everything else here.
    // Cached under the same key CompanyDirectoryPanel already uses — same
    // table, same shape (select("*")), so a session that's touched either
    // side gets the other for free.
    const [companies, setCompanies] = useState(() => getCached("admin:companies") || []);
    useEffect(() => {
        const supabase = createClient();
        supabase.from("companies").select("*").order("name").then(({ data }) => {
            setCompanies(data || []);
            setCached("admin:companies", data || []);
        });
    }, []);

    const load = async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: myCalls, error: err } = await supabase
                .from("labor_calls")
                .select("*")
                .eq("posted_by", user.id)
                .order("created_at", { ascending: false });
            if (err) throw err;
            const ids = (myCalls || []).map((c) => c.id);
            const counts = {};
            if (ids.length) {
                const { data: resp } = await supabase
                    .from("labor_call_responses")
                    .select("labor_call_id, status")
                    .in("labor_call_id", ids)
                    .neq("status", "withdrawn");
                (resp || []).forEach((r) => { counts[r.labor_call_id] = (counts[r.labor_call_id] || 0) + 1; });
            }
            setCalls((myCalls || []).map((c) => ({ ...c, responseCount: counts[c.id] || 0 })));
        } catch (e) {
            setError(e.message || "Could not load your calls");
        }
    };
    useEffect(() => { load(); }, []);

    if (!profile?.foremanOfCompanyId) {
        return (
            <div style={{ color: C.lo, fontSize: 13, padding: "24px 0", textAlign: "center" }}>
                You don't have foreman access for any company yet.
            </div>
        );
    }

    const companyName = companies?.find((c) => c.id === profile.foremanOfCompanyId)?.name;
    const selected = calls?.find((c) => c.id === selectedId) || null;

    return (
        <div>
            <PostCallForm companyId={profile.foremanOfCompanyId} companyName={companyName} shows={shows} onPosted={load} />

            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.mid, fontFamily: FM, marginBottom: 8 }}>MY CALLS</div>
            {error && <div style={{ fontSize: 12.5, color: C.danger, marginBottom: 10 }}>{error}</div>}
            {calls === null ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="skeleton" style={{ height: 68 }} />
                    <div className="skeleton" style={{ height: 68 }} />
                </div>
            ) : calls.length === 0 ? (
                <div style={{ color: C.lo, fontSize: 12.5, padding: "20px 0", textAlign: "center" }}>No calls posted yet.</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {calls.map((c) => <CallRow key={c.id} call={c} onSelect={setSelectedId} />)}
                </div>
            )}

            {selected && <CallDetail call={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
        </div>
    );
}
