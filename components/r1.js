import { num } from "@/lib/core";

// round to one decimal — used anywhere clock/weighted hours get displayed.
// Shared across ShowBoard.jsx and the split-out tab files.
export const r1 = (v) => Math.round(num(v) * 10) / 10;
