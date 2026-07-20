"use client";

/* JATC office (training center) + District Council 36 — two separate
   tables (jatc_contacts, dc36_contacts), one Fold, so apprentices see one
   "Contacts" row instead of two. Reads DirectoryContext directly, same as
   CoPicker/DaySheet, rather than threading jatcContacts/dc36Contacts
   through props. */
import { useContext } from "react";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { Fold } from "@/components/ui/Fold";
import { DirectoryContext } from "@/components/utils/DirectoryContext";
import { C, FM, fmtTel, mapsUrl } from "@/lib/core";

export function ContactsCard() {
    const { jatcContacts, dc36Contacts, orgProfile } = useContext(DirectoryContext);
    return (
        <Fold icon={Phone} title="Contacts" color={C.working}>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, marginBottom: 8 }}>
                JATC OFFICE
            </div>
            <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
                {jatcContacts.map((c) => (
                    <div
                        key={c.n}
                        style={{
                            background: C.sunk,
                            border: "1px solid " + C.line,
                            borderRadius: 9,
                            padding: "10px 11px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <span
                                className="truncate"
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: C.hi,
                                }}
                            >
                                {c.n}
                            </span>
                            {c.tel && (
                                <a
                                    className="foc"
                                    href={
                                        "tel:" +
                                        c.tel +
                                        (c.ext ? "," + c.ext : "")
                                    }
                                    style={{
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "rgba(47,176,122,0.14)",
                                        color: C.working,
                                        textDecoration: "none",
                                        padding: "6px 8px",
                                        borderRadius: 7,
                                        fontWeight: 800,
                                        fontSize: 11,
                                        border: "1px solid rgba(47,176,122,0.3)",
                                    }}
                                >
                                    <Phone size={11} />
                                    {fmtTel(c.tel)}{c.ext ? " x" + c.ext : ""}
                                </a>
                            )}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 10,
                                marginTop: 6,
                            }}
                        >
                            {c.email && (
                                <a
                                    className="foc"
                                    href={"mailto:" + c.email}
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 10.5,
                                        color: C.gc,
                                        textDecoration: "none",
                                    }}
                                >
                                    {c.email}
                                </a>
                            )}
                            {c.sms && (
                                <a
                                    className="foc"
                                    href={"sms:" + c.sms}
                                    style={{
                                        fontFamily: FM,
                                        fontSize: 10.5,
                                        color: C.lo,
                                        textDecoration: "none",
                                    }}
                                >
                                    text {fmtTel(c.sms)}
                                </a>
                            )}
                        </div>
                    </div>
                ))}
                <a
                    className="foc"
                    href={mapsUrl(orgProfile.jatcOfficeAddress)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: C.sunk,
                        border: "1px solid " + C.line,
                        borderRadius: 9,
                        padding: "10px 11px",
                        textDecoration: "none",
                    }}
                >
                    <MapPin
                        size={13}
                        color={C.working}
                        style={{ flexShrink: 0 }}
                    />
                    <span
                        className="truncate"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12,
                            color: C.hi,
                        }}
                    >
                        {orgProfile.jatcOfficeAddress}
                    </span>
                    <ChevronRight
                        size={14}
                        color={C.lo}
                        style={{ flexShrink: 0 }}
                    />
                </a>
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: C.lo,
                    marginTop: 9,
                    lineHeight: 1.5,
                }}
            >
                Out-of-work lists go to the employers every Friday — it's on
                you to tell the office when you're off a job, and again when
                you get scheduled.
            </div>
            {dc36Contacts.length > 0 && (
            <>
            <div style={{ fontSize: 10, letterSpacing: 0.6, color: C.lo, fontFamily: FM, margin: "18px 0 8px", paddingTop: 14, borderTop: "1px solid " + C.line }}>
                DISTRICT COUNCIL (DC36)
            </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    {dc36Contacts.map((c) => (
                        <div
                            key={c.n}
                            style={{
                                background: C.sunk,
                                border: "1px solid " + C.line,
                                borderRadius: 9,
                                padding: "10px 11px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <span
                                    className="truncate"
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: C.hi,
                                    }}
                                >
                                    {c.n}
                                </span>
                                {c.tel && (
                                    <a
                                        className="foc"
                                        href={
                                            "tel:" +
                                            c.tel +
                                            (c.ext ? "," + c.ext : "")
                                        }
                                        style={{
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 5,
                                            background: "rgba(127,178,255,0.14)",
                                            color: C.gc,
                                            textDecoration: "none",
                                            padding: "6px 8px",
                                            borderRadius: 7,
                                            fontWeight: 800,
                                            fontSize: 11,
                                            border: "1px solid rgba(127,178,255,0.3)",
                                        }}
                                    >
                                        <Phone size={11} />
                                        {fmtTel(c.tel)}{c.ext ? " x" + c.ext : ""}
                                    </a>
                                )}
                            </div>
                            {(c.email || c.sms) && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 10,
                                        marginTop: 6,
                                    }}
                                >
                                    {c.email && (
                                        <a
                                            className="foc"
                                            href={"mailto:" + c.email}
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: C.gc,
                                                textDecoration: "none",
                                            }}
                                        >
                                            {c.email}
                                        </a>
                                    )}
                                    {c.sms && (
                                        <a
                                            className="foc"
                                            href={"sms:" + c.sms}
                                            style={{
                                                fontFamily: FM,
                                                fontSize: 10.5,
                                                color: C.lo,
                                                textDecoration: "none",
                                            }}
                                        >
                                            text {fmtTel(c.sms)}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </>
            )}
        </Fold>
    );
}
