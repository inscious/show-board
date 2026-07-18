"use client";

/* Split into its own module so ShowBoard.jsx and the per-tab files under
   components/tabs/ can both import it without a circular dependency
   (ShowBoard renders the tabs, the tabs need the same context instance). */
import { createContext } from "react";

export const DirectoryContext = createContext({ companies: [], jatcContacts: [] });
