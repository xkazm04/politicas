/* Money loop — batch 004, Q-money-11 (TOP priority): the "OSVČ" false-edge purge.
 *
 * IČO 04627695 (Agrární demokratická strana, a registered micro political party) has
 * ARES `obchodniJmeno` = the literal junk string "OSVČ" ("self-employed person" — a
 * category label, not a company name). `pickExactIco` (lib/analysis/money-feed.ts)
 * did an exact-name match after ARES search, so every MP whose Hlídač private-role
 * event listed their occupation loosely as "OSVČ" got exact-matched to this ONE
 * unrelated party — 49 of 260 `linked_to` edges, all annotated `false_edge_suspected`
 * in pass 21 (see docs/data-analysis/contradictions.md C10, docs/data-analysis/
 * graph-log.md "Pass 21"). All 49 carry `contractCzk: 0`, so no money totals were
 * inflated — but they are false accusatory person→company edges against real sitting
 * MPs. The ingest-side fix (a GENERIC_NAME_BLACKLIST in money-feed.ts) prevents
 * recurrence; THIS script purges the 49 that already exist.
 *
 * FLEET MODE — PREPARE, DON'T EXECUTE. This script:
 *   - defaults to dry-run (no flags, or an explicit --dry-run, NEVER writes)
 *   - only --commit performs a live delete, and even then only against whatever
 *     PGLITE_PATH points at — it is the CALLER's responsibility never to point that
 *     at ./.pglite (the live DB) or another case's .pglite-copy-*. This script does
 *     not default PGLITE_PATH itself; lib/db/config.ts's pglitePath() does that
 *     (falls back to ./.pglite when unset — so an operator MUST set PGLITE_PATH
 *     before using --commit for real).
 *
 * Identifies the purge set by QUERYING the store, never by hardcoding "49":
 *   (a) every `linked_to` edge with dst = "company:ico:04627695"
 *   (b) SAFETY GATE: only edges annotated `props.false_edge_suspected === true` are
 *       included in the delete set — any edge to that company NOT so annotated is
 *       excluded and a loud warning is printed (never silently swept up)
 *   (c) the company node `company:ico:04627695` itself is only queued for deletion
 *       if NOTHING ELSE references it (no `supplies` edges where it's src, no other
 *       `linked_to` edges besides the 49 confirmed ones) — checked via
 *       store.listKgEdges(), not assumed.
 *
 * Always writes the payload/listing to
 *   docs/data-analysis/case-money/payloads/batch-004-osvc-purge.json
 * (dry-run AND commit — a durable artifact for the orchestrator, not just console
 * output). Does NOT touch ledger.md/ledger.json/handoff.md — that's the driver's job.
 *
 *   # dry-run against a copy (default; never writes):
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/purge-osvc.ts
 *
 *   # live delete — ONLY ever point PGLITE_PATH at an isolated copy/fixture you own:
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/purge-osvc.ts --commit
 *
 * Flags: --commit (opt-in write; default is dry-run, same convention as kg-money-ingest.ts)
 */
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow } from "@/lib/db/types";

const TARGET_ICO_NODE = "company:ico:04627695";
const TARGET_REL = "linked_to";
const PAYLOAD_PATH = "docs/data-analysis/case-money/payloads/batch-004-osvc-purge.json";

const flag = (name: string) => process.argv.includes(`--${name}`);

interface PurgePayload {
  batch: 4;
  track: "money";
  item: "Q-money-11";
  kind: "osvc-false-edge-purge";
  generatedAt: string;
  edgesToDelete: { src: string; dst: string }[];
  nodeToDelete: string | null;
  dryRunOutput: string;
  counts: {
    edgesMatchingTarget: number;
    edgesConfirmedFalseEdgeSuspected: number;
    edgesExcludedNotAnnotated: number;
    nodeQualifiesForDeletion: boolean;
    otherReferencesToNode: number;
  };
}

async function main() {
  const commit = flag("commit");
  // Orchestrator safety gate (batch-004 Opus condition): a --commit that would land on
  // the DEFAULT live ./.pglite (PGLITE_PATH unset) must be doubly deliberate.
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Either point PGLITE_PATH at a copy/fixture, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }
  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH to a copy/fixture — never the live ./.pglite)");
    process.exit(1);
  }

  console.log(`OSVČ purge (batch 004, Q-money-11) · ${commit ? "COMMIT" : "DRY-RUN"}\n`);

  // (a) every linked_to edge pointing at the bogus company — QUERY, don't hardcode 49.
  const linkedToTarget = await store.listKgEdges({ rel: TARGET_REL, limit: 2_000_000 });
  const candidateEdges = linkedToTarget.filter((e) => e.dst === TARGET_ICO_NODE);
  console.log(`edges matching dst=${TARGET_ICO_NODE}: ${candidateEdges.length}`);
  if (candidateEdges.length !== 49) {
    console.log(
      `  ⚠ LIVE SIGNAL: expected 49 (pass-21 count) but found ${candidateEdges.length} — ` +
        `population drifted since pass 21; proceeding on the ACTUAL query result, not the historical figure.`,
    );
  }

  // (b) safety gate: only edges CONFIRMED false_edge_suspected go in the delete set.
  const isFalseEdgeSuspected = (e: KgEdgeRow) => (e.props as Record<string, unknown> | null)?.false_edge_suspected === true;
  const confirmed = candidateEdges.filter(isFalseEdgeSuspected);
  const notAnnotated = candidateEdges.filter((e) => !isFalseEdgeSuspected(e));
  console.log(`  confirmed false_edge_suspected: ${confirmed.length}`);
  if (notAnnotated.length) {
    console.log(
      `  ⚠⚠ WARNING: ${notAnnotated.length} edge(s) to ${TARGET_ICO_NODE} are NOT annotated ` +
        `false_edge_suspected — EXCLUDED from the purge set (never silently swept up):`,
    );
    for (const e of notAnnotated) console.log(`      ${e.src} → ${e.dst} (props: ${JSON.stringify(e.props)})`);
  } else {
    console.log(`  no unannotated edges found — all candidates are confirmed false_edge_suspected.`);
  }

  // (c) does the node qualify for deletion? Check EVERY other edge referencing it —
  // any linked_to edge to it beyond the confirmed set, or any supplies edge where it's
  // the src (or dst, for completeness) — via a full edge scan, not an assumption.
  const allEdges = await store.listKgEdges({ limit: 2_000_000 });
  const confirmedKeys = new Set(confirmed.map((e) => `${e.src}|${e.rel}|${e.dst}`));
  const otherReferences = allEdges.filter(
    (e) =>
      (e.src === TARGET_ICO_NODE || e.dst === TARGET_ICO_NODE) &&
      !confirmedKeys.has(`${e.src}|${e.rel}|${e.dst}`),
  );
  const nodeQualifies = otherReferences.length === 0;
  console.log(`\nother edges referencing ${TARGET_ICO_NODE} (beyond the confirmed purge set): ${otherReferences.length}`);
  if (otherReferences.length) {
    console.log(`  node ${TARGET_ICO_NODE} does NOT qualify for deletion — still referenced:`);
    for (const e of otherReferences.slice(0, 20)) console.log(`      ${e.src} --${e.rel}--> ${e.dst}`);
  } else {
    console.log(`  node ${TARGET_ICO_NODE} qualifies for deletion — nothing else references it.`);
  }

  const nodeToDelete = nodeQualifies ? TARGET_ICO_NODE : null;
  const edgesToDelete = confirmed.map((e) => ({ src: e.src, dst: e.dst }));

  const summaryLines = [
    `edges matching dst=${TARGET_ICO_NODE}: ${candidateEdges.length}`,
    `edges confirmed false_edge_suspected (to delete): ${confirmed.length}`,
    `edges excluded (not annotated): ${notAnnotated.length}`,
    `node ${TARGET_ICO_NODE} qualifies for deletion: ${nodeQualifies}`,
    `other references to node: ${otherReferences.length}`,
  ];
  const dryRunOutput = summaryLines.join(" | ");

  console.log(`\n=== SUMMARY ===`);
  for (const l of summaryLines) console.log(`  ${l}`);
  console.log(`\nfull delete listing (${edgesToDelete.length} edges):`);
  for (const e of edgesToDelete) console.log(`  ${e.src} → ${e.dst}`);

  const payload: PurgePayload = {
    batch: 4,
    track: "money",
    item: "Q-money-11",
    kind: "osvc-false-edge-purge",
    generatedAt: new Date().toISOString(),
    edgesToDelete,
    nodeToDelete,
    dryRunOutput,
    counts: {
      edgesMatchingTarget: candidateEdges.length,
      edgesConfirmedFalseEdgeSuspected: confirmed.length,
      edgesExcludedNotAnnotated: notAnnotated.length,
      nodeQualifiesForDeletion: nodeQualifies,
      otherReferencesToNode: otherReferences.length,
    },
  };

  const fs = await import("node:fs/promises");
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(PAYLOAD_PATH, JSON.stringify(payload, null, 2));
  console.log(`\npayload written: ${PAYLOAD_PATH}`);

  if (commit) {
    console.log(`\n--commit passed — performing the live delete...`);
    const edgeKeys = confirmed.map((e) => ({ src: e.src, rel: e.rel, dst: e.dst }));
    const deletedEdges = await store.deleteKgEdges(edgeKeys);
    console.log(`  deleted ${deletedEdges} kg_edge row(s)`);
    let deletedNodes = 0;
    if (nodeToDelete) {
      deletedNodes = await store.deleteKgNodes([nodeToDelete]);
      console.log(`  deleted ${deletedNodes} kg_node row(s) (${nodeToDelete})`);
    } else {
      console.log(`  node ${TARGET_ICO_NODE} NOT deleted (still referenced or none queued)`);
    }
    console.log(`\nCOMMITTED: ${deletedEdges} edges + ${deletedNodes} node(s) deleted.`);
  } else {
    console.log(`\nDRY-RUN: nothing written to the store. Re-run with --commit (against an isolated copy) to apply.`);
  }

  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
