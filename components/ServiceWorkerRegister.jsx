"use client";

/* Registers public/sw.js — app-shell caching only, so a cold load with zero
   signal can still open the app (lib/store.js already handles offline data
   once the app's loaded; this covers loading it in the first place). */
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
