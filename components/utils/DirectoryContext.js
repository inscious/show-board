"use client";

/* Split into its own module so ShowBoard.jsx and the per-tab files under
   components/tabs/ can both import it without a circular dependency
   (ShowBoard renders the tabs, the tabs need the same context instance). */
import { createContext } from "react";
import { UNION_NAME, UNION_LINE, UNION_LINE_PRETTY, JATC } from "@/lib/core";

export const DirectoryContext = createContext({
    companies: [],
    jatcContacts: [],
    dc36Contacts: [],
    orgProfile: {
        unionName: UNION_NAME,
        outOfWorkLine: UNION_LINE,
        outOfWorkLinePretty: UNION_LINE_PRETTY,
        jatcOfficeAddress: JATC.office,
    },
});
