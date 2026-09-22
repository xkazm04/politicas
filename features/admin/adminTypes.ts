// Plain module (no server imports) — shared shapes for /admin, the operator's
// monitoring surface over the paused case-loop system (docs/case-loops.md).
// Both the server loader (getAdminData.ts) and the "use client" page import
// these. Every number here is read-only and best-effort: the case ledgers and
// vault files are hand-maintained markdown/JSON with drifting shapes across
// money/effort/law, so every field is nullable and the page must render
// whatever landed, never crash on what didn't (see getAdminData.ts headers).

export type CaseId = "money" | "effort" | "law";

export interface LoopCaseProgress {
  case: CaseId;
  labelCs: string;
  /** Batches run so far for this case loop, or null if the ledger couldn't be read. */
  batchesCompleted: number | null;
  unitsProcessed: number | null;
  unitsTotal: number | null;
  /** 0–100, derived from processed/total; null when either side is unknown. */
  progressPct: number | null;
  /** Česky, co se vlastně měřilo — a co se NEZMĚŘILO. Případ, jehož žurnál si
   *  o postupu protiřečí, tu přizná „bez měřitelného postupu“ místo lišty;
   *  přeskočené (nečitelné) bloky žurnálu se počítají a jmenují. */
  progressNoteCs: string | null;
  /** One-line summary of the most recent batch, pulled from the ledger/batch note. */
  latestHeadline: string | null;
  /** Open frontier.md items scoped to this case (best-effort table parse). */
  openFrontier: number | null;
  /** Files this case's numbers were read from — for the SourceNote. */
  source: string;
}

export interface VaultPassEntry {
  pass: number;
  track: string;
  title: string;
  date: string;
}

export interface VaultHeads {
  lastPass: number | null;
  recentPasses: VaultPassEntry[];
}

export interface ReviewTierCounts {
  tier0: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

export interface TieReviewSummary {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
  tiers: ReviewTierCounts;
  kontrolaHref: string;
}

export interface ForensicVerdictSummary {
  tiskId: number;
  cislo: number | null;
  title: string;
  severity: string;
  reviewState: string;
}

export interface ForensicReviewSummary {
  total: number;
  bySeverity: Record<string, number>;
  items: ForensicVerdictSummary[];
  zakonyHref: string;
}

export interface MoneyLeadSummary {
  leadId: string;
  subjectName: string;
  targetNode: string | null;
  confidence: string | null;
  signalScore: number | null;
  note: string | null;
}

export interface ReviewAuditSummary {
  totalDecisions: number;
  byDecision: Record<string, number>;
  byReviewer: Record<string, number>;
  lastDecidedAt: string | null;
}

/**
 * ONE claim kind's coverage through the review door (G2, deck #5).
 *
 * Every field is a COUNT. There is deliberately no rate anywhere in this shape:
 * „14 % gated" is the number that hides how big the population is, and the whole
 * finding behind this board is that three of these kinds had a population of
 * hundreds and a decided count of zero because no writer existed.
 */
export interface ReviewKindCoverage {
  kind: string;
  /** Claims of this kind that exist AT ALL — the denominator. */
  total: number;
  /** Claims whose stored state says a human decided (verified or rejected). */
  decided: number;
  /** Claims still waiting: machine, pending_review, or no state at all. */
  pending: number;
  /** Rows in `review_audit` for this kind. May exceed `decided`: a claim can be
   *  decided, reversed and decided again, and every step is its own row. */
  auditRows: number;
  /**
   * False for a kind the writer cannot yet serve (`tripwire`, `lead`). The board
   * SAYS so instead of printing „0 decided" beside the others, because those two
   * zeroes mean opposite things: one is a queue nobody has worked, the other is
   * a queue that cannot be worked.
   */
  hasWriter: boolean;
}

export interface ReviewHubData {
  ties: TieReviewSummary | null;
  forensic: ForensicReviewSummary | null;
  leads: MoneyLeadSummary[];
  audit: ReviewAuditSummary | null;
  /** Per claim kind: decided / pending / total. Empty only when the store is unreadable. */
  coverage: ReviewKindCoverage[];
}

export interface GraphTotals {
  nodes: number;
  edges: number;
  edgesByRel: Record<string, number>;
  nodesByKind: Record<string, number>;
}

export interface SystemState {
  graph: GraphTotals | null;
  lastPass: number | null;
  /** Běh · pauza · nečitelný stav — ODVOZENO ze STATUS řádku docs/case-loops.md
   *  (parseLoopsStatus), nikdy z konstanty v kódu. */
  loopsRunState: LoopsRunState;
  /** Česká věta o stavu i jeho prameni (LoopsStatusFact.labelCs). */
  loopsStatusLabel: string;
  /** Dokument, ze kterého se stav přečetl — vypisuje se čtenáři. */
  loopsStatusSource: string;
  /**
   * [G5] Degradace na hranici loaderů za posledních 24 h.
   *
   * `null` znamená, že žurnál NEEXISTUJE — tedy „nikdo se nedíval", ne „nic se
   * nestalo". Ta dvě tvrzení jsou opačná a nesmějí sdílet jednu kontrolku:
   * `reportLoaderFailure` má 121 volání a jeho dva starší odběry neodpovídají
   * na nic zpětně (odrolovaná konzole, Sentry bez DSN).
   */
  loaderDegradations: LoaderDegradationSummary | null;
}

import type { LoaderDegradationSummary } from "@/lib/db/loaderFailureLog";
import type { LoopsRunState } from "./loops/loopState";
import type { TripwireData } from "@/lib/analysis/tripwires";

export interface AdminData {
  loopProgress: LoopCaseProgress[];
  vaultHeads: VaultHeads;
  reviewHub: ReviewHubData;
  /** Hlídky grafu (lib/analysis/tripwires.ts) — odvozené při čtení, nic se
   *  nezapisuje; null = peněžní vrstva grafu není k dispozici. */
  tripwires: TripwireData | null;
  systemState: SystemState;
}
