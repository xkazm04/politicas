/* Context fetcher — what an analyst agent READS before analyzing a slice, instead
 * of having context hand-carried into its prompt. THE Lite-optional wrapper: the same
 * command, the same output shape, one flag choosing whether the DataHub Lite metalayer
 * is in the loop.
 *
 *   --mode=lite   (default) read the context from the DataHub Lite catalog (GMS).
 *   --mode=direct           assemble the SAME context locally from stats.json +
 *                           lib/analysis/context-model — no DataHub in the loop.
 *
 * Both arms return byte-identical CONTENT (asserted in lib/analysis/context-provider
 * .test.ts), so running the analysis loop once per mode measures the metalayer as a
 * DELIVERY mechanism. Set the arm per-run with the flag or CONTEXT_SOURCE=direct|lite.
 *
 *   # WITH the metalayer:
 *   npx tsx scripts/data-analysis/dh-context.ts --slice="psp-hlasovani×PSP10×vote_event"
 *   # WITHOUT it:
 *   npx tsx scripts/data-analysis/dh-context.ts --mode=direct --stats=./.data-analysis/stats.json \
 *       --slice="psp-hlasovani×PSP10×vote_event"
 *
 * Prints JSON: the slice's documentation + deterministic stats, its parent corpus
 * entity's field docs, the shared scoring rubric, upstream provenance, and the
 * coverage state of every sibling slice on that source.
 */
import { readFileSync } from "node:fs";

import {
  defaultContextMode,
  makeContextProvider,
  type ContextMode,
  type ContextProvider,
} from "@/lib/analysis/context-provider";
import type { SliceStats } from "@/lib/analysis/context-model";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function buildProvider(mode: ContextMode): ContextProvider {
  if (mode === "direct") {
    const statsPath = arg("stats", "./.data-analysis/stats.json");
    const { slices } = JSON.parse(readFileSync(statsPath, "utf8")) as { slices: SliceStats[] };
    return makeContextProvider({ mode: "direct", slices, env: arg("env", "PROD") });
  }
  const gms = arg("gms", process.env.DATAHUB_GMS_URL || "http://localhost:8080");
  return makeContextProvider({ mode: "lite", gms, env: arg("env", "PROD"), token: process.env.DATAHUB_TOKEN });
}

async function main() {
  let source = arg("source");
  let term = arg("term");
  let entity = arg("entity");
  const slice = arg("slice");
  if (slice) {
    const parts = slice.split(/[×x]/).map((p) => p.trim());
    [source, term, entity] = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  }
  if (!source || !term || !entity) {
    console.error('usage: [--mode=direct|lite] --slice="<source>×<term>×<entity>"  |  --source= --term= --entity=');
    process.exit(2);
  }

  const mode = (arg("mode") as ContextMode) || defaultContextMode();
  if (mode !== "direct" && mode !== "lite") {
    console.error(`--mode must be 'direct' or 'lite', got ${JSON.stringify(mode)}`);
    process.exit(2);
  }

  const provider = buildProvider(mode);
  const ctx = await provider.getSliceContext(source, term, entity);
  if (!ctx) {
    console.error(`slice not found via ${mode} arm: ${source}×${term}×${entity}`);
    process.exit(1);
  }
  console.log(JSON.stringify(ctx, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
