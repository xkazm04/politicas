/* Case ③ Law loop — batch-004 Q-law-8: amends edge regeneration (PREPARE only).
 *
 * Builds the full regenerated `amends` (bill → law) edge PROPOSAL set from batch-003's census
 * data (Q-law-6), per the batch-004 brief:
 *   - for the 53 bills with a `amended_laws_full` census proposal (undercount > 0), use that
 *     body-extracted citation list;
 *   - for the other ~88 bills, fall back to the existing title-derived `amended_laws` bill prop
 *     (the same source the current 150 live `amends` edges were built from);
 *   - a citation only becomes an edge proposal if a `law` node actually exists for it — citations
 *     to statutes with NO corresponding law node are counted and listed separately (a
 *     "missing law nodes" census), never invented as edges.
 *
 * Read-only against a copy of the live graph (PGLITE_PATH must point at a `cp -r` copy, never
 * the live `./.pglite`). Does NOT write to the graph — this is a preparation script only; the
 * orchestrator serializes the actual topology change via a separate persist step.
 *
 *   PGLITE_PATH=./.pglite-copy-law-regen npx tsx scripts/case-loops/law/amends-regen.ts
 * → docs/data-analysis/case-law/payloads/batch-004-amends-regen.json
 * → docs/data-analysis/case-law/payloads/batch-004-amends-regen-impact.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getStore } from "@/lib/db/store";

const CENSUS_IN = "docs/data-analysis/case-law/payloads/amends-census.json";
const PROPOSAL_IN = "docs/data-analysis/case-law/payloads/amended-laws-full-proposal.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-004-amends-regen.json";
const IMPACT_OUT = "docs/data-analysis/case-law/payloads/batch-004-amends-regen-impact.md";

interface CensusRow {
  tiskId: string;
  cislo: number;
  origin: string;
  title: string;
  recordedAmends: number;
  recordedLaws: string[];
  realLaws: string[];
  realCount: number;
  undercount: number;
  docType: string;
  sourceUrl: string;
}
interface CensusFile {
  skips: { cislo: number; stage: string; reason: string }[];
  rows: CensusRow[];
}
interface ProposalFile {
  proposals: { billNodeId: string; cislo: number; amended_laws_full: string[]; recordedLaws: string[]; undercount: number }[];
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a copy, e.g. PGLITE_PATH=./.pglite-copy-law-regen");

  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const bills = nodes.filter((n) => n.kind === "bill");
  const laws = nodes.filter((n) => n.kind === "law");
  const lawNodeByRef = new Map(laws.map((n) => [String((n.props as Record<string, unknown>).ref ?? ""), n.id]));
  const currentAmendsEdges = edges.filter((e) => e.rel === "amends");

  const census: CensusFile = JSON.parse(readFileSync(CENSUS_IN, "utf8"));
  const proposal: ProposalFile = JSON.parse(readFileSync(PROPOSAL_IN, "utf8"));
  const proposalByBillId = new Map(proposal.proposals.map((p) => [p.billNodeId, p]));
  const skippedCislo = new Set(census.skips.map((s) => s.cislo));

  // ---- CURRENT (before) churn ranking, from the live 150 amends edges ----
  const lawNodeById = new Map(laws.map((n) => [n.id, n]));
  const beforeChurn = new Map<string, number>(); // law node id -> edge count
  for (const e of currentAmendsEdges) beforeChurn.set(e.dst, (beforeChurn.get(e.dst) ?? 0) + 1);

  // ---- Build regenerated edge set ----
  interface EdgeProposal {
    from: string;
    to: string;
    ref: string;
    provenance: { track: "law"; method: "deterministic"; ref: string };
    source: "census_full" | "title_fallback" | "no_data";
  }
  const edgeMap = new Map<string, EdgeProposal>(); // dedupe key `${from}|${to}`
  const perBillLog: {
    billNodeId: string;
    cislo: number;
    source: "census_full" | "title_fallback" | "no_data";
    citationCount: number;
    resolvedCount: number;
    unresolvedRefs: string[];
  }[] = [];
  const missingLawCites = new Map<string, { statute: string; billIds: Set<string>; billCislo: Set<number> }>();

  for (const bill of bills) {
    const p = bill.props as Record<string, unknown>;
    const cislo = Number(p.cislo);
    const censusProp = proposalByBillId.get(bill.id);
    const titleLaws = Array.isArray(p.amended_laws) ? (p.amended_laws as string[]) : [];
    // citationSource: per-ref provenance tag, since the union below can pull refs from either
    // the census body-extraction or the title-derived graph prop within the SAME bill.
    let citationSource: Map<string, "census_full" | "title_fallback">;
    let source: "census_full" | "title_fallback" | "no_data";

    if (censusProp) {
      // Defect 1 fix (per Opus audit, batch-004-amends-regen-audit.md): UNION the census
      // body-extracted list with the recorded/title-derived list, not a replace. The body
      // extraction can miss a statute the title records (e.g. tisk 88 / 360/2025) — a
      // replace silently drops a live edge. Union keeps both; refs from the census list are
      // tagged "census_full", refs found only via the title-derived list are tagged
      // "title_fallback" (matches validator's per-source provenance check).
      citationSource = new Map();
      for (const ref of censusProp.amended_laws_full) citationSource.set(ref, "census_full");
      for (const ref of titleLaws) if (!citationSource.has(ref)) citationSource.set(ref, "title_fallback");
      source = "census_full";
    } else {
      citationSource = new Map(titleLaws.map((ref) => [ref, "title_fallback" as const]));
      source = titleLaws.length > 0 ? "title_fallback" : "no_data";
      if (source === "no_data" && !skippedCislo.has(cislo)) {
        // Not one of the census skips, and no title-derived citation either — a genuinely
        // amends-less bill (e.g. a non-amending print) is plausible; log it either way, no
        // silent drop.
      }
    }

    const citations = [...citationSource.keys()];
    const resolved: string[] = [];
    const unresolved: string[] = [];
    for (const ref of citations) {
      const refSource = citationSource.get(ref)!;
      const lawNodeId = lawNodeByRef.get(ref);
      if (lawNodeId) {
        resolved.push(ref);
        const key = `${bill.id}|${lawNodeId}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            from: bill.id,
            to: lawNodeId,
            ref,
            provenance: { track: "law", method: "deterministic", ref: "amends-regen-census" },
            source: refSource,
          });
        }
      } else {
        unresolved.push(ref);
        const rec = missingLawCites.get(ref) ?? { statute: ref, billIds: new Set(), billCislo: new Set() };
        rec.billIds.add(bill.id);
        rec.billCislo.add(cislo);
        missingLawCites.set(ref, rec);
      }
    }

    perBillLog.push({
      billNodeId: bill.id,
      cislo,
      source,
      citationCount: citations.length,
      resolvedCount: resolved.length,
      unresolvedRefs: unresolved,
    });
  }

  const regenEdges = [...edgeMap.values()];

  // ---- AFTER churn ranking (regenerated set) ----
  const afterChurn = new Map<string, number>(); // law node id -> edge count
  for (const e of regenEdges) afterChurn.set(e.to, (afterChurn.get(e.to) ?? 0) + 1);

  const refOf = (lawNodeId: string) => String((lawNodeById.get(lawNodeId)?.props as Record<string, unknown> | undefined)?.ref ?? lawNodeId);

  const beforeTop10 = [...beforeChurn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count], i) => ({ rank: i + 1, lawNodeId: id, ref: refOf(id), count }));
  const afterTop10 = [...afterChurn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count], i) => ({ rank: i + 1, lawNodeId: id, ref: refOf(id), count }));

  const beforeRankByRef = new Map(beforeTop10.map((r) => [r.ref, r.rank]));
  const rankShift = afterTop10.map((r) => ({
    ...r,
    beforeRank: beforeRankByRef.get(r.ref) ?? null,
    beforeCount: beforeChurn.get(r.lawNodeId) ?? 0,
    delta: r.count - (beforeChurn.get(r.lawNodeId) ?? 0),
  }));

  // ---- Skip/no-data bookkeeping (no silent truncation) ----
  const noDataBills = perBillLog.filter((b) => b.source === "no_data");
  const censusFullCount = perBillLog.filter((b) => b.source === "census_full").length;
  const titleFallbackCount = perBillLog.filter((b) => b.source === "title_fallback").length;

  const missingLawCensus = [...missingLawCites.values()]
    .map((r) => ({
      statute: r.statute,
      citingBillCount: r.billIds.size,
      sampleBillIds: [...r.billIds].slice(0, 5),
      sampleBillCislo: [...r.billCislo].sort((a, b) => a - b).slice(0, 5),
    }))
    .sort((a, b) => b.citingBillCount - a.citingBillCount);

  const totalUnresolvedCitations = perBillLog.reduce((a, b) => a + b.unresolvedRefs.length, 0);

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      "For 53 bills with a batch-003 amended_laws_full census proposal (undercount > 0), use the full body-extracted citation list. For the other bills, fall back to the existing title-derived amended_laws bill prop (the same source the current 150 live amends edges were built from). A citation becomes an edge proposal only if a law node exists for it in the graph; unresolved citations are counted in missingLawNodeCensus, never fabricated as edges.",
    boundary: "PREPARE only — read-only against .pglite-copy-law-regen, not applied to the live graph. Orchestrator executes the topology change.",
    stats: {
      billsTotal: bills.length,
      billsUsingCensusFull: censusFullCount,
      billsUsingTitleFallback: titleFallbackCount,
      billsWithNoData: noDataBills.length,
      billsWithNoDataList: noDataBills.map((b) => ({ billNodeId: b.billNodeId, cislo: b.cislo, censusSkipped: skippedCislo.has(b.cislo) })),
      currentAmendsEdgeCount: currentAmendsEdges.length,
      regeneratedAmendsEdgeCount: regenEdges.length,
      edgeCountDelta: regenEdges.length - currentAmendsEdges.length,
      totalCitationsConsidered: perBillLog.reduce((a, b) => a + b.citationCount, 0),
      totalResolvedCitations: perBillLog.reduce((a, b) => a + b.resolvedCount, 0),
      totalUnresolvedCitations,
      distinctMissingLawStatutes: missingLawCensus.length,
    },
    caveats: {
      defect2UndercountZeroOrNegative:
        "Bills whose census realLaws differ from recordedLaws but have undercount <= 0 never " +
        "get a census_full proposal row, so this run's union only ever adds title-derived refs " +
        "on top of the census body-extraction for the 53 undercount>0 bills — it does NOT " +
        "backfill body-extracted statutes for bills below that threshold. Per the Opus audit " +
        "(batch-004-amends-regen-audit.md, Defect 2), 3 such bills have real title/body " +
        "disagreement: tisk 219 (recorded 301/1992, real 354/2019), tisk 222 (recorded " +
        "134/2016, real 9/2002), tisk 243 (recorded 223/2016, real 240/2000). None of the " +
        "three missed statutes currently has a law node, so this costs 0 edges in this batch " +
        "— flagged here as a known gap, not silently fixed (the count-based undercount>0 " +
        "trigger should become set-difference-based in a future batch).",
    },
    missingLawNodeCensus: missingLawCensus,
    churnRanking: {
      beforeTop10,
      afterTop10,
      rankShift,
    },
    perBillLog,
    edges: regenEdges,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");

  // ---- Impact analysis sidecar (human-readable) ----
  const md = buildImpactMd(out);
  writeFileSync(IMPACT_OUT, md, "utf8");

  console.log(`Bills: ${bills.length} total (${censusFullCount} census_full, ${titleFallbackCount} title_fallback, ${noDataBills.length} no_data)`);
  console.log(`Edges: current ${currentAmendsEdges.length} -> regenerated ${regenEdges.length} (Δ${regenEdges.length - currentAmendsEdges.length >= 0 ? "+" : ""}${regenEdges.length - currentAmendsEdges.length})`);
  console.log(`Missing law nodes: ${missingLawCensus.length} distinct statutes, ${totalUnresolvedCitations} bill-citations affected`);
  console.log(`Wrote ${OUT}`);
  console.log(`Wrote ${IMPACT_OUT}`);
  await store.close();
}

function buildImpactMd(out: {
  stats: Record<string, unknown>;
  churnRanking: {
    beforeTop10: { rank: number; ref: string; count: number }[];
    afterTop10: { rank: number; ref: string; count: number }[];
    rankShift: { rank: number; ref: string; count: number; beforeRank: number | null; beforeCount: number; delta: number }[];
  };
  missingLawNodeCensus: { statute: string; citingBillCount: number; sampleBillCislo: number[] }[];
}): string {
  const s = out.stats as {
    billsTotal: number;
    billsUsingCensusFull: number;
    billsUsingTitleFallback: number;
    billsWithNoData: number;
    currentAmendsEdgeCount: number;
    regeneratedAmendsEdgeCount: number;
    edgeCountDelta: number;
    distinctMissingLawStatutes: number;
    totalUnresolvedCitations: number;
  };
  const lines: string[] = [];
  lines.push("# Q-law-8 — amends edge regeneration: impact analysis (batch-004, prepare only)");
  lines.push("");
  lines.push(
    `Edge count: **${s.currentAmendsEdgeCount} (current) → ${s.regeneratedAmendsEdgeCount} (regenerated)**, Δ${s.edgeCountDelta >= 0 ? "+" : ""}${s.edgeCountDelta}. ` +
      `${s.billsUsingCensusFull} bills use the census \`amended_laws_full\` list, ${s.billsUsingTitleFallback} fall back to the title-derived \`amended_laws\` prop, ${s.billsWithNoData} have neither (logged, not dropped).`,
  );
  lines.push(
    `Missing law nodes: **${s.distinctMissingLawStatutes} distinct statutes** cited with no corresponding \`law\` node in the graph, affecting **${s.totalUnresolvedCitations} bill-citations** — proposed follow-up census, not built this batch.`,
  );
  lines.push("");
  lines.push("## Churn re-ranking — top 10 most-amended statutes, before vs after");
  lines.push("");
  lines.push("| rank (after) | statute | after count | before rank | before count | Δ |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of out.churnRanking.rankShift) {
    lines.push(`| ${r.rank} | ${r.ref} | ${r.count} | ${r.beforeRank ?? "—"} | ${r.beforeCount} | ${r.delta >= 0 ? "+" : ""}${r.delta} |`);
  }
  lines.push("");
  lines.push("### Before top 10 (current 150-edge graph), for reference");
  lines.push("");
  lines.push("| rank | statute | count |");
  lines.push("|---|---|---|");
  for (const r of out.churnRanking.beforeTop10) lines.push(`| ${r.rank} | ${r.ref} | ${r.count} |`);
  lines.push("");
  lines.push("## Top missing-law-node statutes (no graph node — cannot become an edge)");
  lines.push("");
  lines.push("| statute | citing bills | sample cislo |");
  lines.push("|---|---|---|");
  for (const m of out.missingLawNodeCensus.slice(0, 15)) lines.push(`| ${m.statute} | ${m.citingBillCount} | ${m.sampleBillCislo.join(", ")} |`);
  lines.push("");
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
