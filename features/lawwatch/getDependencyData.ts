// Server-only: the batch-014 bill-dependency census loader for the /zakony
// "Závislosti na doprovodných tiscích" section. The detector scans every bill's
// own cached text for the e-Sbírka drafting placeholder ("zákona č. …/2026 Sb.",
// the drafter's stand-in for a companion act not yet promulgated) and classifies
// each hit deterministically as self_reference (the print citing its own later
// act), companion_dependency (the print's text depends on ANOTHER, named or
// inferred, print reaching the statute book) or unclear (no evidence either way
// — the reviewed default, not a fallback to be minimised away). Only
// companion_dependency is product-relevant here: it is an ENACTMENT-ORDER
// hazard — this bill's text presumes a companion bill has already become law —
// never an ethics claim, and never more than a LEAD: the census payload's own
// method string is explicit that "a hit is a lead for close reading, not a
// finding" — the surface must carry that qualifier on every rendered row.
//
// Two source artifacts, read positionally against each other (same read
// pattern as bill-summaries-cz.json in getLawData.ts):
//   - batch-014-dependency-triage.json  — the classification (class,
//     companionSubject, likelyCompanionTisk) per hit, in per-bill hit order.
//   - batch-014-dependency-census.json  — the SAME per-bill hits, in the same
//     order, carrying the fuller (231–277 char) quoted context the triage
//     payload's own 120-char prefix truncates the placeholder away from
//     (batch-014-audit.md:470; confirmed 16/18 rendered triage excerpts did
//     not contain the placeholder they exist to show). The two payloads are
//     verified index-aligned per bill at load time — a bill whose hit counts
//     disagree between them is dropped rather than mis-paired.
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

const TRIAGE_FILE = "docs/data-analysis/case-law/payloads/batch-014-dependency-triage.json";
const CENSUS_FILE = "docs/data-analysis/case-law/payloads/batch-014-dependency-census.json";

/** The excerpt window rendered around the placeholder match. Large enough to
 * carry the surrounding novelizing sentence, small enough to stay a quote. */
const CONTEXT_MAX_CHARS = 220;

/** The e-Sbírka drafting placeholder itself — "…/2026 Sb." (any year). This is
 * the fact the excerpt exists to show, so the excerpt window is centered on it,
 * never on the string start. The corpus renders it two ways — the single
 * ellipsis glyph (…) and a literal three-dot run (...) — both must match, or
 * hits like tisk 206/58 (which use "...") would silently fall back to the
 * unanchored, start-of-string cut this fix exists to remove. */
const PLACEHOLDER_RE = /(?:…|\.\.\.)\s*\/\s*\d{4}\s*Sb\b/;

/** The triage analyst's own hedge phrasing for a companion call it does not
 * consider evidenced ("MOŽNÁ … tisk 62 …, ALE BEZ EXPLICITNÍ TEXTOVÉ VAZBY" on
 * tisk 250→62 — batch-015-audit.md B11). A hit carrying this phrase is a guess
 * about which print, not a read of one; suppressing the link is the same
 * discipline already applied to a likelyCompanionTisk absent from the corpus,
 * just triggered by the evidence text instead of by corpus membership. */
const WEAK_EVIDENCE_RE = /bez\s+explicitn[ěí]\s+textov[ěé]\s+vazby/i;

export interface DependencyHit {
  /** The quoted placeholder excerpt from the print's own text, centered on the
   * placeholder match and shortened, or null when withheld by the Czech/jargon
   * gate, or when no census counterpart could be matched for this hit. */
  context: string | null;
  /** What this print's text depends on, in prose ("zákon o digitální ekonomice
   * (tisk 69)"), or null when withheld. */
  companionSubject: string | null;
  /** The companion print number the detector inferred, when the evidence names
   * one AND the evidence is not itself hedged as unresolved (see
   * WEAK_EVIDENCE_RE). The render layer must still confirm this tisk exists in
   * the loaded corpus before linking it — the census and the bill corpus are
   * read from different artifacts and can disagree. */
  likelyCompanionTisk: number | null;
  /** True when the triage evidence itself says the companion call is a guess
   * ("možná …, ale bez explicitní textové vazby") — the render layer must not
   * link `likelyCompanionTisk` even if it resolves in the corpus, and must
   * keep the hedge visible rather than let a bold link outrun the evidence. */
  weakEvidence: boolean;
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
  /** How many of `companionCount`'s hits carry the triage analyst's own
   * "Spot-verified" mark in the internal `reasoning` field (never rendered
   * itself — only this count is; batch-014-audit.md §"Spot-verified" is the
   * source). The section used to say classification "was manually audited"
   * without qualification; measured, only 1 of 18 companion-dependency hits
   * (14 of all 67 triaged hits) actually carry that mark, so the honesty
   * block cites the real scope instead of the blanket claim. */
  spotCheckedCompanionCount: number;
  generatedAt: string | null;
}

interface RawHit {
  context?: unknown;
  class?: unknown;
  companionSubject?: unknown;
  likelyCompanionTisk?: unknown;
  reasoning?: unknown;
}
interface RawBill {
  cislo?: unknown;
  hits?: unknown;
}
interface RawTriagePayload {
  generatedAt?: unknown;
  counts?: { self_reference?: unknown; companion_dependency?: unknown; unclear?: unknown };
  bills?: unknown;
}
interface RawCensusHit {
  context?: unknown;
}
interface RawCensusRow {
  cislo?: unknown;
  hits?: unknown;
}
interface RawCensusPayload {
  rows?: unknown;
}

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Cut a window of at most CONTEXT_MAX_CHARS around the placeholder match so
 * the rendered quote actually contains the fact it is cited for, instead of an
 * arbitrary prefix. Falls back to a start-anchored cut (with the same ellipsis
 * marking) only when the placeholder genuinely is not in this string. */
function centeredExcerpt(s: string): string {
  const m = PLACEHOLDER_RE.exec(s);
  const max = CONTEXT_MAX_CHARS;
  if (!m) {
    if (s.length <= max) return s;
    return `${s.slice(0, max).trimEnd()}…`;
  }
  if (s.length <= max) return s;
  const mid = m.index + Math.floor(m[0].length / 2);
  const half = Math.floor(max / 2);
  let start = Math.max(0, mid - half);
  const end = Math.min(s.length, start + max);
  start = Math.max(0, end - max);
  let out = s.slice(start, end);
  if (start > 0) out = `…${out.trimStart()}`;
  if (end < s.length) out = `${out.trimEnd()}…`;
  return out;
}

/** The Czech gate + law-case jargon gate, same contract as getLawData.ts's
 * `readForensic.cz()` — a string that fails either one is withheld, not shown.
 * `shape` decides how the survivor is trimmed: the quoted excerpt is centered
 * on the placeholder, prose fields are just length-capped. */
function gate(v: unknown, shape: "excerpt" | "prose"): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const safe = czechCopyOrNull(v);
  if (safe === null || lawJargonIssues(safe).length > 0) return null;
  if (shape === "excerpt") return centeredExcerpt(safe);
  return safe.length <= CONTEXT_MAX_CHARS ? safe : `${safe.slice(0, CONTEXT_MAX_CHARS).trimEnd()}…`;
}

/** bill cislo → census hit contexts, in the SAME per-bill order as the triage
 * payload's own hits (verified 1:1 at load time below). */
function loadCensusContexts(): Map<number, (string | undefined)[]> {
  const out = new Map<number, (string | undefined)[]>();
  if (!existsSync(CENSUS_FILE)) return out;
  const raw = JSON.parse(readFileSync(CENSUS_FILE, "utf8")) as RawCensusPayload;
  const rows = Array.isArray(raw.rows) ? (raw.rows as RawCensusRow[]) : [];
  for (const r of rows) {
    if (typeof r.cislo !== "number") continue;
    const hits = Array.isArray(r.hits) ? (r.hits as RawCensusHit[]) : [];
    out.set(
      r.cislo,
      hits.map((h) => (typeof h.context === "string" ? h.context : undefined)),
    );
  }
  return out;
}

function loadDependencyData(): DependencyData | null {
  try {
    if (!existsSync(TRIAGE_FILE)) return null;
    const raw = JSON.parse(readFileSync(TRIAGE_FILE, "utf8")) as RawTriagePayload;
    const rawBills = Array.isArray(raw.bills) ? (raw.bills as RawBill[]) : [];
    if (rawBills.length === 0) return null;

    let censusByCislo: Map<number, (string | undefined)[]>;
    try {
      censusByCislo = loadCensusContexts();
    } catch (err) {
      // The census file is a richer SOURCE for the same hits the triage payload
      // already classifies — its absence degrades excerpt quality (fallback to
      // the triage payload's own, shorter context) but must not blank the
      // whole section, which the triage file alone can still render.
      reportLoaderFailure("getDependencyData.census", err);
      censusByCislo = new Map();
    }

    let withheldHitCount = 0;
    let spotCheckedCompanionCount = 0;
    const bills: DependencyBillView[] = [];
    for (const b of rawBills) {
      if (typeof b.cislo !== "number") continue;
      const rawHits = Array.isArray(b.hits) ? (b.hits as RawHit[]) : [];
      const censusHits = censusByCislo.get(b.cislo);
      // Positional alignment must hold hit-for-hit (not just in aggregate) — a
      // count mismatch means this bill's triage/census rows cannot be paired
      // by index without risking a WRONG excerpt attached to a hit's claim, so
      // this bill falls back to the triage payload's own (shorter, prefix-cut)
      // context rather than mispair.
      const aligned = censusHits != null && censusHits.length === rawHits.length;

      const hits: DependencyHit[] = [];
      rawHits.forEach((h, i) => {
        if (h.class !== "companion_dependency") return;
        const censusContext = aligned ? censusHits[i] : undefined;
        const context = gate(censusContext ?? h.context, "excerpt");
        const companionSubject = gate(h.companionSubject, "prose");
        if (context === null && companionSubject === null) {
          withheldHitCount++;
          return;
        }
        const weakEvidence = companionSubject !== null && WEAK_EVIDENCE_RE.test(companionSubject);
        // `reasoning` is an internal analyst field — never rendered — read only to
        // count how many hits it marks as independently spot-checked (M16).
        if (typeof h.reasoning === "string" && /spot-verified/i.test(h.reasoning)) spotCheckedCompanionCount++;
        const tisk = typeof h.likelyCompanionTisk === "number" ? h.likelyCompanionTisk : null;
        hits.push({
          context,
          companionSubject,
          // Only carry a companion tisk number alongside prose that names one AND
          // is not itself hedged as unresolved — a number with no surviving
          // subject, or one the analyst's own text calls a guess, must not render
          // as a link (batch-015-audit.md B11).
          likelyCompanionTisk: companionSubject !== null && !weakEvidence ? tisk : null,
          weakEvidence,
        });
      });
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
      spotCheckedCompanionCount,
      generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null,
    };
  } catch (err) {
    reportLoaderFailure("getDependencyData", err);
    return null;
  }
}

export const getDependencyData = cache(loadDependencyData);
