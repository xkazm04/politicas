/* Case ③ Law loop — batch-006 P1c: the durable apply path for batch-005's paired landing
 * (187 missing law nodes + 567 amends edges), the D3/D4 gap the batch-005 handoff flagged:
 * `persist-batch.ts` (shared, props-merge-only, out of this case's fleet boundary) refuses
 * inserts and cannot execute a node/edge SET-GROWING write. This script is the case-scoped
 * insert-capable reference implementation the batch-005 handoff asked for.
 *
 * Design (per batch-005.md §6 execution plan + handoff.md §2):
 *   1. NODES FIRST, edges second, same run — 191 of 567 edge targets don't exist without the
 *      node payload applied first (D11).
 *   2. Nodes: plain insert (upsertKgNodes on ids that don't yet exist) with a REAL assigned
 *      `pass` (via --pass=<n>, never a placeholder) — refuses to run without --pass.
 *   3. Edges: split by whether the (from,to) key ALREADY exists live —
 *        - NEW keys (417 of 567): full insert, provenance = payload's provenance with the
 *          real pass number substituted for the placeholder 0.
 *        - PRE-EXISTING keys (150 of 567): props/provenance-PRESERVING merge — the live row's
 *          `provenance` field is left completely untouched (D4: batch-004's audit caught a
 *          union-vs-replace defect on edge PRESENCE; batch-005's own audit caught the same
 *          class one field deeper on edge VALUES — a blind upsert of the full payload would
 *          silently overwrite the original provenance/props on these 150 keys). Only a nested,
 *          namespaced note (`props.amends_regen_005`) is added, recording that this batch's
 *          regen re-confirmed the edge and what source/ref it carries — additive, never
 *          replacing what was there.
 *   4. Deletion safety gate (P44/D1, reused from diff-amends-regen-deletions.ts's method):
 *      any LIVE amends edge whose (from,to) key is NOT in the regen payload is a proposed
 *      deletion and must be explicitly allowlisted (DELETION_ALLOWLIST below — empty, batch-005
 *      found 0 deletions) or the run refuses to commit.
 *   5. Precision exclusion (batch-006 P1b + the independent P1a audit's N2 finding, merged): 6 of
 *      567 edges are confirmed false and excluded (EXCLUDED_LOW_CONFIDENCE_EDGES below), never
 *      applied, logged not dropped silently. The other 3 low-confidence-proxy-flagged edges were
 *      manually read and found to be real edges the proxy missed (verb phrasing outside its
 *      regex set, or the amending verb sitting beyond the ±2500-char window in a long
 *      amendment-history lineage citation) — these ARE applied, tagged with a
 *      `props.amends_precision_note` flag for UI-level lower-confidence rendering, never
 *      silently promoted to full confidence. A startup assertion (below) verifies every
 *      EXCLUDED_LOW_CONFIDENCE_EDGES entry actually matches a payload edge — a batch-006
 *      reflection pass found 3 of the 6 entries originally carried a wrong `from` bill-node id
 *      that silently matched nothing, meaning those 3 audit-confirmed-false edges would still
 *      have been written by a live commit despite the prose claiming all 6 were excluded. Fixed;
 *      this assertion exists so the same class of bug fails loudly instead of silently next time.
 *
 * Fleet-mode write safety (same convention as scripts/case-loops/money/purge-osvc.ts):
 *   - defaults to dry-run; only --commit performs a write.
 *   - --commit with PGLITE_PATH unset (i.e. targeting the live default ./.pglite) is REFUSED
 *     unless --confirm-live is also passed — the orchestrator's explicit, deliberate act.
 *   - --commit requires --pass=<n> (a real assigned pass number, never a placeholder).
 *
 * Always writes a payload artifact (dry-run AND commit) to
 *   docs/data-analysis/case-law/payloads/batch-006-apply-report.json
 *
 *   # dry-run against a copy (safe, default):
 *   PGLITE_PATH=./.pglite-copy-law-apply-test npx tsx scripts/case-loops/law/apply-amends-regen.ts
 *
 *   # orchestrator's real live commit (this driver never runs this itself, per fleet rules):
 *   npx tsx scripts/case-loops/law/apply-amends-regen.ts --commit --confirm-live --pass=<N>
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const NODE_PAYLOAD = "docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json";
const EDGE_PAYLOAD = "docs/data-analysis/case-law/payloads/batch-005-amends-regen.json";
const REPORT_OUT = "docs/data-analysis/case-law/payloads/batch-006-apply-report.json";

const arg = (name: string): string | undefined => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

// Deletion allowlist (P44/D1, same convention as diff-amends-regen-deletions.ts) — EMPTY by
// design, batch-005/006 found 0 genuine deletions. Any future regen with a real deletion must
// add an entry here with a one-line justification, reviewed BEFORE committing.
const DELETION_ALLOWLIST: string[] = [];

// Exclusion list, merged from TWO independent checks: the batch-006 driver's own P1b manual
// review (2 edges) AND the independently-dispatched Opus audit's N2 finding (which found the
// SAME 2 plus 4 more, with line-level cached-text evidence — see batch-006.md §1). The audit is
// the authoritative source; all 6 are excluded here regardless of which check first named them.
// NOTE: per the audit's overall verdict, these 6 false-edge exclusions are NOT sufficient to make
// the edge regen ready — N1 (the census extractor's Čl.-only article splitter silently degrades
// every ČÁST/§-structured bill to a single, often-wrong citation, undercounting ~29 true edges
// in exactly the highest-value government omnibus bills) is a RECALL defect this exclusion list
// cannot fix; it requires re-running the extractor with a ČÁST/Změna-heading splitter and
// regenerating the payload. This script and its exclusion list remain correct machinery for
// whenever that regenerated payload lands — they do not by themselves clear the audit's NOT
// READY verdict for the edge set. See batch-006.md §5 for the full recommendation.
const EXCLUDED_LOW_CONFIDENCE_EDGES: { from: string; to: string; ref: string; reason: string }[] = [
  {
    from: "bill:tisk:43170",
    to: "law:sb:21-1992",
    ref: "21/1992",
    reason:
      "tisk 63 ('o účetnictví', a new standalone accounting act) cites 21/1992 (banking law) only as a substantive cross-reference (\"...pokud... zveřejňuje údaje podle § 11c zákona č. 21/1992 Sb., o bankách...\", tisk-63/266144.txt:5126) — no amending-clause context. Confirmed independently by both the driver's manual read and the Opus audit (N2).",
  },
  {
    from: "bill:tisk:43176",
    to: "law:sb:381-1991",
    ref: "381/1991",
    reason:
      "tisk 69's only occurrence of 381/1991 is inside a MULTI-LINE footnote (tisk-69/266214.txt:146-147: \"3) Například zákon č. 220/1991 Sb., / ve znění pozdějších předpisů, zákon č. 381/1991 Sb., ...\") — isFootnoteLine inspects only the line containing the match, so the footnote's continuation line was not caught (audit N4). 381/1991 is not among tisk 69's 7 real Změna targets (audit N1/N2). The bill's real amending targets include 531/1990 per a 'kterým se mění zákon č. 531/1990 Sb.' string in the same text — NOT wired by any edge in this payload (N1 recall gap).",
  },
  {
    from: "bill:tisk:43113",
    to: "law:sb:424-1991",
    ref: "424/1991",
    reason:
      "Opus audit N2: tisk 6 is a new Anti-Corruption Office Act with no amending part; the 424/1991 citation (tisk-6/265061.txt:288) is a transitional provision about the predecessor institution, not an amendment. The driver's own P1b manual read had classified this as a real edge (proxy false-negative) — the audit's deeper line-level read overturns that; deferring to the audit as the authoritative independent check.",
  },
  {
    // batch-006 REFLECTION FIX: this entry originally carried the wrong `from` id
    // (bill:tisk:43159, which does not exist as tisk 55's node) and silently no-op'd — the
    // independent reflection pass (a second Opus call, distinct from the P1a audit) caught it by
    // cross-checking the exclusion list against the actual payload keys, not just the prose. The
    // correct id was re-derived from `batch-005-amends-regen.json`'s `perBillLog` (cislo 55 ->
    // bill:tisk:43162) and the edge (bill:tisk:43162, law:sb:194-2017) was confirmed present in
    // the payload before fixing.
    from: "bill:tisk:43162",
    to: "law:sb:194-2017",
    ref: "194/2017",
    reason:
      "Opus audit N2: tisk 55's citation of 194/2017 (tisk-55/266009.txt:494) is a REPEAL clause (\"Zrušovací ustanovení / Zrušují se: 1. Část první zákona č. 194/2017 Sb.\"), not an amendment — a different relation the amends-census extractor cannot distinguish from an amending citation.",
  },
  {
    // batch-006 REFLECTION FIX: same class of bug as the 55 entry above — wrong `from` id
    // (bill:tisk:43177) corrected to the real one (cislo 76 -> bill:tisk:43183), re-verified
    // present in the payload before fixing.
    from: "bill:tisk:43183",
    to: "law:sb:234-2014",
    ref: "234/2014",
    reason:
      "Opus audit N2: tisk 76's citation of 234/2014 (tisk-76/266517.txt:1607: \"Zrušují se: 1. Zákon č. 234/2014 Sb., o státní službě.\") is a repeal, not an amendment.",
  },
  {
    // batch-006 REFLECTION FIX: same class of bug — wrong `from` id (bill:tisk:43225, which is
    // actually a DIFFERENT bill, tisk 115) corrected to the real one (cislo 144 ->
    // bill:tisk:43264), re-verified present in the payload before fixing.
    from: "bill:tisk:43264",
    to: "law:sb:326-1999",
    ref: "326/1999",
    reason:
      "Opus audit N2: tisk 144's citation of 326/1999 (tisk-144/268804.txt:14176, memo at 28176: \"navrhuje se zrušit současný zákon č. 326/1999 Sb.\") is a repeal, not an amendment.",
  },
];

interface NodePayload {
  id: string;
  kind: "law";
  label: string;
  props: Record<string, unknown>;
  provenance: Record<string, unknown>;
}
interface EdgePayload {
  from: string;
  to: string;
  ref: string;
  provenance: { track: string; pass: number; method: string; ref: string };
  source: "census_full" | "title_fallback";
}

// The 3 edges manually confirmed as real (proxy false-negatives) but still worth an honest
// lower-confidence render note — see batch-006-precision-measurement.json's lowConfidenceEdges
// for the full set; these 3 are the ones NOT in EXCLUDED_LOW_CONFIDENCE_EDGES above.
// batch-006 REFLECTION FIX: tisk 6 (bill:tisk:43113|law:sb:424-1991) was REMOVED from this list —
// it was originally classified here as a real proxy-false-negative by the driver's own manual
// read, but the independent Opus audit's deeper, cross-bill-corroborated read overturned that
// call (the citation is a transitional provision, not an amendment; the real 424/1991 amendment
// is in a different bill). It now lives ONLY in EXCLUDED_LOW_CONFIDENCE_EDGES above — leaving it
// in both lists would have been harmless (exclusion is checked first) but was flagged by the
// reflection pass as exactly the kind of stale self-description this batch's audit criticized
// elsewhere (D7/N5), so it is removed here rather than left as dead, contradictory code.
function isManuallyConfirmedLowConfidenceButReal(from: string, to: string): boolean {
  const keys = new Set([
    "bill:tisk:43114|law:sb:87-1995", // tisk 7 — amending verb likely just beyond the ±2500 window (Čl. VII header confirms real target)
    "bill:tisk:43117|law:sb:141-1961", // tisk 10 — long amendment-history lineage list pushes "se mění takto:" beyond the window
    "bill:tisk:43171|law:sb:99-1963", // tisk 64 — confirmed by explanatory memo's "soubor novel" list; same long-lineage window issue
  ]);
  return keys.has(`${from}|${to}`);
}

async function main() {
  const commit = flag("commit");
  const passArg = arg("pass");
  const pass = passArg ? Number(passArg) : NaN;

  if (commit && !Number.isFinite(pass)) {
    console.error("REFUSED: --commit requires --pass=<n> (a real assigned pass number, never a placeholder).");
    process.exit(1);
  }
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Either point PGLITE_PATH at a copy/fixture, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }

  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH to a copy/fixture for a dry run — never the live ./.pglite without --confirm-live)");
    process.exit(1);
  }

  console.log(`apply-amends-regen (batch-006 P1c) · ${commit ? `COMMIT (pass ${pass})` : "DRY-RUN"}\n`);

  const nodePayload: { resolved: NodePayload[] } = JSON.parse(readFileSync(NODE_PAYLOAD, "utf8"));
  const edgePayload: { edges: EdgePayload[] } = JSON.parse(readFileSync(EDGE_PAYLOAD, "utf8"));

  // ---- Phase 0: precision exclusion ----
  // Reflection-pass fix: assert every exclusion entry actually matches a payload edge BEFORE
  // filtering — 3 of 6 entries once carried a wrong `from` id and silently no-op'd (see docblock
  // item 5). A no-op exclusion is worse than none: it makes the console log and report claim an
  // edge was excluded when it was actually still applied.
  const allPayloadKeys = new Set(edgePayload.edges.map((e) => `${e.from}|${e.to}`));
  const nonMatchingExclusions = EXCLUDED_LOW_CONFIDENCE_EDGES.filter((ex) => !allPayloadKeys.has(`${ex.from}|${ex.to}`));
  if (nonMatchingExclusions.length > 0) {
    console.error(
      `REFUSED: ${nonMatchingExclusions.length} EXCLUDED_LOW_CONFIDENCE_EDGES entr${nonMatchingExclusions.length === 1 ? "y" : "ies"} ` +
        `${nonMatchingExclusions.length === 1 ? "does" : "do"} not match any edge in ${EDGE_PAYLOAD} — the exclusion would silently no-op:\n` +
        nonMatchingExclusions.map((ex) => `  ${ex.from} -> ${ex.to} (${ex.ref})`).join("\n"),
    );
    await store.close();
    process.exit(1);
  }
  const excludedKeys = new Set(EXCLUDED_LOW_CONFIDENCE_EDGES.map((e) => `${e.from}|${e.to}`));
  const edgesToConsider = edgePayload.edges.filter((e) => !excludedKeys.has(`${e.from}|${e.to}`));
  console.log(`Edge payload: ${edgePayload.edges.length} total, ${EXCLUDED_LOW_CONFIDENCE_EDGES.length} excluded (precision review), ${edgesToConsider.length} to apply.`);
  for (const ex of EXCLUDED_LOW_CONFIDENCE_EDGES) console.log(`  EXCLUDED: ${ex.from} -> ${ex.to} (${ex.ref}) — ${ex.reason}`);

  // ---- Phase 1: nodes ----
  const liveNodes = await store.listKgNodes({ kind: "law" });
  const liveNodeIds = new Set(liveNodes.map((n) => n.id));
  const newNodes = nodePayload.resolved.filter((n) => !liveNodeIds.has(n.id));
  const dupNodes = nodePayload.resolved.filter((n) => liveNodeIds.has(n.id));
  console.log(`\nNode payload: ${nodePayload.resolved.length} total, ${newNodes.length} new, ${dupNodes.length} already live (would upsert-merge, not duplicate).`);
  if (dupNodes.length) console.log(`  WARNING — already-live node ids: ${dupNodes.map((d) => d.id).join(", ")}`);

  const nodeRows: KgNodeRow[] = nodePayload.resolved.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: n.props,
    firstSeenPass: liveNodeIds.has(n.id) ? (liveNodes.find((ln) => ln.id === n.id)?.firstSeenPass ?? pass) : pass,
    provenance: liveNodeIds.has(n.id) ? (liveNodes.find((ln) => ln.id === n.id)?.provenance ?? n.provenance) : { ...n.provenance, pass },
  })) as unknown as KgNodeRow[];

  // ---- Phase 2: edges — split existing vs new, preserving provenance on existing ----
  const liveEdges = await store.listKgEdges({ rel: "amends" });
  const liveEdgeByKey = new Map(liveEdges.map((e) => [`${e.src}|${e.dst}`, e]));

  const newEdgeRows: KgEdgeRow[] = [];
  const mergedEdgeRows: KgEdgeRow[] = [];
  let lowConfidenceApplied = 0;

  for (const p of edgesToConsider) {
    const key = `${p.from}|${p.to}`;
    const existing = liveEdgeByKey.get(key);
    const lowConf = isManuallyConfirmedLowConfidenceButReal(p.from, p.to);
    if (lowConf) lowConfidenceApplied++;

    if (existing) {
      // D4 fix: provenance untouched — only an additive, namespaced note.
      mergedEdgeRows.push({
        src: existing.src,
        rel: existing.rel,
        dst: existing.dst,
        weight: existing.weight,
        props: {
          ...existing.props,
          amends_regen_005: { source: p.source, ref: p.ref, reconfirmedAt: new Date().toISOString() },
          ...(lowConf ? { amends_precision_note: "low_confidence_proxy_manually_confirmed_real" } : {}),
        },
        provenance: existing.provenance, // UNTOUCHED — this is the D4 fix.
      });
    } else {
      newEdgeRows.push({
        src: p.from,
        rel: "amends",
        dst: p.to,
        weight: null,
        props: {
          source: p.source,
          ref: p.ref,
          ...(lowConf ? { amends_precision_note: "low_confidence_proxy_manually_confirmed_real" } : {}),
        },
        provenance: { ...p.provenance, pass },
      });
    }
  }
  console.log(`\nEdges: ${newEdgeRows.length} new inserts, ${mergedEdgeRows.length} pre-existing (provenance-preserving merge), ${lowConfidenceApplied} tagged low_confidence_proxy (manually confirmed real).`);

  // ---- Phase 3: deletion safety gate ----
  const regenKeys = new Set(edgesToConsider.map((e) => `${e.from}|${e.to}`));
  const dropped = [...liveEdgeByKey.keys()].filter((k) => !regenKeys.has(k));
  const unallowlisted = dropped.filter((k) => !DELETION_ALLOWLIST.includes(k));
  console.log(`\nDeletion check: ${liveEdges.length} live amends edges, ${dropped.length} not present in the applied set, ${unallowlisted.length} unallowlisted.`);
  if (dropped.length) for (const k of dropped) console.log(`  DROP: ${k}${DELETION_ALLOWLIST.includes(k) ? " [allowlisted]" : " [NOT ALLOWLISTED]"}`);
  const deletionGateOk = unallowlisted.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: commit ? "commit" : "dry-run",
    pass: commit ? pass : null,
    nodePayloadTotal: nodePayload.resolved.length,
    nodesNew: newNodes.length,
    nodesAlreadyLive: dupNodes.length,
    edgePayloadTotal: edgePayload.edges.length,
    edgesExcludedPrecision: EXCLUDED_LOW_CONFIDENCE_EDGES,
    edgesApplied: edgesToConsider.length,
    edgesNewInsert: newEdgeRows.length,
    edgesMergedPreexisting: mergedEdgeRows.length,
    edgesLowConfidenceApplied: lowConfidenceApplied,
    deletionCheck: { liveAmendsEdges: liveEdges.length, droppedKeys: dropped, unallowlistedCount: unallowlisted.length, gateOk: deletionGateOk },
  };
  await mkdir(path.dirname(REPORT_OUT), { recursive: true });
  await writeFile(REPORT_OUT, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${REPORT_OUT}`);

  if (!deletionGateOk) {
    console.error(`\nREFUSED: ${unallowlisted.length} unallowlisted deletion(s) — refusing to commit even if --commit was passed.`);
    await store.close();
    process.exit(1);
  }

  if (commit) {
    console.log(`\n--commit passed — writing nodes first, then edges (same window)...`);
    const writtenNodes = await store.upsertKgNodes(nodeRows);
    console.log(`  nodes: ${writtenNodes} row(s) upserted`);
    const writtenEdges = await store.upsertKgEdges([...newEdgeRows, ...mergedEdgeRows]);
    console.log(`  edges: ${writtenEdges} row(s) upserted (${newEdgeRows.length} new + ${mergedEdgeRows.length} merged)`);
    console.log(`\nCOMMITTED pass ${pass}: ${writtenNodes} nodes + ${writtenEdges} edges.`);
  } else {
    console.log(`\nDRY-RUN: nothing written to the store. Re-run with --commit --pass=<n> (against an isolated copy, or --confirm-live for the real orchestrator run) to apply.`);
  }

  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
