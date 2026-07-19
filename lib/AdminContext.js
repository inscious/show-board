"use client";

import { createContext, useContext } from "react";

/* Populated by app/admin/layout.jsx, which owns the one shared data load —
   layouts persist across sibling route changes in the App Router, so moving
   between /admin/roster, /admin/schedule, etc. reuses this instead of
   refetching. Every /admin/** page reads from here rather than fetching its
   own copy. */
export const AdminContext = createContext(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin() called outside app/admin/layout.jsx");
  return ctx;
}
