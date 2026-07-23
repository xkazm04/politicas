// Zrcadlo barevných tokenů z app/globals.css pro recharts.
// Recharts chrome (mřížky, osy, tooltip, fill) potřebuje literální řetězce —
// CSS třídy tam nevedou. Tohle je JEDINÉ místo mimo globals.css,
// features/labs/ a datové barvy stran, kde smí existovat hex
// (hlídá custom/no-hardcoded-colors). Při změně tokenu změň obě místa.

import type { Pillar } from "@/lib/civic/data";

export const INK = "#131313";
export const PAPER = "#f0eee7";
export const PAPER_STRONG = "#e9e6dc";
export const SIGNAL = "#d5372c";
export const COBALT = "#1f3fa8";
export const OCHRE = "#dfa321";
export const STEEL = "#77726a";
export const HAIRLINE = "#d7d3c8";

/** Barva pilíře v grafech — stejné přiřazení drží legenda, posuvníky i sloupce. */
export const PILLAR_FILL: Record<Pillar["key"], string> = {
  activity: SIGNAL,
  attendance: COBALT,
  independence: INK,
  integrity: OCHRE,
};

/** Tailwind bg-* třída pilíře pro DOM (mimo grafy) — drž v sync s PILLAR_FILL. */
export const PILLAR_BG: Record<Pillar["key"], string> = {
  activity: "bg-signal",
  attendance: "bg-cobalt",
  independence: "bg-ink",
  integrity: "bg-ochre",
};

/** Chrome tooltipu — plochý, mono, bez zaoblení (sutnarovská řeč). */
export const TOOLTIP_STYLE = {
  border: `2px solid ${INK}`,
  borderRadius: 0,
  background: PAPER,
  color: INK,
  fontFamily: "var(--font-plex)",
  fontSize: 12,
} as const;
