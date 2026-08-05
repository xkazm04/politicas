// Server-only: the batch-014 bill-dependency census loader for the /zakony
// "Závislosti na doprovodných tiscích" section. The detector scans every bill's
// own cached text for the e-Sbírka drafting placeholder ("zákona č. …/2026 Sb.")
// and classifies each hit deterministically as self_reference (the print citing
// its own later act), companion_dependency (the print's text depends on ANOTHER,
// named or inferred, print reaching the statute book) or unclear (no evidence
// either way — the reviewed default, not a fallback to be minimised away). Only
// companion_dependency is product-relevant here: it is an ENACTMENT-ORDER
// hazard — this bill's text presumes a companion bill has already become law —
// never an ethics claim.
//
// Source artifact (read like bill-summaries-cz.json in getLawData.ts):
// docs/data-analysis/case-law/payloads/batch-014-dependency-triage.json
//
// Every reader-facing string (the quoted context, the companion-subject prose)
// passes the SAME two gates getLawData.ts runs on forensic verdicts — the Czech
// gate (lib/analysis/language-gate.ts) and the law-case pipeline-jargon gate
// (lib/analysis/law-verdict.ts) — before it may render. A hit that fails both
// on every field it carries is withheld, counted, never fabricated around.

import "server-only";
import { cache } from "react";
import { existsSync, readFileSync } from "node:fs";

import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";

const PAYLOAD_FILE = "docs/data-analysis/case-law/payloads/batch-014-dependency-triage.json";

/** A quoted excerpt is a mid-sentence fragment already ~80–150 chars in the
 * artifact; cap it anyway so a future, longer excerpt can't blow out the row. */
const CONTEXT_MAX_CHARS = 220;

export interface DependencyHit {
  /** The quoted placeholder context from the print's own text, shortened, or
   * null when withheld by the Czech/jargon gate. */
  context: string | null;
  /** What this print's text depends on, in prose ("zákon o digitální ekonomice
   * (tisk 69)"), or null when withheld. Always present when likelyCompanionTisk
   * is present — the two are read from the same source field. */
  companionSubject: string | null;
  /** The companion print number the detector inferred, when the evidence names
   * one. The render layer must still confirm this tisk exists in the loaded
   * corpus before linking it — the census and the bill corpus are read from
   * different artifacts and can disagree. */
  likelyCompanionTisk: number | null;
}

export interface DependencyBillView {
  cislo: number;
  hits: DependencyHit[];
}

export interface DependencyData {
  bills: DependencyBillView[]; // bills carrying ≥1 companion_dependency hit
  companionCount: number; // total companion_dependency hits across the corpus (payload counts.companion_dependency)
  selfReferenceCount: number; // payload counts.self_reference — rendered only in the method note
  unclearCount: number; // payload counts.unclear — hits with no evidence either way
  totalTriaged: number; // companionCount + selfReferenceCount + unclearCount
  /** Hits whose every reader-facing field failed the Czech/jargon gate and were
   * dropped from `bills` entirely (not just a blanked field). */
  withheldHitCount: number;
  generatedAt: string | null;
}

interface RawHit {
  context?: unknown;
  class?: unknown;
  companionSubject?: unknown;
  likelyCompanionTisk?: unknown;
}
interface RawBill {
  cislo?: unknown;
  hits?: unknown;
}
interface RawPayload {
  generatedAt?: unknown;
  counts?: { self_reference?: unknown; companion_dependency?: unknown; unclear?: unknown };
  bills?: unknown;
}

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function shorten(s: string): string {
  if (s.length <= CONTEXT_MAX_CHARS) return s;
  const half = Math.floor((CONTEXT_MAX_CHARS - 1) / 2);
  return `${s.slice(0, half).trimEnd()}…${s.slice(-half).trimStart()}`;
}

/** The Czech gate + law-case jargon gate, same contract as getLawData.ts's
 * `readForensic.cz()` — a string that fails either one is withheld, not shown. */
function gate(v: unknown): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const safe = czechCopyOrNull(v);
  if (safe === null || lawJargonIssues(safe).length > 0) return null;
  return shorten(safe);
}

function loadDependencyData(): DependencyData | null {
  try {
    if (!existsSync(PAYLOAD_FILE)) return null;
    const raw = JSON.parse(readFileSync(PAYLOAD_FILE, "utf8")) as RawPayload;
    const rawBills = Array.isArray(raw.bills) ? (raw.bills as RawBill[]) : [];
    if (rawBills.length === 0) return null;

    let withheldHitCount = 0;
    const bills: DependencyBillView[] = [];
    for (const b of rawBills) {
      if (typeof b.cislo !== "number") continue;
      const rawHits = Array.isArray(b.hits) ? (b.hits as RawHit[]) : [];
      const hits: DependencyHit[] = [];
      for (const h of rawHits) {
        if (h.class !== "companion_dependency") continue;
        const context = gate(h.context);
        const companionSubject = gate(h.companionSubject);
        if (context === null && companionSubject === null) {
          withheldHitCount++;
          continue;
        }
        const tisk = typeof h.likelyCompanionTisk === "number" ? h.likelyCompanionTisk : null;
        hits.push({
          context,
          companionSubject,
          // Only carry a companion tisk number alongside the prose that names it —
          // a number with no withheld-but-implied subject would read as a bare guess.
          likelyCompanionTisk: companionSubject !== null ? tisk : null,
        });
      }
      if (hits.length > 0) bills.push({ cislo: b.cislo, hits });
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
      generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null,
    };
  } catch (err) {
    reportLoaderFailure("getDependencyData", err);
    return null;
  }
}

export const getDependencyData = cache(loadDependencyData);
