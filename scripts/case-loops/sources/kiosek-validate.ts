/**
 * Case-loops batch-006, kiosek ingest — join-key validation against the REAL
 * graph, read-only, per the kernel's fleet rule (never touch live `.pglite`
 * for a read either while other loops may be writing to it — copy first).
 *
 * Reads docs/data-analysis/case-sources/kiosek-slice-extract.json (written by
 * kiosek-slice.ts) and checks how many of its extracted statute citations /
 * IČOs resolve to an EXISTING `law:sb:*` / `company:ico:*` node.
 *
 * Run (copy first, this script refuses to run against the live path):
 *   cp -r .pglite .pglite-copy-kiosek
 *   PGLITE_PATH=./.pglite-copy-kiosek npx tsx scripts/case-loops/sources/kiosek-validate.ts
 *   rm -rf .pglite-copy-kiosek
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getStore } from "@/lib/db/store";

const IN_PATH = "docs/data-analysis/case-sources/kiosek-slice-extract.json";
const OUT_PATH = "docs/data-analysis/case-sources/kiosek-validation.json";

async function main() {
  const target = process.env.PGLITE_PATH ? resolve(process.env.PGLITE_PATH) : "";
  const live = resolve(".pglite");
  if (!target || target === live) {
    throw new Error(
      `refusing to run without PGLITE_PATH pointed at a copy (fleet rule: never touch live ./.pglite) — resolved target was "${target || "(unset)"}", live is "${live}"`,
    );
  }

  const slice = JSON.parse(readFileSync(IN_PATH, "utf8")) as {
    distinctStatuteCitations: string[];
    distinctIcos: string[];
  };

  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const lawNodes = await store.listKgNodes({ kind: "law" });
  const companyNodes = await store.listKgNodes({ kind: "company" });
  const lawIds = new Set(lawNodes.map((n) => n.id));
  const companyIds = new Set(companyNodes.map((n) => n.id));

  const statuteHits = slice.distinctStatuteCitations.filter((id) => lawIds.has(id));
  const statuteMisses = slice.distinctStatuteCitations.filter((id) => !lawIds.has(id));

  const icoCompanyUrns = slice.distinctIcos.map((ico) => `company:ico:${ico}`);
  const icoHits = icoCompanyUrns.filter((id) => companyIds.has(id));
  const icoMisses = icoCompanyUrns.filter((id) => !companyIds.has(id));

  const result = {
    generatedAt: new Date().toISOString(),
    graphSize: { lawNodes: lawNodes.length, companyNodes: companyNodes.length },
    statuteJoinKey: {
      totalDistinctExtracted: slice.distinctStatuteCitations.length,
      resolvedToExistingLawNode: statuteHits.length,
      hitRate: slice.distinctStatuteCitations.length
        ? statuteHits.length / slice.distinctStatuteCitations.length
        : null,
      resolved: statuteHits,
      unresolved: statuteMisses,
    },
    icoJoinKey: {
      totalDistinctExtracted: slice.distinctIcos.length,
      resolvedToExistingCompanyNode: icoHits.length,
      hitRate: slice.distinctIcos.length ? icoHits.length / slice.distinctIcos.length : null,
      resolved: icoHits,
      unresolvedIcos: icoMisses.map((urn) => urn.replace("company:ico:", "")),
    },
  };

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`wrote ${OUT_PATH}`);
  console.log(
    `statute hit rate: ${statuteHits.length}/${slice.distinctStatuteCitations.length} (${(result.statuteJoinKey.hitRate! * 100).toFixed(1)}%)`,
  );
  console.log(
    `IČO hit rate: ${icoHits.length}/${slice.distinctIcos.length} (${(result.icoJoinKey.hitRate! * 100).toFixed(1)}%)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
