// Tvarosloví uzlů na plátně — pokračování slovníku z velína
// (features/dashboard/components/GraphGlyph.tsx): DRUH NESE TVAR, barva ho jen
// zesiluje. Kdo se naučí tvary na velínu, čte i playground.
//
// Plátno je <canvas>, takže barvy musí být literální řetězce — proto se berou
// ze zrcadla tokenů `features/landing/palette.ts`, jediného povoleného místa
// s hexy mimo globals.css (viz docs/DESIGN.md §1 a custom/no-hardcoded-colors).

import { COBALT, INK, OCHRE, SIGNAL, STEEL } from "@/features/landing/palette";
import type { KgNodeKind } from "@/lib/kg/sourceLinks";
import type { GlyphShape } from "@/lib/kg/glyph";

// Geometrie žije v lib/kg/glyph.ts — re-export, aby volající nemuseli vědět,
// že je rozdělená na „tvar" (čistý) a „barva" (potřebuje paletu).
export { glyphPath, traceGlyph } from "@/lib/kg/glyph";
export type { GlyphShape } from "@/lib/kg/glyph";

export interface KindStyle {
  shape: GlyphShape;
  fill: string;
  /** Základní poloměr v souřadnicích plátna (před zoomem). */
  radius: number;
}

export const KIND_STYLE: Record<KgNodeKind, KindStyle> = {
  person: { shape: "circle", fill: COBALT, radius: 7 },
  party: { shape: "ring", fill: STEEL, radius: 8 },
  organ: { shape: "hexagon", fill: STEEL, radius: 7 },
  bloc: { shape: "hexagon", fill: INK, radius: 8 },
  theme: { shape: "ring", fill: OCHRE, radius: 7 },
  company: { shape: "square", fill: INK, radius: 6.5 },
  contract: { shape: "diamond", fill: SIGNAL, radius: 5.5 },
  bill: { shape: "triangle", fill: INK, radius: 7 },
  law: { shape: "pentagon", fill: OCHRE, radius: 7 },
  notice: { shape: "square", fill: STEEL, radius: 5 },
};

/**
 * Barevný SLOT druhu — jméno tokenu místo hexu, aby plátno umělo číst
 * paletu podle režimu (forenzní vrstva přemapovává tokeny, ne komponenty;
 * viz features/graph/stagePalette.ts). Drž v sync s KIND_STYLE.fill.
 */
export type KindFillToken = "ink" | "steel" | "signal" | "cobalt" | "ochre";

export const KIND_FILL_TOKEN: Record<KgNodeKind, KindFillToken> = {
  person: "cobalt",
  party: "steel",
  organ: "steel",
  bloc: "ink",
  theme: "ochre",
  company: "ink",
  contract: "signal",
  bill: "ink",
  law: "ochre",
  notice: "steel",
};

/** Tailwind fill-* třída slotu — pro SVG v DOMu (legenda), kde token
 *  přepne forenzní vrstva sama. */
export const KIND_FILL_CLASS: Record<KindFillToken, string> = {
  ink: "fill-ink",
  steel: "fill-steel",
  signal: "fill-signal",
  cobalt: "fill-cobalt",
  ochre: "fill-ochre",
};

/**
 * Pořadí pruhů v mapě. Čte se shora dolů jako cesta veřejných peněz a moci:
 * lidé → jejich uskupení → firmy → smlouvy → legislativa.
 */
export const KIND_ORDER: readonly KgNodeKind[] = [
  "person",
  "party",
  "organ",
  "bloc",
  "theme",
  "company",
  "contract",
  "bill",
  "law",
  "notice",
];

/** Druhy, které nese velký objem a v mapě dominují — nabízí se skrýt. */
export const BULK_KINDS: readonly KgNodeKind[] = ["contract"];

export function isKgNodeKind(v: string): v is KgNodeKind {
  return (KIND_ORDER as readonly string[]).includes(v);
}
