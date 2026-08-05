"use client";

/* Rendered instead of OjtTab.jsx when profile.graduatedAt is set — same
   "ojt" tab key/route (ShowBoard.jsx just swaps which component renders),
   relabeled "Account" in the nav. A CJ's pay is pinned to scale by
   ShowBoard.jsx's lvIdx computation before it ever reaches here, so idx/lv
   below are hardcoded to the CJ row rather than derived from hours —
   correct for both a fresh graduate with a real history and a 20-year
   veteran who never did a formal apprenticeship and has none on file.

   Deliberately does NOT include: level progression (nothing to work
   toward once certified), the four work processes, the RSI/curriculum
   self-report tracker, the blank OJT form, or JATC Rules & Regulations —
   all apprenticeship-program-specific. Admin-assigned one-off classes
   (forklift, scissor lift, CPR) still surface via the normal booking/
   notification system on Home/Board, untouched. */
import { LEVELS } from "@/lib/core";
import { PayRatesCard } from "@/components/ojt/PayRatesCard";
import { CertificationsCard } from "@/components/ojt/CertificationsCard";
import { ContactsCard } from "@/components/ojt/ContactsCard";
import { AccountCard } from "@/components/ojt/AccountCard";
import { PreviousProgressionCard } from "@/components/ojt/PreviousProgressionCard";

export function CjAccountTab({
    ojt,
    entries,
    rates,
    onSetRate,
    onRemoveRate,
    onAddRateCo,
    email,
    isAdmin,
    profile,
    onPasswordSet,
    onOpenWelcome,
    pwIntent,
    onPwIntentConsumed,
    onSignOut,
    certs,
    onSaveCert,
}) {
    const idx = LEVELS.length - 1; // CJ — always the top of the ladder, never hours-derived
    const lv = LEVELS[idx];
    const hasHistory = (ojt.months || []).length > 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PayRatesCard
                lv={lv}
                idx={idx}
                entries={entries}
                rates={rates}
                onSetRate={onSetRate}
                onRemoveRate={onRemoveRate}
                onAddRateCo={onAddRateCo}
            />
            <CertificationsCard certs={certs} onSaveCert={onSaveCert} />
            {hasHistory && <PreviousProgressionCard ojt={ojt} entries={entries} />}
            <AccountCard
                email={email}
                isAdmin={isAdmin}
                profile={profile}
                onSignOut={onSignOut}
                onPasswordSet={onPasswordSet}
                onOpenWelcome={onOpenWelcome}
                pwIntent={pwIntent}
                onPwIntentConsumed={onPwIntentConsumed}
            />
            <ContactsCard />
        </div>
    );
}
