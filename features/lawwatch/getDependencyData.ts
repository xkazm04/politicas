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
import { buildDependencyView, type RawTriagePayload } from "./buildDependencyView";
export type { DependencyHit, DependencyBillView, DependencyData } from "./buildDependencyView";

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
 * on the placeholder, prose fields are just length-capped. Exported (in
 * addition to being passed into `buildDependencyView`) so a test can exercise
 * the REAL gate/truncation pipeline directly — batch-016-audit.md M13 found
 * the dedup representative-row test previously only passed via a bypassing
 * `passthroughGate` stub, which could not have caught the truncation-tie bug
 * it was meant to guard. */
export function gate(v: unknown, shape: "excerpt" | "prose"): string | null {
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

function loadDependencyData(): ReturnType<typeof buildDependencyView> {
  try {
    if (!existsSync(TRIAGE_FILE)) return null;
    const raw = JSON.parse(readFileSync(TRIAGE_FILE, "utf8")) as RawTriagePayload;

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

    return buildDependencyView(raw, censusByCislo, gate);
  } catch (err) {
    reportLoaderFailure("getDependencyData", err);
    return null;
  }
}

export const getDependencyData = cache(loadDependencyData);
