/**
 * Case-loops batch-006, kiosek ingest — step 7: PROPOSED graph payload,
 * gated, NOT applied to any `.pglite`. Builds `notice` nodes and `cites`
 * (notice→law) / `concerns` (notice→company) edges from the real extracted
 * values in kiosek-slice-extract.json, cross-referenced against the
 * validated existing-node ids in kiosek-validation.json.
 *
 * `notice` is not yet a KG_NODE_KINDS member and `cites`/`concerns` are not
 * yet KG_EDGE_RELS members — lib/analysis/kg-verdict.ts is a fleet
 * single-writer file this loop may not edit (see docs/case-loops.md fleet
 * table). The exact enum additions to append are in the handoff. This script
 * therefore writes a plain JSON payload (not run through validateKgVerdict,
 * which would reject the unknown kind/rels) for the orchestrator to apply
 * after the enum additions land.
 *
 * Edges whose target (a `law:sb:*` or `company:ico:*` id) does not yet exist
 * in the graph are still emitted, but flagged `targetExists: false` with
 * `wouldNeed` naming which case owns minting that node — never silently
 * dropped, never fabricated as if the target were real.
 *
 * Run:
 *   npx tsx scripts/case-loops/sources/kiosek-build-payload.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const SLICE_PATH = "docs/data-analysis/case-sources/kiosek-slice-extract.json";
const VALIDATION_PATH = "docs/data-analysis/case-sources/kiosek-validation.json";
const OUT_PATH = "docs/data-analysis/case-sources/kiosek-payload.json";

// From docs/data-analysis/justice-sources-kiosek.md's verified dataset table
// (the spec doc's own §"Dataset table (verified samples)").
const INSTITUTION_ICO: Record<string, string> = {
  "201000": "00215660", // Městský soud v Praze
  "201010": "00024384", // Obvodní soud pro Prahu 1
  "221000": "00215651", // Vrchní soud v Praze
  "222000": "48510190", // Nejvyšší soud
  "302000": "00026018", // Krajské státní zastupitelství v Praze
};

interface Extraction {
  postingId: string;
  institutionCode: string;
  spisovaZnacka: string | null;
  title: string;
  agendas: string[];
  statutes: { lawUrn: string; citation: string }[];
  icos: { ico: string; companyUrn: string; nameContext: string; personLikely: boolean }[];
}

function noticeId(e: Extraction): string {
  const key = (e.spisovaZnacka ?? e.postingId).replace(/[^\w-]+/g, "_");
  return `notice:kiosek:${e.institutionCode}:${key}`;
}

function main() {
  const slice = JSON.parse(readFileSync(SLICE_PATH, "utf8")) as { extractions: Extraction[] };
  const validation = JSON.parse(readFileSync(VALIDATION_PATH, "utf8")) as {
    statuteJoinKey: { resolved: string[] };
    icoJoinKey: { resolved: string[] };
  };
  const lawExists = new Set(validation.statuteJoinKey.resolved);
  const companyExists = new Set(validation.icoJoinKey.resolved);

  const nodes: unknown[] = [];
  const edges: unknown[] = [];

  for (const e of slice.extractions) {
    if (e.statutes.length === 0 && e.icos.length === 0) continue; // no join-key content → no notice worth proposing
    const id = noticeId(e);
    nodes.push({
      id,
      kind: "notice", // PROPOSED — not yet in KG_NODE_KINDS, see handoff
      label: e.title,
      props: {
        agenda: e.agendas,
        institutionCode: e.institutionCode,
        institutionIco: INSTITUTION_ICO[e.institutionCode] ?? null,
        spisovaZnacka: e.spisovaZnacka,
        postingId: e.postingId,
      },
      rationale: `kiosek batch-006: ${e.statutes.length} statute citation(s), ${e.icos.length} IČO mention(s) extracted from the attached PDF`,
    });

    const seenLaws = new Set<string>();
    for (const s of e.statutes) {
      if (seenLaws.has(s.lawUrn)) continue;
      seenLaws.add(s.lawUrn);
      const exists = lawExists.has(s.lawUrn);
      edges.push({
        src: id,
        rel: "cites", // PROPOSED — not yet in KG_EDGE_RELS, see handoff
        dst: s.lawUrn,
        targetExists: exists,
        wouldNeed: exists ? null : "law case to mint this law:sb:* node (batch-006 kiosek found it cited but the graph has no node for it yet)",
        rationale: `PDF text of ${e.spisovaZnacka ?? e.postingId} cites "${s.citation} Sb."`,
      });
    }

    // batch-006 Opus-pass finding (b/CONCERN 1): an IČO flagged personLikely
    // belongs to a natural person (court-appointed liquidator/attorney, an
    // OSVČ registration), not a company — emitting it as a `concerns`→
    // `company:ico:*` edge would mint a phantom company and create a
    // high-degree false hub across every liquidation that reuses the same
    // liquidator. Routed to a separate, clearly-labelled bucket instead of
    // silently dropped OR silently merged into the company edges.
    const seenCompanies = new Set<string>();
    for (const m of e.icos) {
      if (seenCompanies.has(m.companyUrn)) continue;
      seenCompanies.add(m.companyUrn);
      const exists = companyExists.has(m.companyUrn);
      if (m.personLikely) {
        edges.push({
          src: id,
          rel: "concerns_person_ico", // NOT a proposed graph rel — flagged out, see handoff caveat
          dst: m.companyUrn.replace("company:ico:", "person:ico:"),
          targetExists: false,
          wouldNeed: "NOT a company edge — personLikely=true (birth-date clause / person-title prefix detected); would need a person:ico:* node kind, out of this batch's scope. Excluded from the company/money edge set on purpose.",
          rationale: `PDF text of ${e.spisovaZnacka ?? e.postingId} names IČO ${m.ico} (natural person) near "${m.nameContext.slice(0, 80)}"`,
        });
        continue;
      }
      edges.push({
        src: id,
        rel: "concerns", // PROPOSED — not yet in KG_EDGE_RELS, see handoff
        dst: m.companyUrn,
        targetExists: exists,
        wouldNeed: exists ? null : "money case to mint this company:ico:* node (batch-006 kiosek found a real, unanonymized IČO but the graph has no node for it yet)",
        rationale: `PDF text of ${e.spisovaZnacka ?? e.postingId} names IČO ${m.ico} near "${m.nameContext.slice(0, 80)}"`,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    boundary: "PROPOSAL ONLY — not applied to any .pglite. Requires kg-verdict.ts enum additions (notice kind, cites/concerns rels) before the orchestrator can apply this. See handoff.md for the exact enum text.",
    nodeCount: nodes.length,
    edgeCount: edges.length,
    edgesWithExistingTarget: (edges as { targetExists: boolean; rel: string }[]).filter(
      (e) => e.rel !== "concerns_person_ico" && e.targetExists,
    ).length,
    edgesWithMissingTarget: (edges as { targetExists: boolean; rel: string }[]).filter(
      (e) => e.rel !== "concerns_person_ico" && !e.targetExists,
    ).length,
    edgesFlaggedNaturalPersonIco: (edges as { rel: string }[]).filter((e) => e.rel === "concerns_person_ico").length,
    nodes,
    edges,
  };

  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(
    `wrote ${OUT_PATH}: ${nodes.length} notice nodes, ${edges.length} edges (${payload.edgesWithExistingTarget} to existing targets, ${payload.edgesWithMissingTarget} flagged missing-target, ${payload.edgesFlaggedNaturalPersonIco} flagged natural-person-IČO / excluded from company edges)`,
  );
}

main();
