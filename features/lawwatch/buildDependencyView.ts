// PURE derivation of the "Závislosti na doprovodných tiscích" view from the
// two batch-014 payload shapes (triage classification + census excerpts).
// No server imports — getDependencyData.ts (the server-only loader) reads and
// parses both JSON files, then delegates the shaping to this module. Tests
// import this file directly instead of the "server-only"-guarded loader
// (same split as features/lawwatch/deriveRadar.ts).
//
// Dedup (batch-015-audit.md M18): the triage detector emits one hit per
// PLACEHOLDER MATCH in a print's text, not one per distinct companion claim —
// tisk 153's six hits all name the same companion (tisk 69) with a
// byte-identical subject string, so the section rendered "one dependency
// counted six times" as six separate rows. `companionCount` keeps counting
// raw hits (the corpus fact); `dedupedRowCount` is the separately-disclosed
// count of what actually renders.
//
// batch-016-audit.md found the first dedup pass (M13/M14/M15) computed a
// row's IDENTITY and its representative-excerpt pick on the GATED, TRUNCATED
// values — which are capped to CONTEXT_MAX_CHARS (220 chars) for display —
// rather than the raw payload evidence:
//   - M13: comparing gated `context.length` for "keep the longest excerpt"
//     is dead code once every real excerpt is truncated to ~220 chars — they
//     tie, and `group[0]` always wins. Fixed by comparing the RAW (untruncated)
//     source-string length (`_rawContextLen`) instead; the WINNER is still
//     rendered through the normal 220-char gate afterwards.
//   - M14: a hit whose `companionSubject` fails the Czech/jargon gate renders
//     `likelyCompanionTisk: null` (the render-layer rule, unrelated to
//     identity) — keying dedup on those RENDERED/nulled fields let two hits
//     naming DIFFERENT companions collapse into one row once both were
//     independently nulled. Fixed by keying on the RAW payload identity
//     (`_rawTisk`, `_rawSubject`) instead of the rendered/nulled fields.
//   - M15: `weakEvidence` used to run WEAK_EVIDENCE_RE against the GATED,
//     already-truncated subject, so a hedge phrase past char 220 was
//     silently lost — the row then kept a confident-looking link the
//     evidence itself hedges. Fixed by testing the RAW, pre-truncation
//     subject string.
// The `_raw*` fields are internal dedup-identity metadata, stripped before a
// hit is returned as public `DependencyHit`.

export interface DependencyHit {
  context: string | null;
  companionSubject: string | null;
  likelyCompanionTisk: number | null;
  weakEvidence: boolean;
  /** How many raw triage hits collapsed into this one rendered row (1 = no
   * dupe). The surface renders a "×N" badge when this is > 1. */
  dupeCount: number;
}

export interface DependencyBillView {
  cislo: number;
  hits: DependencyHit[];
}

export interface DependencyData {
  bills: DependencyBillView[];
  companionCount: number;
  selfReferenceCount: number;
  unclearCount: number;
  totalTriaged: number;
  withheldHitCount: number;
  spotCheckedCompanionCount: number;
  /** Count of rendered rows across all bills AFTER the M18 dedup — always
   * <= companionCount - withheldHitCount - misalignedDroppedCount. Disclosed
   * alongside companionCount so a reader can see the two numbers mean
   * different things (raw hits vs rendered rows) rather than silently
   * shrinking the headline. */
  dedupedRowCount: number;
  /** Companion-dependency hits dropped WHOLESALE because their bill's triage
   * and census payload rows disagreed on hit count (batch-016-audit.md M12):
   * the two payloads can no longer be paired positionally for that bill, so
   * none of its hits render — a mis-pair (wrong excerpt attached to a claim)
   * is worse than an honestly missing row. 0 on today's corpus (all 10
   * dependency-bearing bills are aligned); disclosed so a future misalignment
   * doesn't silently vanish. */
  misalignedDroppedCount: number;
  generatedAt: string | null;
}

// --- gate contract passed in by the loader (kept here as a type so this file
// stays free of any import into lib/analysis, matching deriveRadar.ts's
// "plain module" contract) ---
export type GateFn = (v: unknown, shape: "excerpt" | "prose") => string | null;

export interface RawHit {
  context?: unknown;
  class?: unknown;
  companionSubject?: unknown;
  likelyCompanionTisk?: unknown;
  reasoning?: unknown;
}
export interface RawBill {
  cislo?: unknown;
  hits?: unknown;
}
export interface RawTriagePayload {
  generatedAt?: unknown;
  counts?: { self_reference?: unknown; companion_dependency?: unknown; unclear?: unknown };
  bills?: unknown;
}

const WEAK_EVIDENCE_RE = /bez\s+explicitn[ěí]\s+textov[ěé]\s+vazby/i;

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** A hit carrying its RAW (pre-gate, pre-truncation) evidence alongside the
 * rendered/gated `DependencyHit` fields — the raw fields are the dedup
 * IDENTITY (batch-016-audit.md M14) and the raw context length is the
 * representative-selection metric (M13); neither survives into the public
 * shape `dedupeHits` returns. */
interface InternalHit extends DependencyHit {
  _rawTisk: number | null;
  _rawSubject: string | null;
  _rawContextLen: number;
}

/** Dedup key for a hit's IDENTITY — same companion tisk, same companion
 * prose, same weak-evidence qualifier, all read from the RAW payload rather
 * than the rendered/gated fields (batch-016-audit.md M14: two hits that both
 * happen to render `likelyCompanionTisk: null` — one because its subject
 * failed the language gate, another for the same reason but naming a
 * DIFFERENT companion — must not collapse just because their rendered output
 * looks identically empty). */
function dedupeKey(h: InternalHit): string {
  return JSON.stringify([h._rawTisk, h._rawSubject, h.weakEvidence]);
}

/** Collapse hits that share a dedup IDENTITY into one row, keeping the row
 * with the STRONGEST (longest RAW, pre-truncation) excerpt as the
 * representative (batch-016-audit.md M13 — comparing the already-truncated,
 * gated `context` string ties on essentially every real group, since every
 * excerpt caps at the same ~220 chars; comparing the raw source length before
 * that cap makes the rule actually discriminate). Ties keep the earliest
 * occurrence. Order of first appearance is preserved. The winner's `context`
 * is still the normal gated/truncated string — only the SELECTION metric
 * changes, not what is displayed. */
function dedupeHits(hits: InternalHit[]): DependencyHit[] {
  const order: string[] = [];
  const groups = new Map<string, InternalHit[]>();
  for (const h of hits) {
    const key = dedupeKey(h);
    const g = groups.get(key);
    if (g) {
      g.push(h);
    } else {
      groups.set(key, [h]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    let strongest = group[0];
    for (const h of group) {
      if (h._rawContextLen > strongest._rawContextLen) strongest = h;
    }
    const { _rawTisk, _rawSubject, _rawContextLen, ...publicHit } = strongest;
    return { ...publicHit, dupeCount: group.length };
  });
}

/** The render layer's link decision for one hit's companion tisk number
 * (batch-015-audit.md M17): a `likelyCompanionTisk` the loader carries is read
 * from the triage payload, a DIFFERENT artifact than the bill corpus
 * (getLawData.ts) — the two can disagree on whether that tisk number is one
 * the app actually has a page for. `tiskExists` is the caller's corpus
 * membership check (typically `billTitleByCislo.has`); this function makes no
 * assumption about where the corpus comes from, only that membership answers
 * yes/no per tisk number. */
export type CompanionLinkState =
  | { kind: "linked"; tisk: number }
  | { kind: "out-of-corpus"; tisk: number }
  | { kind: "none" };

export function resolveCompanionLink(
  likelyCompanionTisk: number | null,
  tiskExists: (tisk: number) => boolean,
): CompanionLinkState {
  if (likelyCompanionTisk == null) return { kind: "none" };
  return tiskExists(likelyCompanionTisk)
    ? { kind: "linked", tisk: likelyCompanionTisk }
    : { kind: "out-of-corpus", tisk: likelyCompanionTisk };
}

/** Build the full DependencyData view from parsed (but untyped) payloads.
 * `gate` is the caller's Czech/jargon gate — passed in rather than imported
 * so this module stays a plain function of its inputs. */
export function buildDependencyView(
  raw: RawTriagePayload,
  censusByCislo: Map<number, (string | undefined)[]>,
  gate: GateFn,
): DependencyData | null {
  const rawBills = Array.isArray(raw.bills) ? (raw.bills as RawBill[]) : [];
  if (rawBills.length === 0) return null;

  let withheldHitCount = 0;
  let spotCheckedCompanionCount = 0;
  let dedupedRowCount = 0;
  let misalignedDroppedCount = 0;
  const bills: DependencyBillView[] = [];

  for (const b of rawBills) {
    if (typeof b.cislo !== "number") continue;
    const rawHits = Array.isArray(b.hits) ? (b.hits as RawHit[]) : [];
    const censusHits = censusByCislo.get(b.cislo);
    const hasCensusEntry = censusHits !== undefined;

    // Drop-guard (batch-016-audit.md M12): a bill present in BOTH payloads
    // whose hit counts genuinely disagree cannot be paired positionally
    // without risking a wrong excerpt attached to a hit's claim — drop the
    // whole bill's companion_dependency hits rather than mis-pair any of
    // them. A bill simply ABSENT from the census payload is a different,
    // already-handled case (per-hit fallback to the triage payload's own
    // shorter context below) — not a disagreement.
    if (hasCensusEntry && censusHits!.length !== rawHits.length) {
      misalignedDroppedCount += rawHits.filter((h) => h.class === "companion_dependency").length;
      continue;
    }

    const hits: InternalHit[] = [];
    rawHits.forEach((h, i) => {
      if (h.class !== "companion_dependency") return;
      const censusContext = hasCensusEntry ? censusHits![i] : undefined;
      const rawContext =
        typeof censusContext === "string" ? censusContext : typeof h.context === "string" ? h.context : undefined;
      const rawSubject = typeof h.companionSubject === "string" ? h.companionSubject : undefined;

      const context = gate(rawContext, "excerpt");
      const companionSubject = gate(h.companionSubject, "prose");
      if (context === null && companionSubject === null) {
        withheldHitCount++;
        return;
      }
      // M15: tested on the RAW subject, before the "prose" gate truncates it
      // to CONTEXT_MAX_CHARS — a hedge phrase past that cutoff must still be
      // detected, or the row would keep a confident-looking link the
      // evidence itself declines to assert.
      const weakEvidence = rawSubject !== undefined && WEAK_EVIDENCE_RE.test(rawSubject);
      if (typeof h.reasoning === "string" && /spot-verified/i.test(h.reasoning)) spotCheckedCompanionCount++;
      const rawTisk = typeof h.likelyCompanionTisk === "number" ? h.likelyCompanionTisk : null;
      hits.push({
        context,
        companionSubject,
        // Only carry a companion tisk number alongside prose that names one AND
        // is not itself hedged as unresolved — a number with no surviving
        // subject, or one the analyst's own text calls a guess, must not render
        // as a link (batch-015-audit.md B11).
        likelyCompanionTisk: companionSubject !== null && !weakEvidence ? rawTisk : null,
        weakEvidence,
        dupeCount: 1,
        _rawTisk: rawTisk,
        _rawSubject: rawSubject ?? null,
        _rawContextLen: rawContext?.length ?? -1,
      });
    });
    if (hits.length === 0) continue;
    const deduped = dedupeHits(hits);
    dedupedRowCount += deduped.length;
    bills.push({ cislo: b.cislo, hits: deduped });
  }
  if (bills.length === 0) return null;
  bills.sort((a, b) => a.cislo - b.cislo);

  const counts = raw.counts ?? {};
  return {
    bills,
    companionCount: asNum(counts.companion_dependency),
    selfReferenceCount: asNum(counts.self_reference),
    unclearCount: asNum(counts.unclear),
    totalTriaged: asNum(counts.companion_dependency) + asNum(counts.self_reference) + asNum(counts.unclear),
    withheldHitCount,
    spotCheckedCompanionCount,
    dedupedRowCount,
    misalignedDroppedCount,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null,
  };
}
