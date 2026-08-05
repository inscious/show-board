"use client";

/* Phone number + email-notification toggle — its own card, split out of
   AccountCard (previously an inline section there) once it stopped reading
   like "account settings" and started reading like its own thing worth
   finding on its own. Self-service via the same /api/profile/onboarding
   route /pending's profile form already posts to (profileOnboardingSchema
   already accepts phone/notifyEmail/notifySms).

   Text notifications aren't shippable yet (needs a Twilio account — real
   new vendor infra, phase 2 of the notification-preferences work). The
   phone number is still captured now since it's the same field either way
   and a foreman already benefits from it today (manual call/text), but no
   SMS toggle is shown until sending is actually real — a toggle that
   silently does nothing would be worse than not having it yet. */
import { useState } from "react";
import { Bell } from "lucide-react";
import { C, FM } from "@/lib/core";
import { Fold } from "@/components/ui/Fold";

/* A round on/off switch, same visual language app-wide (no existing shared
   Switch component — this was the first toggle-style control in the app,
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

export function NotificationsCard({ profile, onSaved }) {
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
        <Fold icon={Bell} title="Notifications" color={C.gc}>
            <form onSubmit={submit}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.lo, fontFamily: FM, marginBottom: 4 }}>PHONE (optional)</div>
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setState("idle"); }}
                    placeholder="619-555-0100"
                    style={{ width: "100%", background: C.sunk, border: "1px solid " + C.line, borderRadius: 8, padding: "9px 10px", color: C.hi, fontSize: 12.5, marginBottom: 4 }}
                />
                <div style={{ fontSize: 10.5, color: C.lo, marginBottom: 12, lineHeight: 1.4 }}>
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
        </Fold>
    );
}
