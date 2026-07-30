// Server-only: the /admin loader. The case loops (money/effort/law —
// docs/case-loops.md) are PAUSED in the manifestation phase; this reads their
// left-behind state so the operator can see progress and drive review without
// digging through the vault by hand. Three source families, each read
// independently and each allowed to fail on its own:
//
//   1. Case ledgers (docs/data-analysis/case-{money,effort,law}/ledger.json +
//      ledger.md / batch-NNN.md) — hand-written by loop drivers, DIFFERENT
//      shape per case (see the per-case builders below). Read straight off
//      disk; these are repo files and the app runs locally.
//   2. Vault files (graph-log.md pass headings, frontier.md per-case open
//      tables) — shared, freeform markdown. Parsing is regex-based
//      best-effort and MUST degrade to null/empty on drift, never throw.
//   3. The live graph (getStore()) — review-pipeline state on `linked_to`
//      edges and `bill` nodes, plus review_audit and graph totals.
//
// Every exported value takes the "degrade to partial, never crash" contract:
// a missing file, an empty table, or an unavailable store yields nulls/zeros
// for that slice only — the rest of the page still renders. Never imported
// into a client component (only `import type` is safe there).

import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { resolveTieClass, reviewTier } from "@/features/money/reviewTypes";
import { getTripwireData } from "./getTripwireData";
import { parsePassLog } from "./loops/loopState";
import type {
  AdminData,
  CaseId,
  ForensicReviewSummary,
  ForensicVerdictSummary,
  GraphTotals,
  LoopCaseProgress,
  MoneyLeadSummary,
  ReviewAuditSummary,
  ReviewHubData,
  SystemState,
  TieReviewSummary,
  VaultHeads,
  VaultPassEntry,
} from "./adminTypes";

const ROOT = process.cwd();
const VAULT = "docs/data-analysis";

/** hardcode-and-flip: the loops are paused for the manifestation phase. Flip
 *  this (and the label) when a case loop resumes. Exported for the loop
 *  mission-control loader (loops/getLoopState.ts) — one flag, one truth. */
export const LOOPS_PAUSED = true;
export const LOOPS_PAUSED_LABEL = "loopy pozastaveny — manifestační fáze";

// ── generic disk helpers ─────────────────────────────────────────────────

function readTextSafe(relPath: string): string | null {
  try {
    const p = join(ROOT, relPath);
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf8");
  } catch (err) {
    reportLoaderFailure(`getAdminData.readTextSafe:${relPath}`, err);
    return null;
  }
}

function readJsonSafe<T>(relPath: string): T | null {
  const raw = readTextSafe(relPath);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    reportLoaderFailure(`getAdminData.readJsonSafe:${relPath}`, err);
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pct(processed: number | null, total: number | null): number | null {
  if (processed == null || total == null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 1000) / 10));
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Best-effort "what happened most recently" line from a batch/steering
 *  markdown file: the body of the LAST heading section (`##`–`####`, so a
 *  file whose batch entries are `###` subheadings under one `## Batch log`
 *  parent — case-effort's shape — still lands on the latest BATCH, not the
 *  parent's own intro text), first paragraph. Formats drift across cases
 *  (money/effort/law) — this is intentionally loose, never a strict parser. */
function extractLatestSection(md: string, maxLen = 320): string | null {
  const heads = [...md.matchAll(/^#{2,4}\s+.*$/gm)];
  if (heads.length === 0) return null;
  const last = heads[heads.length - 1];
  const start = (last.index ?? 0) + last[0].length;
  const body = md.slice(start).trim();
  if (!body) return null;
  // Drop markdown table rows / bare bullet markers, keep prose.
  const firstParagraph = body.split(/\n\s*\n/)[0] ?? body;
  return truncate(firstParagraph.replace(/^[-*]\s*/gm, ""), maxLen);
}

// ── frontier.md: per-case open-item counts (best-effort table scan) ───────

function parseFrontierOpenCounts(text: string): Partial<Record<CaseId, number>> {
  const counts: Partial<Record<CaseId, number>> = {};
  let current: CaseId | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      const t = heading[1].toLowerCase();
      current = t.includes("money") ? "money" : t.includes("effort") ? "effort" : t.includes("law") ? "law" : null;
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*-+/.test(trimmed)) continue; // separator row
    const cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length === 0) continue;
    if (/^id$/i.test(cells[0])) continue; // header row
    const status = cells[cells.length - 1].toLowerCase();
    const isOpen = status.includes("open") && !/✅|done|retired|closed/.test(status);
    if (isOpen) counts[current] = (counts[current] ?? 0) + 1;
  }
  return counts;
}

function loadFrontierOpenCounts(): Partial<Record<CaseId, number>> {
  try {
    const text = readTextSafe(`${VAULT}/frontier.md`);
    if (!text) return {};
    return parseFrontierOpenCounts(text);
  } catch {
    return {};
  }
}

// ── graph-log.md: shared pass sequence ─────────────────────────────────────

function parseVaultHeads(text: string): VaultHeads {
  // Jeden parser pass hlaviček pro celou /admin plochu — velín smyček (6E)
  // čte tytéž hlavičky přes parsePassLog, žádná druhá regex pravda.
  const entries: VaultPassEntry[] = parsePassLog(text);
  const lastPass = entries.length ? entries[entries.length - 1].pass : null;
  return { lastPass, recentPasses: entries.slice(-3).reverse() };
}

function loadVaultHeads(): VaultHeads {
  try {
    const text = readTextSafe(`${VAULT}/graph-log.md`);
    if (!text) return { lastPass: null, recentPasses: [] };
    return parseVaultHeads(text);
  } catch {
    return { lastPass: null, recentPasses: [] };
  }
}

// ── per-case loop progress (bespoke — the three ledger.json shapes diverge) ─

function emptyProgress(id: CaseId, labelCs: string, source: string): LoopCaseProgress {
  return {
    case: id,
    labelCs,
    batchesCompleted: null,
    unitsProcessed: null,
    unitsTotal: null,
    progressPct: null,
    latestHeadline: null,
    openFrontier: null,
    source,
  };
}

function loadMoneyProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-money/ledger.json";
  try {
    const ledger = readJsonSafe<{ summary?: Record<string, unknown> }>(`${VAULT}/case-money/ledger.json`);
    if (!ledger?.summary) return emptyProgress("money", "Peníze (FollowTheMoney)", source);
    const summary = ledger.summary;
    const batchNums = Object.keys(summary)
      .map((k) => k.match(/^batch(\d+)$/))
      .filter((m): m is RegExpMatchArray => m != null)
      .map((m) => Number(m[1]));
    const batchesCompleted = batchNums.length ? Math.max(...batchNums) : null;
    const lastBatch = batchesCompleted != null ? (summary[`batch${batchesCompleted}`] as Record<string, unknown> | undefined) : undefined;
    const counts = (summary.counts ?? {}) as Record<string, unknown>;
    const unitsTotal = numOrNull(counts.tiesEnumerated);
    // The 211/211 population was fully reconciled by batch 2 (see ledger.md);
    // later batches re-rank/build rather than process new units, so
    // "processed" tracks the same population once reconciliation completed.
    const unitsProcessed = unitsTotal;
    const headline = typeof lastBatch?.note === "string" ? truncate(lastBatch.note, 320) : null;
    return {
      case: "money",
      labelCs: "Peníze (FollowTheMoney)",
      batchesCompleted,
      unitsProcessed,
      unitsTotal,
      progressPct: pct(unitsProcessed, unitsTotal),
      latestHeadline: headline,
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("money", "Peníze (FollowTheMoney)", source);
  }
}

function loadEffortProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-effort/ledger.json + ledger.md";
  try {
    const ledger = readJsonSafe<{ batch?: number; population?: number; units?: Array<{ stage?: string }> }>(
      `${VAULT}/case-effort/ledger.json`,
    );
    if (!ledger) return emptyProgress("effort", "Docházka (kontribuční index)", source);
    const unitsTotal = numOrNull(ledger.population);
    const unitsProcessed = Array.isArray(ledger.units)
      ? ledger.units.filter((u) => u.stage && u.stage !== "pending").length
      : null;
    const md = readTextSafe(`${VAULT}/case-effort/ledger.md`);
    const headline = md ? extractLatestSection(md) : null;
    return {
      case: "effort",
      labelCs: "Docházka (kontribuční index)",
      batchesCompleted: numOrNull(ledger.batch),
      unitsProcessed,
      unitsTotal,
      progressPct: pct(unitsProcessed, unitsTotal),
      latestHeadline: headline,
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("effort", "Docházka (kontribuční index)", source);
  }
}

function loadLawProgress(): LoopCaseProgress {
  const source = "docs/data-analysis/case-law/ledger.json";
  try {
    const ledger = readJsonSafe<{ totals?: Record<string, unknown> } & Record<string, unknown>>(`${VAULT}/case-law/ledger.json`);
    const caseDir = join(ROOT, `${VAULT}/case-law`);
    let batchesCompleted: number | null = null;
    try {
      const files = existsSync(caseDir) ? readdirSync(caseDir) : [];
      const nums = files
        .map((f) => f.match(/^batch-(\d+)\.md$/))
        .filter((m): m is RegExpMatchArray => m != null)
        .map((m) => Number(m[1]));
      batchesCompleted = nums.length ? Math.max(...nums) : null;
    } catch (err) {
      // batch file listing is a nice-to-have; ledger.json numbers still stand.
      console.warn("[getAdminData] law batch-file listing failed", err);
    }
    if (!ledger?.totals) return { ...emptyProgress("law", "Zákony (LawWatch)", source), batchesCompleted };
    const totals = ledger.totals;
    const unitsTotal = numOrNull(totals.bills);
    const existingForensic = numOrNull(totals.existingForensic) ?? 0;
    const batch003 = numOrNull(totals.batch003NewVerdicts) ?? 0;
    const batch004 = numOrNull(totals.batch004NewVerdicts) ?? 0;
    const unitsProcessed = existingForensic + batch003 + batch004; // forensic-reviewed bills
    // headline: the highest-numbered `batchNNNNote` — lives at the ledger ROOT
    // (not inside `totals`, unlike everything else here — case-law's ledger.json
    // shape quirk). Keys are zero-padded ("batch004Note") — sort by the parsed
    // number but look up by the ORIGINAL key string; reconstructing an
    // unpadded key ("batch4Note") silently misses every real key.
    const noteEntries = Object.keys(ledger)
      .map((k) => ({ key: k, m: k.match(/^batch(\d+)Note$/) }))
      .filter((e): e is { key: string; m: RegExpMatchArray } => e.m != null)
      .sort((a, b) => Number(b.m[1]) - Number(a.m[1]));
    const headline = noteEntries.length ? truncate(String(ledger[noteEntries[0].key]), 320) : null;
    return {
      case: "law",
      labelCs: "Zákony (LawWatch)",
      batchesCompleted,
      unitsProcessed,
      unitsTotal,
      progressPct: pct(unitsProcessed, unitsTotal),
      latestHeadline: headline,
      openFrontier: null,
      source,
    };
  } catch {
    return emptyProgress("law", "Zákony (LawWatch)", source);
  }
}

/** Exported for the loop mission-control loader (loops/getLoopState.ts) — the
 *  three bespoke ledger parsers stay the single source of case progress. */
export function loadLoopProgress(): LoopCaseProgress[] {
  const openFrontier = loadFrontierOpenCounts();
  return [loadMoneyProgress(), loadEffortProgress(), loadLawProgress()].map((p) => ({
    ...p,
    openFrontier: openFrontier[p.case] ?? p.openFrontier,
  }));
}

// ── money-lead payloads (Q-money-5/6 class: web leads, gated, not yet an edge) ─

function loadMoneyLeads(): MoneyLeadSummary[] {
  try {
    const dir = join(ROOT, `${VAULT}/case-money/payloads`);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => /^batch-\d+-lead-.+\.json$/.test(f));
    const leads: MoneyLeadSummary[] = [];
    for (const f of files) {
      const raw = readJsonSafe<Record<string, unknown>>(`${VAULT}/case-money/payloads/${f}`);
      if (!raw) continue;
      const subject = (raw.subject ?? {}) as Record<string, unknown>;
      const annotation = (raw.proposedAnnotation ?? {}) as Record<string, unknown>;
      leads.push({
        leadId: typeof raw.leadId === "string" ? raw.leadId : f,
        subjectName: typeof subject.name === "string" ? subject.name : "?",
        targetNode: typeof annotation.targetNode === "string" ? annotation.targetNode : null,
        confidence: typeof raw.confidence === "string" ? raw.confidence : null,
        signalScore: numOrNull(raw.signalScore),
        note: typeof annotation.note === "string" ? truncate(annotation.note, 280) : null,
      });
    }
    return leads.sort((a, b) => a.leadId.localeCompare(b.leadId));
  } catch (err) {
    reportLoaderFailure("getAdminData.loadMoneyLeads", err);
    return [];
  }
}

// ── live graph: review pipeline + totals ───────────────────────────────────

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function loadReviewHub(): Promise<ReviewHubData> {
  const leads = loadMoneyLeads();
  const empty: ReviewHubData = { ties: null, forensic: null, leads, audit: null };
  try {
    const store = await getStore();
    if (!store) return empty;

    // ties: every linked_to edge, by review_state + review_tier (reuses the
    // exact classifyTie/reviewTier helpers the /penize/kontrola console uses,
    // so the tier split here matches the review queue's own order).
    let ties: TieReviewSummary | null = null;
    try {
      const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
      const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
      if (linked.length > 0) {
        const companyById = new Map(companies.map((c) => [c.id, c]));
        let verified = 0;
        let pending = 0;
        let rejected = 0;
        const tiers: [number, number, number, number] = [0, 0, 0, 0];
        let unresolvedTotal = 0;
        for (const e of linked) {
          // Mirror the real review console's contract (getVerificationData.ts):
          // an unresolved company is dropped, never guessed at. This dashboard
          // exists to mirror /penize/kontrola's queue — fabricating a "steward"
          // classification for an edge the console itself would drop let this
          // page's totals silently diverge from the queue it's meant to monitor.
          const comp = companyById.get(e.dst);
          if (!comp) {
            unresolvedTotal++;
            continue;
          }

          const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
          if (rawState === "verified") verified++;
          else if (rawState === "rejected") rejected++;
          else pending++;

          const role = String(e.props?.role ?? "");
          // Stored class wins over the heuristic, as on /penize (resolveTieClass) — an
          // admin tier split computed from a guess would disagree with the console it
          // is meant to describe.
          const tieClass = resolveTieClass(e.props?.tie_class, role, comp.label).tieClass;
          const corroboration = (e.props?.corroboration as "registry-confirmed" | "registry-unconfirmed" | "conflicting" | null | undefined) ?? null;
          tiers[reviewTier({ tieClass, corroboration })]++;
        }
        if (unresolvedTotal > 0) {
          console.warn(`[getAdminData] dropped ${unresolvedTotal} linked_to edge(s) with unresolved company from tie totals`);
        }
        ties = {
          total: linked.length - unresolvedTotal,
          verified,
          pending,
          rejected,
          tiers: { tier0: tiers[0], tier1: tiers[1], tier2: tiers[2], tier3: tiers[3] },
          kontrolaHref: "/penize/kontrola",
        };
      }
    } catch {
      ties = null;
    }

    // forensic: bill nodes carrying a gated forensic_* verdict.
    let forensic: ForensicReviewSummary | null = null;
    try {
      const bills = await store.listKgNodes({ kind: "bill", limit: 100_000 });
      const items: ForensicVerdictSummary[] = [];
      const bySeverity: Record<string, number> = {};
      for (const n of bills) {
        const p = (n.props ?? {}) as Record<string, unknown>;
        const state = asStr(p.forensic_review_state);
        const severity = asStr(p.forensic_severity);
        if (!state && !severity) continue;
        const sev = severity ?? "low";
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
        items.push({
          tiskId: Number(n.id.replace(/^bill:tisk:/, "")) || 0,
          cislo: typeof p.cislo === "number" ? p.cislo : null,
          title: n.label,
          severity: sev,
          reviewState: state ?? "pending_review",
        });
      }
      if (items.length > 0) {
        // A binary high/non-high partition only guaranteed "high" floats up —
        // "medium" and "low" kept their original iteration order relative to
        // each other, so a medium-severity item could sit behind several lows
        // in the capped 8-item preview an operator actually sees.
        const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
        items.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
        forensic = { total: items.length, bySeverity, items, zakonyHref: "/zakony" };
      }
    } catch {
      forensic = null;
    }

    // review_audit: decisions actually made through the human gate.
    let audit: ReviewAuditSummary | null = null;
    try {
      const rows = await store.listReviewAudit({ limit: 10_000 });
      if (rows.length > 0) {
        const byDecision: Record<string, number> = {};
        const byReviewer: Record<string, number> = {};
        for (const r of rows) {
          byDecision[r.decision] = (byDecision[r.decision] ?? 0) + 1;
          byReviewer[r.reviewer] = (byReviewer[r.reviewer] ?? 0) + 1;
        }
        audit = {
          totalDecisions: rows.length,
          byDecision,
          byReviewer,
          lastDecidedAt: rows[0]?.decidedAt ?? null,
        };
      }
    } catch {
      audit = null;
    }

    return { ties, forensic, leads, audit };
  } catch {
    return empty;
  }
}

// ── live graph: system totals ──────────────────────────────────────────────

async function loadSystemState(vaultHeads: VaultHeads): Promise<SystemState> {
  const base: SystemState = {
    graph: null,
    lastPass: vaultHeads.lastPass,
    loopsPaused: LOOPS_PAUSED,
    loopsPausedLabel: LOOPS_PAUSED_LABEL,
  };
  try {
    const store = await getStore();
    if (!store) return base;
    const [nodes, edges, edgesByRel] = await Promise.all([
      store.countKgNodes(),
      store.countKgEdges(),
      store.countKgEdgesByRel(),
    ]);
    let nodesByKind: Record<string, number> = {};
    try {
      const allNodes = await store.listKgNodes({ limit: 100_000 });
      const byKind: Record<string, number> = {};
      for (const n of allNodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
      nodesByKind = byKind;
    } catch {
      nodesByKind = {};
    }
    const graph: GraphTotals = { nodes, edges, edgesByRel, nodesByKind };
    return { ...base, graph };
  } catch {
    return base;
  }
}

// ── entry point ──────────────────────────────────────────────────────────

export async function getAdminData(): Promise<AdminData> {
  const loopProgress = loadLoopProgress();
  const vaultHeads = loadVaultHeads();
  // Hlídky grafu sdílejí "degrade to partial, never crash": vlastní loader
  // vrací null (a hlásí přes reportLoaderFailure), zbytek stránky žije dál.
  const [reviewHub, systemState, tripwires] = await Promise.all([
    loadReviewHub(),
    loadSystemState(vaultHeads),
    getTripwireData(),
  ]);
  return { loopProgress, vaultHeads, reviewHub, tripwires, systemState };
}
