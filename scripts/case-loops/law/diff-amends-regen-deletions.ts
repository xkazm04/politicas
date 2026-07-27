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
// batch-005/006 found 0 deletions. batch-007 finds its first genuine one:
const DELETION_ALLOWLIST: string[] = [
  // tisk 116 ("Návrh poslanců ... kterým se zrušuje zákon č. 353/2019 Sb., o výběru osob do
  // řídících a dozorčích orgánů právnických osob s majetkovou účastí státu") is a REPEAL bill,
  // not an amendment — its title-derived `amends` edge (bill:tisk:43226 -> law:sb:353-2019) was
  // wired by psp-legislation.ts's LAW_CITATION title extractor, which has no verb-semantics gate
  // (it takes the first "č. N/RRRR Sb." in the title regardless of "mění" vs "zrušuje"). Found by
  // the batch-007 independent audit (N-A) as a known-false edge the batch-007 census fix's
  // title-verb gate correctly zeroed at the census layer but the title_fallback UNION was still
  // re-adding; amends-regen-007.ts's pure-repeal-title gate now excludes it upstream too — this
  // allowlist entry is what lets the live 150-edge graph's existing (also false) copy of the same
  // edge be REMOVED rather than refused by the deletion-safety gate.
  "bill:tisk:43226|law:sb:353-2019",
  // tisk 129 ("... na vydání zákona, kterým se zrušuje zákon č. 223/2016 Sb., o prodejní době v
  // maloobchodě") — same class as tisk 116, a pure-repeal bill title. Found by the batch-007
  // reflection pass (its title verb sits past the graph's 200-char label truncation, so a
  // title-regex gate alone missed it) — closed instead at the census layer (NON_AMEND_ART_HEADING_RE
  // / REPEAL_MARKER now correctly zero this bill's Čl. I "Zrušují se: 1. Zákon č. 223/2016 Sb."
  // block). The live edge (bill:tisk:43250 -> law:sb:223-2016) predates this batch and is false.
  "bill:tisk:43250|law:sb:223-2016",
  // tisk 231 ("... kterým se mění zákon č. 483/1991 Sb. ... a zákon č. 484/1991 Sb. ... a kterým
  // se zrušuje zákon č. 348/2005 Sb.") — a MIXED title carrying both real amend targets (kept:
  // 483/1991, 484/1991) and one repeal target (348/2005 — its ČÁST ČTVRTÁ "ZRUŠOVACÍ USTANOVENÍ"
  // block, found by the reflection pass). The live edge (bill:tisk:43353 -> law:sb:348-2005)
  // predates this batch and is false; the two real edges for this bill are unaffected.
  "bill:tisk:43353|law:sb:348-2005",
  // tisk 64 (a ~150-part omnibus) — its `Čl. CXLIII "Přechodné ustanovení"` companion article
  // cites 25/2017 (the predecessor act being effectively superseded by new provisions this bill
  // inserts into 23/2017) in a transitional context, and its later `Čl. CLIX "Zrušovací
  // ustanovení"` formally repeals 25/2017 outright — neither is an amendment; the bill's REAL
  // target at that point is 23/2017 (amended two articles earlier at Čl. CXLII, kept). Found by
  // the reflection pass (the exact class batch-006 found once on tisk 6 -> 424/1991, recurring
  // here one level deeper, inside an otherwise-real Čl.-organised bill). The live edge
  // (bill:tisk:43171 -> law:sb:25-2017) predates this batch and is false.
  "bill:tisk:43171|law:sb:25-2017",
  // batch-008 F2 (5 edges, docs/data-analysis/case-law/batch-007-round2-audit.md's F2 finding,
  // re-verified per-edge from cached text — see docs/data-analysis/case-law/payloads/
  // batch-008-f2-deletion-payload.json for the full evidence excerpts). All 5 are false public
  // claims already live in the 150-edge graph, reached via the title-derived `amended_laws` prop
  // with no verb-semantics/nesting gate:
  // tisk 153 -> 468/1991: the ref names 468/1991 only inside 40/1995's OWN official law name
  // ("zákon č. 40/1995 Sb., o regulaci reklamy a o změně a doplnění zákona č. 468/1991 Sb.") — the
  // bill's operative text then DELETES that very name phrase, never amends 468/1991 itself.
  "bill:tisk:43274|law:sb:468-1991",
  // tisk 88 -> 360/2025: "ve znění zákona č. 360/2025 Sb." — a lineage citation dating the bill's
  // real target (151/2025, kept); 360/2025 is not itself amended by this bill.
  "bill:tisk:43198|law:sb:360-2025",
  // tisk 124 -> 300/2025: "ve znění zákona č. 300/2025 Sb." — same lineage pattern, dating the
  // bill's second real target (152/2025, kept).
  "bill:tisk:43239|law:sb:300-2025",
  // tisk 36 -> 89/2012: nested inside the bill's real target's OWN name — "zákon č. 268/2025 Sb.,
  // kterým se mění zákon č. 89/2012 Sb." — 268/2025 (kept) is the amended act; 89/2012 describes
  // what 268/2025 itself is, not a second bill target.
  "bill:tisk:43143|law:sb:89-2012",
  // tisk 42 -> 416/2009: same nested-name shape — "zákon č. 465/2023 Sb., kterým se mění zákon č.
  // 416/2009 Sb." (465/2023 kept as the real target).
  "bill:tisk:43149|law:sb:416-2009",
];

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
