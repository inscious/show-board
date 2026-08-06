"use client";

/* Cross-tenant account search — the console's #1 troubleshooting need
   ("someone can't log in, find their account") that didn't exist before:
   the only way to touch an account was already knowing its exact email to
   type into the Settings role-assignment form. Search is server-side (via
   /api/console/accounts) since it crosses every union's own RLS boundary —
   there's no client-loaded "every account platform-wide" list to filter,
   unlike the union-level Roster search this mirrors visually. */
import { useEffect, useRef, useState } from "react";
import { Search, ChevronRight, ShieldCheck, HardHat, Check, Ban, Archive as ArchiveIcon, UserCog } from "lucide-react";
import { C, SHADOW, FM, FS } from "@/lib/core";
import { Avatar, Modal, ConfirmModal, req } from "@/components/admin/shared";

const inputStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "8px 10px", color: C.hi, fontSize: 12.5, fontFamily: FS };

function Badge({ color, children }) {
  return (
    <span style={{ flexShrink: 0, fontFamily: FM, fontSize: 9.5, fontWeight: 800, color, border: "1px solid " + color + "55", borderRadius: 5, padding: "1px 6px" }}>
      {children}
    </span>
  );
}

function AccountRow({ a, onSelect }) {
  return (
    <button className="foc" onClick={() => onSelect(a.id)}
      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: C.panel, border: "1px solid " + C.edge, borderRadius: 12, padding: "14px 15px", boxShadow: SHADOW }}>
      <Avatar name={a.name} email={a.email} avatarUrl={a.avatarUrl} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: C.hi }}>{a.name || a.email}</div>
        {a.name && <div className="truncate" style={{ fontSize: 10.5, color: C.lo, fontFamily: FM, marginTop: 1 }}>{a.email}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
          {a.orgName && <span className="truncate" style={{ fontSize: 10.5, color: C.mid }}>{a.orgName}</span>}
          {a.isAdmin && <Badge color={C.brand}>{a.isCentralAdmin ? "CENTRAL ADMIN" : "ADMIN"}</Badge>}
          {a.isForeman && <Badge color={C.gc}>FOREMAN</Badge>}
          {a.isCJ && <Badge color={C.working}>CJ</Badge>}
          {a.doNotHire && <Badge color={C.danger}>DNH</Badge>}
          {a.archived && <Badge color={C.lo}>ARCHIVED</Badge>}
        </div>
      </div>
      <ChevronRight size={16} color={C.lo} style={{ flexShrink: 0 }} />
    </button>
  );
}

function DetailRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid " + C.line }}>
      <span style={{ color: C.mid, flexShrink: 0, width: 140 }}>{label}</span>
      <span style={{ color: C.hi, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function AccountDetail({ id, onClose }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [confirmImpersonate, setConfirmImpersonate] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState("");

  useEffect(() => {
    let live = true;
    req("GET", `/api/console/accounts/${id}`).then((j) => { if (live) setAccount(j.account); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id]);

  const impersonate = async () => {
    setImpersonating(true);
    setImpersonateError("");
    try {
      const j = await req("POST", "/api/console/impersonate", { targetUserId: id });
      window.location.href = `/impersonate/verify?token_hash=${encodeURIComponent(j.tokenHash)}`;
    } catch (e) {
      setImpersonateError(e.message);
      setImpersonating(false);
    }
  };

  return (
    <Modal title={account?.name || account?.email || "Account"} onClose={onClose}>
      {error && <div style={{ fontSize: 12.5, color: C.danger }}>{error}</div>}
      {!account && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton" style={{ height: 30 }} />
          <div className="skeleton" style={{ height: 30 }} />
          <div className="skeleton" style={{ height: 30 }} />
        </div>
      )}
      {account && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Avatar name={account.name} email={account.email} avatarUrl={account.avatarUrl} size={48} />
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: C.hi }}>{account.name || "—"}</div>
              <div className="truncate" style={{ fontSize: 11.5, color: C.lo, fontFamily: FM }}>{account.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {account.isAdmin && <Badge color={C.brand}>{account.isCentralAdmin ? "CENTRAL ADMIN" : "ADMIN"}</Badge>}
            {!!account.foremanOfCompanyId && <Badge color={C.gc}>FOREMAN</Badge>}
            {account.graduatedAt && <Badge color={C.working}>CJ</Badge>}
            {account.doNotHireAt && <Badge color={C.danger}>DO NOT HIRE</Badge>}
            {account.archivedAt && <Badge color={C.lo}>ARCHIVED</Badge>}
            {!account.hasPassword && <Badge color={C.lo}>NO PASSWORD SET</Badge>}
          </div>

          <DetailRow label="Organization" value={account.orgName} />
          <DetailRow label="Local" value={account.local} />
          <DetailRow label="Member ID" value={account.memberId} />
          <DetailRow label="SSN last 4" value={account.last4 ? "···" + account.last4 : null} />
          <DetailRow label="Joined" value={account.joinedOn} />
          <DetailRow label="Approved" value={account.approvedAt ? account.approvedAt.slice(0, 10) : "Not yet"} />
          <DetailRow label="Last worked" value={account.lastWorkedOn ? `${account.lastWorkedOn} · ${account.lastWorkedCompany}` : "No entries"} />
          <DetailRow label="Last OJT month" value={account.lastOjtMonth ? `${account.lastOjtMonth} (${account.lastOjtStatus})` : "None submitted"} />
          {account.doNotHireAt && <DetailRow label="DNH reason" value={account.doNotHireReason} />}

          <button
            className="foc"
            disabled={impersonating}
            onClick={() => setConfirmImpersonate(true)}
            style={{
              width: "100%", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: 10, background: "rgba(127,178,255,0.1)", border: "1px solid " + C.gc + "66",
              color: C.gc, fontWeight: 800, fontSize: 13.5, opacity: impersonating ? 0.6 : 1,
            }}
          >
            <UserCog size={15} />
            {impersonating ? "Starting session…" : "Impersonate — view as this account"}
          </button>
          {impersonateError && <div style={{ fontSize: 12, color: C.danger, marginTop: 8 }}>{impersonateError}</div>}

          <div style={{ fontSize: 10.5, color: C.lo, marginTop: 14, lineHeight: 1.5 }}>
            To change this account's roles, use the Role Assignment tool on the Settings tab with this email — {account.email}.
          </div>
        </div>
      )}
      {confirmImpersonate && (
        <ConfirmModal
          title="Impersonate this account?"
          message={`You'll get a real, 30-minute session as ${account.name || account.email}, landing on their actual app — every action taken is logged, and anything you do (or they see logged) is attributed to them, not you. Use "End session" in the banner to return to the console.`}
          confirmLabel="Start impersonating"
          danger={false}
          onClose={() => setConfirmImpersonate(false)}
          onConfirm={() => { setConfirmImpersonate(false); impersonate(); }}
        />
      )}
    </Modal>
  );
}

export default function ConsoleAccountsPage() {
  const [q, setQ] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q.trim();
    if (!query) { setAccounts([]); setError(""); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const j = await req("GET", `/api/console/accounts?q=${encodeURIComponent(query)}`);
        setAccounts(j.accounts || []);
        setError("");
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} color={C.lo} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, or member ID — any org" autoFocus
          aria-label="Search name, email, or member ID"
          style={{ ...inputStyle, width: "100%", padding: "10px 10px 10px 30px", fontSize: 14 }} />
      </div>

      {error && <div style={{ fontSize: 12.5, color: C.danger, marginBottom: 10 }}>{error}</div>}

      {!q.trim() && (
        <div style={{ color: C.lo, fontSize: 12.5, padding: "20px 0", textAlign: "center" }}>
          Search across every organization — type a name, email, or member ID.
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton" style={{ height: 68 }} />
          <div className="skeleton" style={{ height: 68 }} />
        </div>
      )}

      {!loading && q.trim() && accounts.length === 0 && !error && (
        <div style={{ color: C.mid, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No accounts match "{q.trim()}".</div>
      )}

      {!loading && accounts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {accounts.map((a) => <AccountRow key={a.id} a={a} onSelect={setSelectedId} />)}
        </div>
      )}

      {selectedId && <AccountDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
