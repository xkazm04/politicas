/* Case ③ Law loop — batch-005: deletion-diff gate for the amends regen (P44/D1, edge-topology
 * form). batch-004's reflection found `validate-amends-regen.ts` is structurally blind to
 * deletions — every check it runs is forward-facing (id membership, dedup, no-fabrication) and
 * none of them can see a live edge the regen silently drops. This script closes that gap: it
 * reads the LIVE `./.pglite` amends edges (read-only — never opens the copy or writes anything)
 * and diffs them against the regen payload's edge set by (from,to) key. Any live edge NOT present
 * in the regen output is a proposed DELETION and must be explicitly allowlisted before the
 * orchestrator applies the regen; an unallowlisted deletion is a hard FAIL.
 *
 *   PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/diff-amends-regen-deletions.ts \
 *     --payload=docs/data-analysis/case-law/payloads/batch-005-amends-regen.json
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const arg = (name: string, fb = ""): string => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};

// Allowlist: (from,to) keys the orchestrator has explicitly reviewed and approved for deletion.
// EMPTY by design — batch-005 found 0 deletions (see below); any future regen with a genuine
// deletion must add an entry here with a one-line justification, reviewed BEFORE applying.
const DELETION_ALLOWLIST: string[] = [];

async function main() {
  const payloadPath = arg("payload", "docs/data-analysis/case-law/payloads/batch-005-amends-regen.json");
  const store = await getStore();
  if (!store) throw new Error("no store");

  const liveEdges = (await store.listKgEdges()).filter((e) => e.rel === "amends");
  const liveKeys = new Set(liveEdges.map((e) => `${e.src}|${e.dst}`));

  const payload: { edges: { from: string; to: string; ref: string }[] } = JSON.parse(readFileSync(payloadPath, "utf8"));
  const regenKeys = new Set(payload.edges.map((e) => `${e.from}|${e.to}`));

  const dropped = [...liveKeys].filter((k) => !regenKeys.has(k));
  const added = [...regenKeys].filter((k) => !liveKeys.has(k));
  const unallowlisted = dropped.filter((k) => !DELETION_ALLOWLIST.includes(k));

  console.log(`live amends edges: ${liveEdges.length}`);
  console.log(`regen payload edges: ${payload.edges.length}`);
  console.log(`added (in regen, not live): ${added.length}`);
  console.log(`dropped (in live, not regen): ${dropped.length}`);
  if (dropped.length > 0) {
    for (const k of dropped) console.log(`  DROP: ${k}${DELETION_ALLOWLIST.includes(k) ? " [allowlisted]" : " [NOT ALLOWLISTED]"}`);
  }

  const ok = unallowlisted.length === 0;
  console.log(`\nDIFF-AMENDS-REGEN-DELETIONS: ${ok ? "PASS" : "FAIL"} — ${unallowlisted.length} unallowlisted deletion(s).`);
  await store.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
