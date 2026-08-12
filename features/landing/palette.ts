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

/** Tailwind bg-* třída pilíře pro DOM. Jediný konzument je označená ukázka
 *  ve velíně (features/dashboard/components/MockRankingLedger.tsx) — čtyři
 *  mock pilíře na reálných plochách nahradilo šest složek indexu přispění.
 *  Sesterská mapa `PILLAR_FILL` (hexy pro recharts) zanikla 2026-08-12: po
 *  odchodu pilířů z grafů ji nečetl nikdo. */
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
