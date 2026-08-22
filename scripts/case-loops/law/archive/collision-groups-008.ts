/* Case ③ Law loop — batch-008: collision-candidate GROUPS from the F1/F2-fixed 577-edge topology
 * (batch-008-amends-regen.json), the deterministic "same law, >1 bill" join (no LLM, no network —
 * pure edge-set math over the already-generated regen payload).
 *
 *   npx tsx scripts/case-loops/law/collision-groups-008.ts
 * → docs/data-analysis/case-law/payloads/collision-groups-008.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const REGEN = "docs/data-analysis/case-law/payloads/batch-008-amends-regen.json";
const OUT = "docs/data-analysis/case-law/payloads/collision-groups-008.json";

interface EdgeProposal {
  from: string;
  to: string;
  ref: string;
}
interface RegenPayload {
  edges: EdgeProposal[];
  perBillLog: { billNodeId: string; cislo: number }[];
}

function main() {
  const payload: RegenPayload = JSON.parse(readFileSync(REGEN, "utf8"));
  const cisloByBillId = new Map(payload.perBillLog.map((b) => [b.billNodeId, b.cislo]));

  const billsByLawRef = new Map<string, Set<number>>();
  for (const e of payload.edges) {
    const cislo = cisloByBillId.get(e.from);
    if (cislo == null) continue;
    const set = billsByLawRef.get(e.ref) ?? new Set<number>();
    set.add(cislo);
    billsByLawRef.set(e.ref, set);
  }

  const lawIdByRef = new Map(payload.edges.map((e) => [e.ref, e.to]));

  const groups = [...billsByLawRef.entries()]
    .map(([lawRef, bills]) => ({
      lawUrn: lawIdByRef.get(lawRef) ?? `law:sb:${lawRef.replace("/", "-")}`,
      lawRef,
      lawTitle: "",
      bills: [...bills].sort((a, b) => a - b),
    }))
    .filter((g) => g.bills.length > 1)
    .sort((a, b) => b.bills.length - a.bills.length);

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      "batch-008: same-law >1-bill grouping over the F1/F2-fixed 577-edge amends topology (batch-008-amends-regen.json). Deterministic edge-join, no network, no LLM — the §-level partition/collision check (collision-check-008.ts) confirms which of these candidate groups actually share a §.",
    sourceRegen: REGEN,
    stats: {
      groupsTotal: groups.length,
      distinctBills: new Set(groups.flatMap((g) => g.bills)).size,
      rawCandidatePairs: groups.reduce((a, g) => a + (g.bills.length * (g.bills.length - 1)) / 2, 0),
    },
    groups,
  };

  mkdirSync("docs/data-analysis/case-law/payloads", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`groups: ${out.stats.groupsTotal}, distinct bills: ${out.stats.distinctBills}, raw candidate pairs: ${out.stats.rawCandidatePairs}`);
  console.log(`→ ${OUT}`);
}

main();
