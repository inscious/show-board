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

/* A round on/off switch, same visual language app-wide (no existing shared
   Switch component — this is the first toggle-style control in the app,
   everything else so far has been a chip/button pair). */
function Switch({ on, onChange, disabled }) {
    return (
        <span
            onClick={() => !disabled && onChange(!on)}
            role="switch"
            aria-checked={on}
            style={{
                width: 34, height: 20, borderRadius: 10, flexShrink: 0, position: "relative",
                background: on && !disabled ? C.working : C.sunk,
                border: "1px solid " + (on && !disabled ? C.working : C.line),
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "background .15s, border-color .15s",
            }}
        >
            <span style={{
                position: "absolute", top: 1, left: on ? 15 : 1, width: 16, height: 16, borderRadius: "50%",
                background: on && !disabled ? C.inkGood : C.mid, transition: "left .15s",
            }} />
        </span>
    );
}

/* Phone number + email-notification toggle — self-service via the same
   /api/profile/onboarding route /pending's profile form already posts to
   (profileOnboardingSchema already accepts phone/notifyEmail/notifySms).
   Text notifications aren't shippable yet (needs a Twilio account — real
   new vendor infra, phase 2 of the notification-preferences work) — the
   phone number is still captured now since it's the same field either way
   and a foreman already benefits from it today (manual call/text), but no
   SMS toggle is shown until sending is actually real. Showing a toggle that
   silently does nothing would be worse than not having it yet. */
function NotificationPrefs({ profile, onSaved }) {
    const [phone, setPhone] = useState(profile.phone || "");
    const [notifyEmail, setNotifyEmail] = useState(profile.notifyEmail);
    const [state, setState] = useState("idle"); // idle | saving | done | error
    const [msg, setMsg] = useState("");

    const dirty = phone !== (profile.phone || "") || notifyEmail !== profile.notifyEmail;

    const submit = async (e) => {
        e.preventDefault();
        setState("saving");
        setMsg("");
        try {
            const res = await fetch("/api/profile/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.trim(), notifyEmail }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Couldn't save.");
            setState("done");
            onSaved?.({ phone: phone.trim(), notifyEmail });
        } catch (e2) {
            setState("error");
            setMsg(e2.message || "Couldn't save. Try again.");
        }
    };

    return (
        <form onSubmit={submit} style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid " + C.line }}>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                NOTIFICATIONS
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PHONE (optional)</div>
            <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setState("idle"); }}
                placeholder="619-555-0100"
                aria-label="Phone (optional)"
                style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 10px", color: C.hi, fontSize: 12.5, marginBottom: 4 }}
            />
            <div style={{ fontSize: 10.5, color: C.lo, marginBottom: 10, lineHeight: 1.4 }}>
                Lets a foreman call or text you about a labor call. Text alerts from
                the app itself aren't live yet — this is just getting your number on file for when they are.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                <Switch on={notifyEmail} onChange={setNotifyEmail} />
                <span style={{ fontSize: 12.5, color: C.mid, flex: 1 }}>Email notifications</span>
            </label>
            <div style={{ fontSize: 10.5, color: C.lo, marginBottom: 4, lineHeight: 1.4 }}>
                New show schedules, class assignments, cert reminders, OJT decisions, labor calls.
            </div>
            {dirty && (
                <button type="submit" disabled={state === "saving"}
                    style={{ width: "100%", marginTop: 8, padding: "9px", borderRadius: 8, background: state === "done" ? C.working : C.brand, color: state === "done" ? C.inkGood : C.ink, border: "none", fontWeight: 800, fontSize: 12.5, opacity: state === "saving" ? 0.6 : 1 }}>
                    {state === "saving" ? "Saving…" : state === "done" ? "Saved" : "Save"}
                </button>
            )}
            {msg && <div style={{ marginTop: 6, fontSize: 11.5, color: C.danger }}>{msg}</div>}
        </form>
    );
}

function PwInput({ value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center" }}>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                aria-label={placeholder}
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
    // local override so the toggle/phone reflect a just-saved value right
    // away — `profile` itself is a prop from ShowBoard's own sync state,
    // which doesn't refetch just because this one field changed.
    const [prefsOverride, setPrefsOverride] = useState(null);
    const effectiveProfile = prefsOverride ? { ...profile, ...prefsOverride } : profile;

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
                <NotificationPrefs profile={effectiveProfile} onSaved={setPrefsOverride} />
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
