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

export interface ReviewHubData {
  ties: TieReviewSummary | null;
  forensic: ForensicReviewSummary | null;
  leads: MoneyLeadSummary[];
  audit: ReviewAuditSummary | null;
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
  loopsPaused: boolean;
  loopsPausedLabel: string;
}

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
