/*
 * Pure presentation rules of the /volby surface — no React, no store, no
 * catalog: which token class a severity wears, where a rule's methodology
 * anchor is, which figure keys are shares / money / multiples, and where a
 * finding's SUBJECT lives as a route. Kept out of the components so the tests
 * can pin them without rendering.
 */

import { krajByIco } from "@/lib/analysis/volby/kraje";
import type { Finding, Severity, Valence } from "@/lib/analysis/volby/types";

/** Tokens only (docs/DESIGN.md §1): the chip's border + text per severity. Low is
 *  steel (a positive finding is low by construction and must not read as a warning). */
export const SEVERITY_CHIP: Record<Severity, string> = {
  low: "border-steel text-steel-aa",
  medium: "border-ochre bg-ochre/15 text-ink",
  high: "border-signal-deep text-signal-deep",
};

/** Timeline dot per valence — the FactRow/CareerSpine tone-dot vocabulary. */
export const VALENCE_DOT: Record<Valence, string> = {
  negative: "bg-signal",
  positive: "bg-cobalt",
  unrated: "bg-steel",
};

/** `volby:N1` → `/metodika#volby-N1` (features/civicscore/MetodikaVolbySection.ruleAnchor). */
export const ruleHref = (ruleRef: string): string => `/metodika#${ruleRef.replace(":", "-")}`;

/** Figures that are SHARES in [0, 1] — typeset as a percentage. */
export const SHARE_FIGURES = new Set(["share", "baseline", "dependence", "circle3Share", "switchRate"]);
/** Figures that are CZK amounts. */
export const CZK_FIGURES = new Set(["sponsor_contract_czk"]);
/** Figures that are multiples of a baseline — `×` suffix. */
export const MULTIPLE_FIGURES = new Set(["multiple"]);

export type FigureKind = "share" | "czk" | "multiple" | "int";

export const figureKind = (key: string): FigureKind =>
  SHARE_FIGURES.has(key) ? "share" : CZK_FIGURES.has(key) ? "czk" : MULTIPLE_FIGURES.has(key) ? "multiple" : "int";

/** A share in [0,1] to one-decimal percent, as a number the formatter typesets. */
export const sharePct = (share: number): number => Math.round(share * 1000) / 10;

/** Ordered keys of a figures record — the rule's own order is insertion order,
 *  and the reader should see the rule inputs in the order the rule names them. */
export const figureEntries = (figures: Finding["figures"]): [string, number][] =>
  Object.entries(figures).filter(([, v]) => Number.isFinite(v));

/**
 * Where a finding's subject lives on this surface. `company:ico:<8>` is a kraj
 * when its IČO is in the crosswalk, an obec when `isObec` says so (the caller
 * has the registry — this module must not load 6 254 rows to answer), else the
 * company case file on /penize. `list:<pspId>` has no slug in the Finding, so it
 * lands on the list index; `person:<pspId>` is the spis.
 */
export function subjectHref(subjectId: string, isObec: (ico: string) => boolean): string | null {
  if (subjectId.startsWith("company:ico:")) {
    const ico = subjectId.slice("company:ico:".length);
    const kraj = krajByIco(ico);
    if (kraj) return `/volby/kraj/${kraj.slug}`;
    if (isObec(ico)) return `/volby/obec/${ico}`;
    return `/penize/firma/${ico}`;
  }
  if (subjectId.startsWith("person:")) return `/poslanec/${subjectId.slice("person:".length)}`;
  if (subjectId.startsWith("list:")) return "/volby/snemovna";
  return null;
}

/** The date a finding is filed under: the later fact when held, else the decision. */
export const findingDate = (f: Finding): string | null => f.laterOn ?? f.decidedOn;
