// "#RRGGBB" -> "r,g,b", for building rgba() strings. Shared between Home
// and Calendar (both tint day cells by category color) — split out so
// neither has to duplicate it or import from the other.
export function hexRgb(h) {
    const s = String(h || "#888888").replace("#", "");
    return [
        parseInt(s.slice(0, 2), 16),
        parseInt(s.slice(2, 4), 16),
        parseInt(s.slice(4, 6), 16),
    ].join(",");
}
