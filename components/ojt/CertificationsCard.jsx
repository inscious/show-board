"use client";

/* Certifications Fold on the OJT tab — list plus the self-report picker
   (pick a name from COMMON_CERTS, not free text; won't save without an
   expiration date). Owns its own picker state since nothing outside this
   card needs it. */
import { useState } from "react";
import { Check } from "lucide-react";
import { Fold } from "@/components/ui/Fold";
import { C, COMMON_CERTS, FM, MONTHS, certState, mParse } from "@/lib/core";

export function CertificationsCard({ certs, onSaveCert }) {
    const [addingCert, setAddingCert] = useState(null); // COMMON_CERTS name, or null
    const [certExp, setCertExp] = useState("");
    const [certSaving, setCertSaving] = useState(false);

    return (
        <Fold icon={Check} title="Certifications" color={C.gc}>
            {certs.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.lo }}>
                    Nothing on file yet — add one below, or your admin
                    can enter it.
                </div>
            )}
            <div
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
            >
                {certs.map((c) => {
                    const st = certState(c.exp);
                    const pp = mParse(c.exp.slice(0, 7));
                    const day = Number(c.exp.slice(8));
                    return (
                        <div
                            key={c.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "9px 10px",
                            }}
                        >
                            <span
                                style={{
                                    width: 3,
                                    alignSelf: "stretch",
                                    borderRadius: 2,
                                    background: st.c,
                                    flexShrink: 0,
                                }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                    className="truncate"
                                    style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: C.hi,
                                    }}
                                >
                                    {c.n}
                                </div>
                                <div
                                    style={{
                                        fontSize: 10.5,
                                        color: C.lo,
                                        fontFamily: FM,
                                        marginTop: 2,
                                    }}
                                >
                                    {st.days < 0 ? "expired" : "expires"}{" "}
                                    {MONTHS[pp.m]} {day}, {pp.y}
                                </div>
                            </div>
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontFamily: FM,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    letterSpacing: 0.4,
                                    color: st.c,
                                    border: "1px solid " + st.c + "55",
                                    borderRadius: 5,
                                    padding: "2px 5px",
                                }}
                            >
                                {st.t}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* self-report picker — pick a name from COMMON_CERTS, not
                free text, and won't save without an expiration date. */}
            <div
                style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid " + C.line,
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        letterSpacing: 0.5,
                        color: C.lo,
                        fontFamily: FM,
                        marginBottom: 6,
                    }}
                >
                    ADD ONE YOU HOLD
                </div>
                <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                >
                    {COMMON_CERTS.map((name) => {
                        const existing = certs.find((c) => c.n === name);
                        const on = addingCert === name;
                        return (
                            <button
                                key={name}
                                className="foc"
                                onClick={() => {
                                    setAddingCert(name);
                                    setCertExp(existing?.exp || "");
                                }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "8px 11px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: on ? C.gc + "22" : C.sunk,
                                    color: on ? C.gc : C.hi,
                                    border:
                                        "1px solid " +
                                        (on ? C.gc + "66" : C.line),
                                }}
                            >
                                {name}
                                {existing && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: C.lo,
                                            fontFamily: FM,
                                        }}
                                    >
                                        on file
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {addingCert && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 10,
                        }}
                    >
                        <input
                            className="foc"
                            type="date"
                            value={certExp}
                            onChange={(e) => setCertExp(e.target.value)}
                            style={{
                                flex: 1,
                                background: C.sunk,
                                color: C.hi,
                                border: "1px solid " + C.line,
                                borderRadius: 8,
                                padding: "9px 10px",
                                fontSize: 13,
                                fontFamily: FM,
                            }}
                        />
                        <button
                            className="foc"
                            disabled={!certExp || certSaving}
                            onClick={() => {
                                if (!certExp) return;
                                setCertSaving(true);
                                const existing = certs.find(
                                    (c) => c.n === addingCert,
                                );
                                const id =
                                    existing?.id ||
                                    "cert" +
                                        Date.now().toString(36) +
                                        Math.random()
                                            .toString(36)
                                            .slice(2, 5);
                                onSaveCert(id, addingCert, certExp);
                                setCertSaving(false);
                                setAddingCert(null);
                                setCertExp("");
                            }}
                            style={{
                                flexShrink: 0,
                                padding: "9px 14px",
                                borderRadius: 8,
                                background: certExp
                                    ? C.working
                                    : C.raise,
                                color: certExp ? C.inkGood : C.lo,
                                border:
                                    "1px solid " +
                                    (certExp ? C.working : C.line),
                                fontWeight: 800,
                                fontSize: 12.5,
                                opacity: certSaving ? 0.7 : 1,
                            }}
                        >
                            Save
                        </button>
                    </div>
                )}
                <div
                    style={{
                        fontSize: 10.5,
                        color: C.lo,
                        marginTop: 8,
                        lineHeight: 1.45,
                    }}
                >
                    Pick what you have, then set when it expires — it
                    won't save without a date.
                </div>
            </div>
        </Fold>
    );
}
