"use client";

import { createContext, useContext } from "react";

/* Populated by app/console/layout.jsx, same "one shared data load, layout
   persists across sibling route changes" pattern as lib/AdminContext.js.
   Every /console/** page reads from here rather than fetching its own copy. */
export const PlatformContext = createContext(null);

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform() called outside app/console/layout.jsx");
  return ctx;
}
