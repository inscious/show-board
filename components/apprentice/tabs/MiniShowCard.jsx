"use client";

/* A show's card on the Home dashboard ("On the Floor Today", "Next
   Move-ins") — same spine/date-block/badges/chips as the Board tab's
   ShowCard, via the shared ShowCardHeader, just without the expand-to-detail
   behavior Board needs. Reusing the header directly (not a lookalike) is
   what makes this "for continuity" rather than just similarly styled. */
import { C, SHADOW, isPast } from "@/lib/core";
import { ShowCardHeader } from "@/components/apprentice/tabs/ShowCard";

export function MiniShowCard({ show, onClick }) {
    const past = isPast(show);
    return (
        <div
            style={{
                background: C.panel,
                borderRadius: 13,
                overflow: "hidden",
                opacity: show.status === "passed" ? 0.55 : past ? 0.66 : 1,
                border: "1px solid " + C.edge,
                boxShadow: SHADOW,
            }}
        >
            <ShowCardHeader show={show} onClick={onClick} />
        </div>
    );
}
