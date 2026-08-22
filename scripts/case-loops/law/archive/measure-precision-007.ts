/* Case ③ Law loop — batch-007: full precision measurement on ALL regenerated `amends`
 * edges (docs/data-analysis/case-law/payloads/batch-007-amends-regen.json), reported as a metric
 * with its method stated, not a spot-check.
 *
 * Method (the SAME proxy the batch-005 Opus audit used pre-remediation, per batch-005.md §6 item
 * 2): does the edge's cited "č. N/RRRR Sb." statute reference appear ANYWHERE in the bill's
 * cached full text (.data/law-collision-cache/tisk-<cislo>/*.txt — all cached from prior batches,
 * no new fetch) within ~2500 chars of an amending-verb marker (`se mění|se ruší|se vkládá|se
 * nahrazuje|zní:`)? If yes → HIGH-CONFIDENCE (amending context present). If the ref string never
 * appears at all in the cached text → UNRESOLVABLE-BY-PROXY (can't check — logged separately, not
 * counted as a failure, since some refs come from the bill TITLE only and the title itself is not
 * in the body cache). If the ref appears but with NO amending-verb marker within the window on ANY
 * occurrence → LOW-CONFIDENCE (the proxy's positive flag for a possible footnote/lineage-citation/
 * explanatory-memo false positive).
 *
 * Reported per `source` (census_full vs title_fallback) — the two are structurally different risk
 * classes: census_full citations were extracted directly from bill BODY text (footnote/lineage
 * risk lives here, per D1); title_fallback citations come from the bill's own TITLE prop
 * (`amended_laws`), which by Czech legislative-drafting convention IS the amending clause itself
 * ("zákon, kterým se mění zákon č. X/Y Sb...") — so the proxy is checked for both, but a
 * title_fallback low-confidence result is a weaker signal (the title's own wording usually
 * satisfies the verb check trivially; a miss there is more likely a body-cache coverage gap than a
 * real precision defect).
 *
 *   npx tsx scripts/case-loops/law/measure-precision-006.ts
 * → docs/data-analysis/case-law/payloads/batch-007-precision-measurement.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAYLOAD = "docs/data-analysis/case-law/payloads/batch-007-amends-regen.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-007-precision-measurement.json";
const CACHE_DIR = ".data/law-collision-cache";
const WINDOW = 2500;

const AMEND_VERB = /se mění|se ruší|se vkládá|se nahrazuje|zní:/;

interface EdgeProposal {
  from: string;
  to: string;
  ref: string;
  provenance: { track: string; pass: number; method: string; ref: string };
  source: "census_full" | "title_fallback";
}
interface PerBillLogRow {
  billNodeId: string;
  cislo: number;
  source: string;
  citationCount: number;
  resolvedCount: number;
  unresolvedRefs: string[];
}
interface Payload {
  edges: EdgeProposal[];
  perBillLog: PerBillLogRow[];
}

function refToRegex(ref: string): RegExp {
  // ref is "N/RRRR" (e.g. "586/1992") — reconstruct the "č. N/RRRR Sb." citation shape loosely
  // (whitespace-tolerant around the slash, since pdftotext -layout can insert stray spaces).
  const [n, y] = ref.split("/");
  return new RegExp(`č\\.\\s*${n}\\s*/\\s*${y}\\s*Sb\\.`, "g");
}

function loadBillText(cislo: number): string {
  const dir = path.join(CACHE_DIR, `tisk-${cislo}`);
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  return files.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n\n=====\n\n");
}

interface EdgeResult {
  from: string;
  to: string;
  ref: string;
  cislo: number;
  source: "census_full" | "title_fallback";
  verdict: "high_confidence" | "low_confidence" | "unresolvable_by_proxy";
  occurrences: number;
  nearestVerbDistance: number | null;
}

function main() {
  const payload: Payload = JSON.parse(readFileSync(PAYLOAD, "utf8"));
  const cisloByBillId = new Map(payload.perBillLog.map((b) => [b.billNodeId, b.cislo]));

  const textCache = new Map<number, string>();
  const results: EdgeResult[] = [];

  for (const e of payload.edges) {
    const cislo = cisloByBillId.get(e.from);
    if (cislo == null) {
      results.push({ from: e.from, to: e.to, ref: e.ref, cislo: -1, source: e.source, verdict: "unresolvable_by_proxy", occurrences: 0, nearestVerbDistance: null });
      continue;
    }
    if (!textCache.has(cislo)) textCache.set(cislo, loadBillText(cislo));
    const text = textCache.get(cislo)!;

    if (!text) {
      results.push({ from: e.from, to: e.to, ref: e.ref, cislo, source: e.source, verdict: "unresolvable_by_proxy", occurrences: 0, nearestVerbDistance: null });
      continue;
    }

    const re = refToRegex(e.ref);
    let m: RegExpExecArray | null;
    let occurrences = 0;
    let nearestVerbDistance: number | null = null;
    while ((m = re.exec(text))) {
      occurrences++;
      const start = Math.max(0, m.index - WINDOW);
      const end = Math.min(text.length, m.index + m[0].length + WINDOW);
      const windowText = text.slice(start, end);
      const vm = AMEND_VERB.exec(windowText);
      if (vm) {
        const verbAbsIdx = start + vm.index;
        const dist = Math.abs(verbAbsIdx - m.index);
        if (nearestVerbDistance === null || dist < nearestVerbDistance) nearestVerbDistance = dist;
      }
      if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width stall
    }

    const verdict: EdgeResult["verdict"] = occurrences === 0 ? "unresolvable_by_proxy" : nearestVerbDistance !== null ? "high_confidence" : "low_confidence";
    results.push({ from: e.from, to: e.to, ref: e.ref, cislo, source: e.source, verdict, occurrences, nearestVerbDistance });
  }

  const bySource = (src: "census_full" | "title_fallback") => {
    const sub = results.filter((r) => r.source === src);
    const high = sub.filter((r) => r.verdict === "high_confidence").length;
    const low = sub.filter((r) => r.verdict === "low_confidence").length;
    const unresolvable = sub.filter((r) => r.verdict === "unresolvable_by_proxy").length;
    const measurable = high + low; // denominator excludes unresolvable (proxy has no signal there)
    return {
      total: sub.length,
      high_confidence: high,
      low_confidence: low,
      unresolvable_by_proxy: unresolvable,
      measurable,
      lowConfidenceRateOfMeasurable: measurable > 0 ? low / measurable : null,
    };
  };

  const censusFull = bySource("census_full");
  const titleFallback = bySource("title_fallback");
  const allHigh = results.filter((r) => r.verdict === "high_confidence").length;
  const allLow = results.filter((r) => r.verdict === "low_confidence").length;
  const allUnresolvable = results.filter((r) => r.verdict === "unresolvable_by_proxy").length;
  const allMeasurable = allHigh + allLow;

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      "Amending-context proxy (the SAME method batch-006's measure-precision-006.ts used, re-pointed at the batch-007 payload): for each regen edge (see summary.totalEdges below for the exact " +
        "population size measured THIS run — deliberately not hardcoded in this string, after a batch-007 self-review caught a stale count left over from an earlier pipeline iteration), search the bill's FULL cached text " +
      "(.data/law-collision-cache/tisk-<cislo>/*.txt, all pre-cached, zero new fetch) for every occurrence of the cited 'č. N/RRRR Sb.' string, and check whether an amending-verb marker " +
      "(se mění|se ruší|se vkládá|se nahrazuje|zní:) appears within ±2500 chars of ANY occurrence. high_confidence = at least one occurrence has verb context nearby. low_confidence = the ref " +
      "string DOES appear in the text but with NO amending-verb marker nearby on ANY occurrence (the proxy's flag for a possible footnote/boilerplate-amendment-lineage/explanatory-memo false " +
      "positive — this is a CONFIDENCE signal, not a validity proof; a manual read is still the ground truth, but this is the full-population deterministic proxy the audit specified). " +
      "unresolvable_by_proxy = the ref string never appears in the cached text at all (most common for title_fallback edges, whose citation source is the bill's TITLE, not necessarily reprinted " +
      "verbatim in the operative body text with the same 'č. N/RRRR Sb.' spacing) — these are EXCLUDED from the rate denominator since the proxy has no signal to offer, not counted as a pass or fail.",
    caveats: [
      "This is a DETERMINISTIC PROXY, not a ground-truth precision measurement — a low_confidence flag means 'no nearby amending verb found', which correlates with but is not proof of a false " +
        "edge (3 hand-proven false cases in batch-005 WERE low_confidence-shaped; the reverse implication does not hold in general).",
      "unresolvable_by_proxy CAN be large for title_fallback edges (citation source is the title prop, not necessarily reprinted in the body text) — in THIS run it happens to be 0 across all title_fallback edges (see bySource.title_fallback.unresolvable_by_proxy below for the exact count), meaning the batch-007 corpus's title-derived citations all also appear in the cached body text, but that is a property of this corpus, not a guarantee; treat a future run's 0 the same as a large figure — a coverage gap of the PROXY, not a precision defect " +
        "of those edges; title_fallback citations are the same class validated by the original 150-edge graph since batch-001/002 and are not new risk surface.",
      "Refs appearing in cached DŮVODOVÁ ZPRÁVA (explanatory memo) or full boilerplate amendment-history lineage text within the 2500-char window would still register a false 'se mění' hit if " +
        "the memo itself explains the change — this proxy is a bound on the false-positive rate, not an exact figure; treat the low_confidence rate as a floor on precision risk, not a ceiling.",
      "batch-007 independent-audit finding (N-D): AMEND_VERB includes 'se ruší' (repeal), so this proxy CANNOT distinguish a real amendment from a REPEAL clause — a repeal-target edge with its " +
        "own bill's repeal heading within the ±2500-char window scores high_confidence here, same as a real amendment. The high_confidence rate is NOT evidence against repeal-class false " +
        "positives; that class is excluded upstream instead, structurally, by amends-census.ts's REPEAL_MARKER/NON_AMEND_ART_HEADING_RE checks (which operate on block structure, not a verb " +
        "proxy) before an edge ever reaches this measurement — this proxy's job is limited to the amend-vs-nothing question, not amend-vs-repeal.",
    ],
    summary: {
      totalEdges: results.length,
      high_confidence: allHigh,
      low_confidence: allLow,
      unresolvable_by_proxy: allUnresolvable,
      measurable: allMeasurable,
      lowConfidenceRateOfMeasurable: allMeasurable > 0 ? allLow / allMeasurable : null,
      lowConfidenceRateOfAllEdges: results.length > 0 ? allLow / results.length : null,
    },
    bySource: { census_full: censusFull, title_fallback: titleFallback },
    lowConfidenceEdges: results.filter((r) => r.verdict === "low_confidence"),
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");

  console.log(`Edges: ${results.length} total`);
  console.log(`  high_confidence: ${allHigh}`);
  console.log(`  low_confidence: ${allLow}`);
  console.log(`  unresolvable_by_proxy: ${allUnresolvable}`);
  console.log(`  measurable (high+low): ${allMeasurable}, low-confidence rate: ${allMeasurable > 0 ? ((allLow / allMeasurable) * 100).toFixed(2) : "n/a"}%`);
  console.log(`By source:`);
  console.log(`  census_full: ${JSON.stringify(censusFull)}`);
  console.log(`  title_fallback: ${JSON.stringify(titleFallback)}`);
  console.log(`Wrote ${OUT}`);
}

main();
