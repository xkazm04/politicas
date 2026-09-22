/*
 * THE MIGRATION PASS for the provenance contract (moonshot card #22).
 *
 *   npx tsx scripts/data-analysis/kg-provenance-backfill.ts              # dry run
 *   npx tsx scripts/data-analysis/kg-provenance-backfill.ts --pass=52 --commit
 *   PGLITE_PATH=./.pglite-copy npx tsx … --commit                        # a copy
 *
 * WHAT IT DOES. Walks every kg_node / kg_edge and derives {source, pass, ref,
 * writer} from what the row's `provenance` ALREADY HOLDS. Where that is
 * unambiguous — and for the contribution, law and money layers it is, because
 * their writers stamped a declared `ref` — the row gets a real source. Where it
 * is not, the row gets `source: "unknown"` and is COUNTED.
 *
 * WHY `unknown` RATHER THAN A BEST GUESS. Nine of these landings could be
 * assigned a plausible source by eye, and every one of those assignments would
 * be a claim about where data came from that nobody verified. `/atlas` is the
 * page whose whole subject is not making claims it cannot support; a migration
 * that filled it with plausible provenance would corrupt precisely the surface
 * it was meant to complete. So: derive what is derivable, count the rest, print
 * the number, and let it be burned down by re-running the writers.
 *
 * SAFETY, in the order it matters:
 *  1. DRY RUN IS THE DEFAULT. `--commit` is required to write anything.
 *  2. MERGE-PRESERVING. The row is read, its `provenance` is merged (legacy
 *     `method`/`computedAt`/`track` keys survive) and `props` are passed through
 *     BYTE-FOR-BYTE. `upsertKgNodes` does `props = excluded.props` — a wholesale
 *     replace — so a backfill that rebuilt props would erase every enrichment
 *     pass on the graph (memory/kg-upsert-replaces-props.md: kg-compute did
 *     exactly that to all 207 MPs). This one never constructs a props object.
 *  3. IT DOES NOT RESTAMP A ROW THAT IS ALREADY UNDER CONTRACT unless
 *     `--restamp` is passed: re-running it must be a no-op, not a churn.
 *  4. NEVER AGAINST THE LIVE STORE FROM A WORKTREE. Point PGLITE_PATH at a copy,
 *     or run it on the machine that owns `./.pglite` after `npm run db:backup`.
 *
 * The derivation itself (`deriveRowProvenance`) is PURE and exported, so the
 * counts a dry run prints are the counts a test can pin without a store.
 */

import { pathToFileURL } from "node:url";

import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import {
  isKgProvenance,
  makeProvenance,
  UNKNOWN_SOURCE,
  withProvenance,
  type KgProvenance,
} from "@/lib/kg/provenance";

const arg = (name: string, fallback = ""): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const flag = (name: string) => process.argv.includes(`--${name}`);

/**
 * ref prefix → {source, writer}, for the refs the origin writers actually
 * stamped. Every entry here is READ OFF the writer that produced it (the module
 * is named), never inferred from what a row looks like.
 */
const REF_RULES: ReadonlyArray<{ match: RegExp; source: string; writer: string; why: string }> = [
  {
    match: /^kg-compute:(person|party|organ)$/,
    source: "psp-poslanci",
    writer: "kg-compute",
    why: "kg-compute builds these three node kinds from mandates and organs",
  },
  {
    match: /^kg-compute:(co_votes_with|rebels_against|influential_in)$/,
    source: "psp-hlasovani",
    writer: "kg-compute",
    why: "kg-compute derives these three relations from roll-call ballots",
  },
  {
    match: /^psp-tisky$/,
    source: "psp-tisky-law",
    writer: "kg-legislation-ingest",
    why: "kg-legislation-ingest stamped the adapter's ref, not the atlas key",
  },
  {
    match: /^money-feed:/,
    source: "",
    writer: "kg-money-ingest",
    why: "the money feed lands two registries — resolved per kind/rel, not by ref",
  },
];

/** For `money-feed:` rows the ref alone is ambiguous; kind/rel is not. */
function moneySourceOf(scope: { kind?: string; rel?: string }): string | null {
  if (scope.kind === "contract" || scope.rel === "supplies") return "smlouvy-gov-cz";
  if (scope.kind === "company" || scope.rel === "linked_to") return "dataor-justice-cz";
  return null;
}

export type BackfillOutcome = "already-stamped" | "derived" | "unknown";

export interface BackfillDecision {
  outcome: BackfillOutcome;
  stamp: KgProvenance;
  /** The rule that decided it — printed, so a reader can audit the migration. */
  why: string;
}

/**
 * Decide one row's stamp from what it already carries. PURE.
 *
 * `pass` and `ref` are taken from the row when it has them; a row with neither
 * is not repaired into something plausible — it lands on pass 0 / ref
 * "unreconstructed", which reads as exactly what it is.
 */
export function deriveRowProvenance(
  row: { provenance?: unknown; kind?: string; rel?: string },
  opts: { restamp?: boolean } = {},
): BackfillDecision {
  const prov = (row.provenance ?? {}) as Record<string, unknown>;
  if (isKgProvenance(prov) && !opts.restamp) {
    return { outcome: "already-stamped", stamp: prov, why: "row already under contract" };
  }

  const ref = typeof prov.ref === "string" && prov.ref.trim() !== "" ? prov.ref : "unreconstructed";
  const pass = typeof prov.pass === "number" && Number.isInteger(prov.pass) ? prov.pass : 0;
  const rule = REF_RULES.find((r) => r.match.test(ref));

  let source = UNKNOWN_SOURCE;
  let writer = typeof prov.writer === "string" && prov.writer.trim() !== "" ? prov.writer : "unreconstructed";
  let why = `ref ${JSON.stringify(ref)} matches no writer's declared ref — counted as ${UNKNOWN_SOURCE}, never guessed`;

  if (rule) {
    writer = rule.writer;
    const resolved = rule.source || moneySourceOf(row);
    if (resolved) {
      source = resolved;
      why = rule.why;
    } else {
      why = `${rule.why}, and this row's kind/rel resolves neither — counted as ${UNKNOWN_SOURCE}`;
    }
  }

  return {
    outcome: source === UNKNOWN_SOURCE ? "unknown" : "derived",
    stamp: makeProvenance({
      source,
      pass,
      ref,
      writer,
      // Historical rows were written before graph passes opened ingest runs.
      // Attaching one now would put a row inside a seal that never covered it.
      ingestRunId: typeof prov.ingest_run_id === "number" ? prov.ingest_run_id : null,
    }),
    why,
  };
}

export interface BackfillReport {
  nodes: Record<BackfillOutcome, number>;
  edges: Record<BackfillOutcome, number>;
  /** Rows landing on `unknown`, grouped by the ref that could not be resolved. */
  unknownByRef: Array<{ ref: string; count: number }>;
  /** Rows landing on a real source, grouped by it. */
  derivedBySource: Array<{ source: string; count: number }>;
}

const emptyCounts = (): Record<BackfillOutcome, number> => ({
  "already-stamped": 0,
  derived: 0,
  unknown: 0,
});

/** Plan the whole migration without touching a store. PURE. */
export function planBackfill(
  nodes: ReadonlyArray<{ provenance?: unknown; kind?: string }>,
  edges: ReadonlyArray<{ provenance?: unknown; rel?: string }>,
  opts: { restamp?: boolean } = {},
): { report: BackfillReport; nodeStamps: KgProvenance[]; edgeStamps: KgProvenance[] } {
  const report: BackfillReport = {
    nodes: emptyCounts(),
    edges: emptyCounts(),
    unknownByRef: [],
    derivedBySource: [],
  };
  const unknownByRef = new Map<string, number>();
  const derivedBySource = new Map<string, number>();
  const nodeStamps: KgProvenance[] = [];
  const edgeStamps: KgProvenance[] = [];

  const tally = (
    decision: BackfillDecision,
    bucket: Record<BackfillOutcome, number>,
  ) => {
    bucket[decision.outcome] += 1;
    if (decision.outcome === "unknown") {
      unknownByRef.set(decision.stamp.ref, (unknownByRef.get(decision.stamp.ref) ?? 0) + 1);
    } else if (decision.outcome === "derived") {
      derivedBySource.set(decision.stamp.source, (derivedBySource.get(decision.stamp.source) ?? 0) + 1);
    }
  };

  for (const n of nodes) {
    const d = deriveRowProvenance(n, opts);
    tally(d, report.nodes);
    nodeStamps.push(d.stamp);
  }
  for (const e of edges) {
    const d = deriveRowProvenance(e, opts);
    tally(d, report.edges);
    edgeStamps.push(d.stamp);
  }

  const bySize = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  report.unknownByRef = [...unknownByRef].map(([ref, count]) => ({ ref, count })).sort(bySize);
  report.derivedBySource = [...derivedBySource].map(([source, count]) => ({ source, count })).sort(bySize);
  return { report, nodeStamps, edgeStamps };
}

export function renderBackfillReport(report: BackfillReport, commit: boolean): string {
  const lines: string[] = [];
  const total = (b: Record<BackfillOutcome, number>) => b["already-stamped"] + b.derived + b.unknown;
  lines.push(`\n== kg provenance backfill (${commit ? "COMMIT" : "DRY RUN"}) ==`);
  for (const [label, b] of [
    ["kg_node", report.nodes],
    ["kg_edge", report.edges],
  ] as const) {
    lines.push(
      `${label}: ${total(b)} rows — ${b.derived} derived · ${b.unknown} ${UNKNOWN_SOURCE} · ` +
        `${b["already-stamped"]} already under contract`,
    );
  }
  if (report.derivedBySource.length > 0) {
    lines.push("\nderived, per source:");
    for (const { source, count } of report.derivedBySource) lines.push(`  ${source.padEnd(24)} ${count}`);
  }
  if (report.unknownByRef.length > 0) {
    lines.push(`\n${UNKNOWN_SOURCE}, per unresolved ref — the number to burn down, printed:`);
    for (const { ref, count } of report.unknownByRef) lines.push(`  ${ref.padEnd(40)} ${count}`);
    lines.push(
      "  These are NOT a failure of the migration: no writer's declared ref matches them, so the honest\n" +
        "  stamp is the one that says so. Re-running the owning writer replaces it with a real source.",
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const commit = flag("commit");
  const restamp = flag("restamp");
  const limit = Number(arg("limit", "0")) || undefined;

  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH — and NEVER at the live store from a worktree)");
    process.exit(1);
  }

  const nodes = await store.listKgNodes(limit ? { limit } : {});
  const edges = await store.listKgEdges(limit ? { limit } : {});
  const { report, nodeStamps, edgeStamps } = planBackfill(nodes, edges, { restamp });
  console.log(renderBackfillReport(report, commit));

  if (!commit) {
    console.log("\nDRY RUN — nothing written. Add --commit (against a COPY first).");
    await store.close();
    return;
  }

  // MERGE-PRESERVING: `props` is passed through untouched and `provenance` is
  // merged, never replaced. This function must never construct a props object.
  const nodeRows: KgNodeRow[] = nodes.map((n, i) => ({
    ...n,
    provenance: withProvenance(n.provenance as Record<string, unknown> | null, nodeStamps[i]!),
  }));
  const edgeRows: KgEdgeRow[] = edges.map((e, i) => ({
    ...e,
    provenance: withProvenance(e.provenance as Record<string, unknown> | null, edgeStamps[i]!),
  }));

  const wroteNodes = await store.upsertKgNodes(nodeRows);
  const wroteEdges = await store.upsertKgEdges(edgeRows);
  console.log(`\nCOMMITTED: ${wroteNodes} kg_node · ${wroteEdges} kg_edge re-stamped (props untouched).`);
  await store.close();
}

const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
