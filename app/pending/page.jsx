"use client";

/* Holding page for a self-signed-up account that hasn't been admin-approved
   yet (profiles.approved_at is null — see middleware.js, which is the thing
   that actually enforces landing here; this page assumes that's already
   true). One job: let them add historical OJT hours while they wait, using
   the same /api/ojt-months endpoint the real app's OJT tab posts to, so
   whatever they enter here lands as a normal pending-review month exactly
   like it would from inside the app. Nothing else — no schedule, no company
   directory, no new hour-logging. */
import { useEffect, useState } from "react";
import { HardHat, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, SHADOW, FM, FS, mKey, mAdd, mMed, todayMid, CATS_META, num } from "@/lib/core";

const fieldStyle = { background: C.sunk, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px", color: C.hi, fontSize: 13.5 };

function monthOptions() {
  const t = todayMid();
  const nowKey = mKey(t.getFullYear(), t.getMonth());
  const out = [];
  for (let i = 0; i < 36; i++) out.push(mAdd(nowKey, -i));
  return out;
}

export default function PendingPage() {
  const [email, setEmail] = useState(null);
  const [months, setMonths] = useState(null); // null = loading
  const [form, setForm] = useState({ m: monthOptions()[1] || "", a: "", b: "", c: "", d: "" }); // default to last month, not the still-in-progress current one
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setEmail(user.email);
    const { data } = await supabase.from("ojt_months").select("*").eq("user_id", user.id).order("month", { ascending: false });
    setMonths(data || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setState("saving");
    setMsg("");
    try {
      const res = await fetch("/api/ojt-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m: form.m, a: num(form.a), b: num(form.b), c: num(form.c), d: num(form.d) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMsg(body.error || "Couldn't save that month.");
        return;
      }
      setState("idle");
      setForm((f) => ({ ...f, a: "", b: "", c: "", d: "" }));
      load();
    } catch {
      setState("error");
      setMsg("Network error — check your connection and try again.");
    }
  };

  const removeMonth = async (m) => {
    await fetch("/api/ojt-months", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m }) });
    load();
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const usedMonths = new Set((months || []).map((m) => m.month));
  const availableMonths = monthOptions().filter((k) => !usedMonths.has(k));

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FS, padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(255,176,32,0.14)", border: "1px solid rgba(255,176,32,0.35)", flexShrink: 0 }}>
            <HardHat size={18} color={C.brand} />
          </span>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.hi }}>L831 Tracker</div>
          <button onClick={signOut} disabled={signingOut}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.line, color: C.mid, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700 }}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 14, padding: "18px 20px", boxShadow: SHADOW, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.brand, fontFamily: FM, fontWeight: 800, marginBottom: 8 }}>WAITING ON APPROVAL</div>
          <div style={{ fontSize: 14, color: C.hi, lineHeight: 1.6 }}>
            {email ? <>Your account (<strong>{email}</strong>) is created</> : "Your account is created"} — an admin still needs to approve you before you get full access. That's normal, not an error.
          </div>
          <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.6, marginTop: 8 }}>
            While you wait, you can add any OJT hours you've already turned in to the union below. They'll be reviewed the same way any logged month is once you're approved.
          </div>
        </div>

        <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 14, padding: "18px 20px", boxShadow: SHADOW, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 12 }}>ADD A MONTH</div>
          <form onSubmit={submit}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>MONTH</div>
            <select value={form.m} onChange={(e) => setForm((f) => ({ ...f, m: e.target.value }))}
              style={{ ...fieldStyle, width: "100%", marginBottom: 12 }}>
              {availableMonths.map((k) => <option key={k} value={k}>{mMed(k)}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {(["a", "b", "c", "d"]).map((k) => (
                <div key={k}>
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>
                    {k.toUpperCase()} · {CATS_META[k.toUpperCase()].name}
                  </div>
                  <input type="number" min="0" step="0.5" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    placeholder="0" style={{ ...fieldStyle, width: "100%" }} />
                </div>
              ))}
            </div>
            <button type="submit" disabled={state === "saving" || !form.m}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 9, background: C.brand, color: "#1A1206", border: "none", fontWeight: 800, fontSize: 13.5, opacity: state === "saving" ? 0.6 : 1 }}>
              <Plus size={15} /> {state === "saving" ? "Saving…" : "Add month"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger }}>{msg}</div>}
          </form>
        </div>

        <div style={{ background: C.panel, border: "1px solid " + C.edge, borderRadius: 14, padding: "18px 20px", boxShadow: SHADOW }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 12 }}>
            MONTHS ADDED{months ? " — " + months.length : ""}
          </div>
          {months === null ? (
            <div style={{ fontSize: 12.5, color: C.lo }}>Loading…</div>
          ) : months.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.lo }}>Nothing added yet — that's fine, you can also just start logging once you're approved.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {months.map((m) => (
                <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 9, background: C.raise, border: "1px solid " + C.line, borderRadius: 9, padding: "9px 10px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.hi }}>{mMed(m.month)}</div>
                    <div style={{ fontSize: 11, color: C.mid, marginTop: 2, fontFamily: FM }}>
                      A {num(m.cat_a)} · B {num(m.cat_b)} · C {num(m.cat_c)} · D {num(m.cat_d)}
                    </div>
                  </div>
                  <button onClick={() => removeMonth(m.month)} style={{ background: "transparent", border: "none", color: C.lo, padding: 4, borderRadius: 5, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
