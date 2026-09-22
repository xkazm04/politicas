// Shared shapes for the "kolize tisků" surface (/zakony/kolize) — what
// getCollisionData.ts derives from the case-③ close-read payloads. Plain module
// (no server imports) so both the server loader and the "use client" page can
// import these; mirrors features/votetrack/themeTypes.ts.

export const COLLISION_CLASSIFICATIONS = ["confirmed-collision", "coordination-risk"] as const;
export type CollisionClassification = (typeof COLLISION_CLASSIFICATIONS)[number];

export interface CollisionEvidence {
  billAExcerpt: string | null;
  billBExcerpt: string | null;
}

export interface CollisionPairView {
  pairId: string;
  /**
   * The PUBLIC sněmovní-tisk print numbers — the same thing `CollisionBillRef.cislo`
   * carries and what `/zakony/<cislo>` is keyed by. NOT the graph's internal
   * `bill:tisk:<id>` suffix. Stated here because the surface labelled these two with
   * „tisk {tiskId}" (the INTERNAL-id message) for months while the excerpt captions
   * two rows below already passed the very same value as `cislo`.
   */
  billA: number;
  billB: number;
  classification: CollisionClassification;
  sharedParagraph: string;
  evidence: CollisionEvidence;
  /** Czech analyst prose, or null when only an English original exists and the language gate
   * withheld it. Never a machine translation, never a partial. */
  reasoning: string | null;
  /** True when a reasoning exists but was withheld for not being Czech — lets the surface say
   * so honestly instead of rendering a blank card. */
  reasoningWithheld: boolean;
  sourceBatch: number; // 1–5 or 8, which batch produced this close-read
  sourceMethod: string; // one-line method note for the SourceNote
  /** ISO timestamp the finding entered the archive — the source payload's own
   * `generatedAt` (for batch-001/002 prior pairs: the deterministic pre-check
   * report that first flagged them, collision-report.json). Null when the
   * artifact carries no parseable date — never invented. Feeds the radar
   * chronology (moonshot 4B). */
  detectedAt: string | null;
}

export interface CollisionBillRef {
  /** The public sněmovní-tisk print number (psp.cz `t=`/`ct=` param) — this is what every
   * close-read payload's billA/billB and every "tisk N" reference in this case's docs means.
   * It is NOT the graph's internal `bill:tisk:<id>` node-id suffix, which is a separate,
   * unrelated internal id (verified: tisk 4's node id is `bill:tisk:43111`, props.cislo = 4). */
  cislo: number;
  title: string | null; // resolved from the graph's bill node label; null if store unavailable
}

export interface CollisionClusterView {
  key: string; // "586/1992§35c"
  lawRef: string; // "586/1992"
  lawTitle: string | null; // resolved from the graph's law node esbirka_title; may be null
  paragraph: string; // representative "§ N" label for the cluster
  classification: CollisionClassification; // strongest classification among the cluster's pairs
  bills: CollisionBillRef[];
  pairs: CollisionPairView[];
}

export interface CollisionData {
  clusters: CollisionClusterView[];
  confirmedPairCount: number;
  coordinationRiskPairCount: number;
  clusterCount: number;
  nWayClusterCount: number; // clusters spanning ≥3 bills
  batchesRun: number; // distinct close-read batches represented here
  /** How many rendered pairs still have no Czech analyst prose, so the surface can disclose the
   * gap instead of quietly showing fewer words. */
  czechPendingCount: number;
  /** Close-read pairs the loader DROPPED as incidental (same §-number, different statute — a
   * data artifact of the deterministic pre-check, not a finding). The rule was always stated
   * on the page; the COUNT was not, so „44 pairs" read as the whole close-read output when it
   * is the surviving part of a larger one. A limit that drops a row has to say how many
   * (the /denik `droppedImplausible` precedent). */
  incidentalPairCount: number;
}
