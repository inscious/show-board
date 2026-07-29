"use client";

/* Signed-in-as / role / sign-out / change-password / welcome-message —
   extracted out of OjtTab.jsx (previously inline in its "Account" Fold)
   once the CJ Account tab needed the exact same block as a second real
   call site, not a hypothetical one. Behavior unchanged, only the module
   boundary is new. */
import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, HelpCircle } from "lucide-react";
import { C, FM } from "@/lib/core";
import { store } from "@/lib/store";
import { Modal } from "@/components/ui/Modal";
import { Fold } from "@/components/ui/Fold";

function PwInput({ value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center" }}>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 34px 9px 10px", color: C.hi, fontSize: 12.5 }}
            />
            <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: C.lo, padding: 2, display: "flex" }}
            >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        </div>
    );
}

function PasswordSetter({ onSaved }) {
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [state, setState] = useState("idle"); // idle | saving | done | error
    const [msg, setMsg] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (pw.length < 8) {
            setState("error");
            setMsg("At least 8 characters.");
            return;
        }
        if (pw !== pw2) {
            setState("error");
            setMsg("Passwords don't match.");
            return;
        }
        setState("saving");
        setMsg("");
        const res = await store.setPassword(pw);
        if (res.ok) {
            setState("done");
            setPw("");
            setPw2("");
            setMsg("Password set. You'll get an email confirming it, and can sign in with it next time.");
            onSaved?.();
        } else {
            setState("error");
            setMsg(res.error || "Couldn't set password.");
        }
    };

    return (
        <form onSubmit={submit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <PwInput value={pw} onChange={(e) => { setPw(e.target.value); setState("idle"); }} placeholder="new password (8+ characters)" />
                <PwInput value={pw2} onChange={(e) => { setPw2(e.target.value); setState("idle"); }} placeholder="retype password" />
                <button
                    className="foc"
                    type="submit"
                    disabled={state === "saving" || !pw || !pw2}
                    style={{
                        background: state === "done" ? C.working : C.brand,
                        color: state === "done" ? C.inkGood : C.ink,
                        border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800,
                        opacity: state === "saving" ? 0.6 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                >
                    {state === "done" && <Check size={13} />}
                    {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Save"}
                </button>
            </div>
            {msg && (
                <div style={{ marginTop: 7, fontSize: 11.5, color: state === "error" ? C.danger : C.working }}>
                    {msg}
                </div>
            )}
            <div style={{ fontSize: 10.5, color: C.lo, marginTop: 7, lineHeight: 1.5 }}>
                Lets you sign in with email + password next time instead of waiting on a link.
            </div>
        </form>
    );
}

export function AccountCard({ email, isAdmin, profile, onSignOut, onPasswordSet, onOpenWelcome, pwIntent, onPwIntentConsumed }) {
    const [signingOut, setSigningOut] = useState(false);
    const [pwModal, setPwModal] = useState(false);

    // Home's "no password on file" nudge sends us here wanting the modal
    // open, not just the tab switched to — consume the one-shot signal.
    useEffect(() => {
        if (pwIntent) {
            setPwModal(true);
            onPwIntentConsumed?.();
        }
    }, [pwIntent, onPwIntentConsumed]);

    return (
        <>
            <Fold icon={Check} title="Account" color={C.mid}>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                        ["Signed in as", email || "—"],
                        ["Role", isAdmin ? "Admin" : profile.graduatedAt ? "Certified Journeyman" : "Apprentice"],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", fontSize: 12.5 }}>
                            <span style={{ color: C.mid }}>{k}</span>
                            <span className="truncate" style={{ marginLeft: "auto", fontFamily: FM, color: C.hi, fontWeight: 700, maxWidth: "60%", textAlign: "right" }}>
                                {v}
                            </span>
                        </div>
                    ))}
                </div>
                <button
                    className="foc signout-btn"
                    disabled={signingOut}
                    onClick={() => {
                        if (signingOut) return;
                        setSigningOut(true);
                        onSignOut();
                    }}
                    style={{
                        width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        background: "transparent", color: C.mid, border: "1px solid " + C.line, borderRadius: 9, padding: "10px",
                        fontSize: 12.5, fontWeight: 700, opacity: signingOut ? 0.6 : 1,
                    }}
                >
                    {signingOut ? "Signing out…" : "Sign out"}
                </button>
                <div style={{ fontSize: 10.5, color: C.lo, marginTop: 8, lineHeight: 1.5 }}>
                    Hours sync to your own account. The schedule (Board tab) is shared; only an admin can add or change it.
                </div>
                <button
                    className="foc"
                    onClick={() => setPwModal(true)}
                    style={{ width: "100%", marginTop: 8, background: "transparent", color: C.gc, border: "1px solid " + C.line, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700 }}
                >
                    Change password
                </button>
                {!profile.graduatedAt && (
                    <button
                        className="foc"
                        onClick={onOpenWelcome}
                        style={{
                            width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            background: "transparent", color: C.mid, border: "1px solid " + C.line, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700,
                        }}
                    >
                        <HelpCircle size={14} />
                        Welcome message &amp; help
                    </button>
                )}
            </Fold>

            {pwModal && (
                <Modal title="Change password" onClose={() => setPwModal(false)}>
                    <PasswordSetter onSaved={onPasswordSet} />
                </Modal>
            )}
        </>
    );
}
