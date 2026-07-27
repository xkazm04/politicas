/**
 * Public-copy safety for analyst prose that renders VERBATIM to readers.
 *
 * The effort loop's dossier fields (`effort_notes`, `effort_public_role`,
 * `effort_bill_focus`) are written by an analyst army and shown as-is on
 * `/poslanec`. A raw prop identifier, an internal case name, a gate-rule
 * citation or a batch self-reference is never legitimate reader copy — even
 * when the sentence is factually TRUE, which is exactly why accuracy-only gates
 * passed hundreds of them.
 *
 * Measured 2026-07-25 (batch 006): the leak had grown monotonically across
 * batches (5 → 18 → 84 → 140 → 199 field-instances) and reached **136 of 207
 * live person nodes / 436 field-instances** — all of it rendering to the reader
 * since the manifestation pass wired the dossier layer into the profile page.
 *
 * These rules therefore run at BOTH ends, and this module is the one definition
 * both import:
 *   - persist time — `scripts/case-loops/effort/gate.ts` hard-DROPs a violating
 *     proposal, so no new leak enters the graph;
 *   - render time — `features/profile/getProfileData.ts` withholds a violating
 *     string, so the ~436 already in the graph never reach a reader while the
 *     backlog is rewritten.
 * Render-time withholding is deliberately non-destructive: the prose stays in
 * the graph for the rewrite pass, it simply does not ship.
 */

export const PIPELINE_JARGON: { re: RegExp; what: string }[] = [
  {
    re: /\b(committee_count|leadership_count|bills_authored|speech_turns|absence_rate|participation_rate|contribution_score|interpellations_count)\b/i,
    what: "raw prop identifier",
  },
  {
    re: /\b(sponsoredBills|linkedCompanies|contributionPsp9|quietWorkhorseIndex|componentDivergence|tenureClass|zVsClub|triageScore|effort_[a-z_]+)\b/,
    what: "raw pipeline field name",
  },
  { re: /Case\s*[①②③]|case-(money|effort|law)\b/i, what: "internal case reference" },
  { re: /\bgate\s*\(?[a-e]\)?(?![a-z])/i, what: "internal gate-rule citation" },
  {
    re: /\b(batch|dávka)\s*\d|v tomto vzorku|ve vzorku (pěti|čtyř|tří)|tomto vzorku/i,
    what: "batch/sample self-reference",
  },
  // batch 008: the same self-reference class in superlative clothing — a claim
  // scoped to the analyst's own working set ("nejvíce ze svého vzorku",
  // "nejaktivnější řečník ze skupiny", "v této skupině", "v tomto přehledu")
  // reads as a checkable fact but references an internal sample a reader can
  // never see. Found in 8/16 batch-008 proposals; the older rule missed all of
  // them. Genitive/locative variants covered.
  // Kept narrow on purpose: "ze skupiny poslanců" is ordinary Czech (a bill by
  // a group of MPs), so bare "ze skupiny" must NOT trip — only the superlative
  // form ("nejvíce/nejaktivnější … ze skupiny") and the explicit sample words.
  {
    re: /ze svého vzorku|nej[\p{L}]+(?:\s[\p{L}]+){0,2}\sz(?:e)? (?:celé )?skupiny|v této skupině|v tomto přehledu|z tohoto přehledu/iu,
    what: "sample-scoped self-reference",
  },
  // Q-effort-15 (batch 007): added here because gate.ts carried this rule as a LOCAL
  // fork (never imported from this module, despite the docstring above claiming a
  // single shared definition) — so live prose containing "endpoint"/"REST API"/
  // "JSON"/"pipeline"/"dossier" was DROPPED at persist time by the gate but NOT
  // withheld at render time by publicCopyOrNull(), an enforcement gap. Unified here;
  // gate.ts now imports this array instead of duplicating it.
  {
    re: /\b(endpoint|REST API|\/ekonomicke-subjekty|<ICO>|JSON|pipeline|dossier|dosier)\b/i,
    what: "API/pipeline mechanics",
  },
];

/** Which jargon rules a string trips, with the exact matched substring (empty ⇒ safe to render). */
export function jargonViolationDetails(text: string): { what: string; match: string }[] {
  const out: { what: string; match: string }[] = [];
  for (const { re, what } of PIPELINE_JARGON) {
    const m = re.exec(text);
    if (m) out.push({ what, match: m[0] });
  }
  return out;
}

/** Which jargon rules a string trips (empty ⇒ safe to render). */
export function jargonViolations(text: string): string[] {
  return jargonViolationDetails(text).map(({ what }) => what);
}

/** True when the string carries no pipeline jargon and may render to a reader. */
export function isPublicSafe(text: string | null | undefined): boolean {
  return typeof text === "string" && text.length > 0 && jargonViolations(text).length === 0;
}

/** The string if it is safe to show a reader, otherwise null (never a partial). */
export function publicCopyOrNull(text: string | null | undefined): string | null {
  return isPublicSafe(text) ? (text as string) : null;
}
