/* Promote an analysis pass into the store, respecting the loop's TWO-LEVEL design:
 *
 *   slice_quality   ← the DETERMINISTIC scorer (scoreSlice), per source×term×entity.
 *                     Subagent scores are NEVER written here; an LLM must not author
 *                     the numbers the product trusts. The verdicts are validated
 *                     against the deterministic composite and only ADVISORY findings
 *                     (patterns, gaps, backlog) travel alongside.
 *
 * Every verdict is run through the deterministic gate first, and its cited
 * entityIds are checked against the analyzed slice — a schema-legal but non-row id
 * (a field name, a slice-wide phrase) is rejected, never persisted.
 *
 * DEFAULT DRY-RUN. Pass --commit to write the deterministic slice_quality rows.
 *   DB_DRIVER=pglite npx tsx scripts/data-analysis/promote-verdicts.ts \
 *     --stats=<dir>/stats.json --verdicts=<dir>/verdicts [--commit]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";
import { parseAndValidateVerdict } from "@/lib/analysis/verdict";
import { QUALITY_TAXONOMY_VERSION } from "@/lib/analysis/quality";
import type { SliceStats } from "./slice-stats";
import type { SliceQualityRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function sliceStatsToRow(s: SliceStats): SliceQualityRow {
  return {
    slice: s.slice,
    source: s.source,
    term: s.term,
    entity: s.entity,
    scores: {
      completeness: s.criteria.completeness,
      freshness: s.criteria.freshness,
      categorization: s.criteria.categorization,
      validity: s.criteria.validity,
      richness: s.criteria.richness,
      volume: s.criteria.volume,
    },
    composite: s.composite,
    rowsTotal: s.rows,
    rowsValid: Math.round((s.pct.valid / 100) * s.rows),
    taxonomyVersion: QUALITY_TAXONOMY_VERSION,
    analyzedAt: new Date().toISOString(),
  };
}

async function main() {
  const statsPath = arg("stats", "./.data-analysis/stats.json");
  const verdictsDir = arg("verdicts", "./.data-analysis/verdicts");
  const commit = process.argv.includes("--commit");

  const store = await getStore();
  if (!store) {
    console.error("no store");
    process.exit(1);
  }

  const { slices } = JSON.parse(readFileSync(statsPath, "utf8")) as { slices: SliceStats[] };
  const rows = slices.map(sliceStatsToRow);
  console.log(`deterministic slice_quality rows: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.slice.padEnd(40)} composite ${r.composite}  (${r.rowsTotal} rows)`);

  // Validate any verdicts present and check their cited ids against the slice
  // row files. Verdicts do not author scores — they gate + annotate.
  let verdictCount = 0;
  const rejected: { file: string; entityId: string }[] = [];
  if (existsSync(verdictsDir)) {
    for (const file of readdirSync(verdictsDir).filter((f) => f.endsWith(".json") || f.endsWith(".txt"))) {
      const text = readFileSync(join(verdictsDir, file), "utf8");
      // Try to load the matching slice row file to enable id-membership checks.
      const parsed0 = parseAndValidateVerdict(text);
      const sliceId = parsed0.ok ? parsed0.value!.slice : "";
      const rowsFile = sliceId
        ? join(statsPath, "..", "rows", `${sliceId.replace(/×/g, "__").replace(/\//g, "-")}.json`)
        : "";
      let knownIds: string[] | undefined;
      if (rowsFile && existsSync(rowsFile)) {
        const rr: unknown = JSON.parse(readFileSync(rowsFile, "utf8"));
        if (Array.isArray(rr)) knownIds = rr.map((r) => (r as { id?: unknown }).id).filter((x): x is string => typeof x === "string");
      }
      const parsed = parseAndValidateVerdict(text, knownIds ? { knownEntityIds: knownIds } : {});
      if (!parsed.ok || !parsed.value) {
        console.log(`\n  DRIFT in ${file}: ${parsed.errors.slice(0, 3).join("; ")}`);
        continue;
      }
      verdictCount++;
      const v = parsed.value;
      // Cross-check the verdict's composite against the deterministic one.
      const det = rows.find((r) => r.slice === v.slice);
      if (det && Math.abs(det.composite - v.composite) > 0.6) {
        console.log(`  NOTE ${file}: verdict composite ${v.composite} deviates from deterministic ${det.composite}`);
      }
    }
  }
  console.log(`\nverdicts validated: ${verdictCount}${rejected.length ? ` · ${rejected.length} rejected ids` : ""}`);

  if (!commit) {
    console.log("\nDRY-RUN — pass --commit to write slice_quality.");
    return;
  }
  for (const r of rows) await store.upsertSliceQuality(r);
  const written = await store.listSliceQuality();
  console.log(`\ncommitted ${written.length} slice_quality rows.`);
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
