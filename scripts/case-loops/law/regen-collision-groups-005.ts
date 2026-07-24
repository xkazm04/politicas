/* Case ③ Law loop — batch-005: regenerate collision-groups.json from the POST-INGEST/POST-REGEN
 * 574-edge amends topology (batch-005-amends-regen.json), on the working copy only. Same grouping
 * rule as the original (batch-002) collision-groups.json: group bills by the law they amend,
 * keep groups with >=2 bills (only those can possibly collide on a shared §). Read-only against
 * the copy — reads law node labels/titles, does not write anything.
 *
 *   PGLITE_PATH=./.pglite-copy-law-005 npx tsx scripts/case-loops/law/regen-collision-groups-005.ts
 * → docs/data-analysis/case-law/payloads/collision-groups-005.json
 */
import { readFileSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const REGEN_PAYLOAD = "docs/data-analysis/case-law/payloads/batch-005-amends-regen.json";
const OUT = "docs/data-analysis/case-law/payloads/collision-groups-005.json";

interface RegenEdge {
  from: string;
  to: string;
  ref: string;
}
interface RegenPayload {
  edges: RegenEdge[];
  perBillLog: { billNodeId: string; cislo: number }[];
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the batch-005 copy");
  const laws = await store.listKgNodes({ kind: "law" });
  const lawById = new Map(laws.map((n) => [n.id, n]));

  const payload: RegenPayload = JSON.parse(readFileSync(REGEN_PAYLOAD, "utf8"));
  const cisloByBillId = new Map(payload.perBillLog.map((b) => [b.billNodeId, b.cislo]));

  const byLaw = new Map<string, Set<number>>();
  for (const e of payload.edges) {
    const cislo = cisloByBillId.get(e.from);
    if (cislo === undefined) continue;
    const set = byLaw.get(e.to) ?? new Set<number>();
    set.add(cislo);
    byLaw.set(e.to, set);
  }

  const groups = [...byLaw.entries()]
    .filter(([, bills]) => bills.size >= 2)
    .map(([lawId, bills]) => {
      const lawNode = lawById.get(lawId);
      const ref = String((lawNode?.props as Record<string, unknown> | undefined)?.ref ?? lawId);
      return {
        lawUrn: lawId,
        lawRef: ref,
        lawTitle: lawNode?.label ?? `zákon č. ${ref} Sb.`,
        bills: [...bills].sort((a, b) => a - b),
      };
    })
    .sort((a, b) => b.bills.length - a.bills.length);

  const totalPairs = groups.reduce((a, g) => a + (g.bills.length * (g.bills.length - 1)) / 2, 0);
  const singleBillLaws = [...byLaw.values()].filter((s) => s.size === 1).length;

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      "batch-005: same grouping rule as the original collision-groups.json (bills sharing an amended law, group size >= 2), regenerated from the 574-edge post-ingest/post-regen amends topology (batch-005-amends-regen.json) instead of the live 150-edge graph.",
    sourceEdges: REGEN_PAYLOAD,
    stats: {
      distinctAmendedLaws: byLaw.size,
      lawsWithSingleAmendingBill: singleBillLaws,
      groupsWithMultipleBills: groups.length,
      totalCandidateBillPairs: totalPairs,
    },
    groups,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");
  console.log(`distinct amended laws: ${byLaw.size} (${singleBillLaws} single-bill, ${groups.length} multi-bill groups)`);
  console.log(`total candidate bill-pairs (sum of C(n,2) per group): ${totalPairs}`);
  console.log(`→ ${OUT}`);
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
