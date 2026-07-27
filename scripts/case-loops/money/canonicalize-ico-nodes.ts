/* Money loop — batch 009, Q-money-18: IČO id-convention drift in the ownership slice.
 *
 * The company population's canonical identity is `company:ico:<8-digit zero-padded IČO>`
 * (a Czech IČO is always 8 digits; 207/215 nodes and 100% of contract `supplierIco`
 * values follow it). Batch-006's `owns_stake` slice wrote its 19 new parent nodes
 * straight from the dataor export WITHOUT zero-padding, producing 8 malformed nodes:
 *
 *   company:ico:11835 (DEZA), :1350 (ČSOB), :254843 (Město Ostrov), :274046
 *   (Statutární město Pardubice), :2867681 (IF Holding), :64581 (HLAVNÍ MĚSTO PRAHA),
 *   :6947 (Ministerstvo financí), :75370 (Město Plzeň)
 *
 * Two consequences, both real:
 *   1. **A split identity.** `company:ico:2867681` (IF Holding a.s.) DUPLICATES the
 *      canonical `company:ico:02867681`, which is MP-tied via `linked_to` and is the
 *      DST of one `owns_stake` edge — while the malformed twin is the SRC of another.
 *      IF Holding's ownership chain is therefore SEVERED across two node identities,
 *      and any multi-hop traversal (batch 009's whole breadth-2 question) silently
 *      stops there.
 *   2. **Every future IČO join against these 8 is a guaranteed false negative** —
 *      including batch-009's own parent-contract-exposure check, which compared these
 *      unpadded values against 8-padded `supplierIco`s.
 *
 * This script canonicalizes them: upsert each node under its padded id (carrying the
 * original props with a padded `ico`, plus a provenance annotation), re-create its
 * incident edges under the canonical endpoint, then delete the old edges and the old
 * node. Where a canonical twin already exists (IF Holding), the malformed node's props
 * are MERGED into it rather than overwriting — the canonical node is the survivor.
 *
 * Touches ONLY company nodes and `owns_stake` edges. Never a `linked_to` edge, never a
 * `review_state`. Verifies before deleting that no edge of any relation still points at
 * the malformed id.
 *
 * Default is DRY-RUN. `--commit` writes; `--commit` with PGLITE_PATH unset (i.e.
 * targeting the live ./.pglite) additionally requires `--confirm-live` — same gate as
 * purge-osvc.ts / migrate-review-audit-check.ts.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b9 npx tsx scripts/case-loops/money/canonicalize-ico-nodes.ts
 *   PGLITE_PATH=./.pglite-copy-money-b9 npx tsx scripts/case-loops/money/canonicalize-ico-nodes.ts --commit
 */
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const PAYLOAD_PATH = "docs/data-analysis/case-money/payloads/batch-009-ico-canonicalization.json";
const ALL_RELS = ["linked_to", "owns_stake", "supplies", "cites", "concerns", "amends"] as const;

const flag = (name: string) => process.argv.includes(`--${name}`);
const padIco = (ico: string) => ico.padStart(8, "0");

interface Move {
  from: string;
  to: string;
  label: string;
  ico: string;
  paddedIco: string;
  canonicalExisted: boolean;
  edges: { src: string; rel: string; dst: string }[];
}

async function main() {
  const commit = flag("commit");
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Either point PGLITE_PATH at a copy/fixture, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }

  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH)");
  const fs = await import("node:fs/promises");

  console.log(`IČO canonicalization (batch 009, Q-money-18) · ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log(`  target data dir: ${process.env.PGLITE_PATH || "./.pglite"}\n`);

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const byId = new Map(companies.map((c) => [c.id, c]));

  // Identify the malformed set by QUERYING, never by hardcoding the list.
  const malformed = companies.filter((c) => {
    const ico = String((c.props as Record<string, unknown>)?.ico ?? "");
    return ico.length > 0 && ico.length < 8;
  });
  console.log(`malformed company nodes (ico shorter than 8 digits): ${malformed.length}`);

  // Every edge in the graph, so we can find (and later verify the absence of) references.
  const edgesByRel = new Map<string, KgEdgeRow[]>();
  for (const rel of ALL_RELS) edgesByRel.set(rel, await store.listKgEdges({ rel, limit: 200_000 }));
  const allEdges = [...edgesByRel.values()].flat();

  const moves: Move[] = [];
  const nodeUpserts: KgNodeRow[] = [];
  const edgeUpserts: KgEdgeRow[] = [];
  const edgeDeletes: { src: string; rel: string; dst: string }[] = [];
  const nodeDeletes: string[] = [];
  const refusals: string[] = [];

  for (const node of malformed) {
    const ico = String((node.props as Record<string, unknown>)?.ico ?? "");
    const padded = padIco(ico);
    const canonicalId = `company:ico:${padded}`;
    if (node.id !== `company:ico:${ico}`) {
      refusals.push(`${node.id}: id does not match its own ico prop (${ico}) — not a pure padding drift, skipped for manual review`);
      continue;
    }
    const existing = byId.get(canonicalId);
    const incident = allEdges.filter((e) => e.src === node.id || e.dst === node.id);

    // SAFETY: this batch only knows how to move ownership edges. A `linked_to`
    // (accusatory, human-gated) edge on a malformed node is refused outright.
    const gated = incident.filter((e) => e.rel === "linked_to");
    if (gated.length) {
      refusals.push(`${node.id}: ${gated.length} human-gated linked_to edge(s) incident — REFUSED, a gated tie is never moved by a script`);
      continue;
    }

    // The canonical node: merge (existing props win on conflict — it is the survivor),
    // carrying a provenance annotation of the merge.
    const mergedProps: Record<string, unknown> = {
      ...((node.props ?? {}) as Record<string, unknown>),
      ...((existing?.props ?? {}) as Record<string, unknown>),
      ico: padded,
      ico_canonicalized: {
        track: "money",
        pass: 9,
        method: "batch-009 Q-money-18: zero-pad IČO to the population's 8-digit canonical form",
        ref: `merged from ${node.id}${existing ? " into a pre-existing canonical node" : ""}`,
        computedAt: new Date().toISOString().slice(0, 10),
      },
    };
    nodeUpserts.push({
      ...(existing ?? node),
      id: canonicalId,
      kind: "company",
      label: existing?.label ?? node.label,
      props: mergedProps,
    } as KgNodeRow);

    for (const e of incident) {
      const src = e.src === node.id ? canonicalId : e.src;
      const dst = e.dst === node.id ? canonicalId : e.dst;
      if (src === dst) {
        // A self-loop would be created by the merge — drop it, don't persist nonsense.
        refusals.push(`${node.id}: edge ${e.rel} would become a self-loop on ${canonicalId} after merge — dropped`);
        edgeDeletes.push({ src: e.src, rel: e.rel, dst: e.dst });
        continue;
      }
      edgeUpserts.push({ ...e, src, dst } as KgEdgeRow);
      edgeDeletes.push({ src: e.src, rel: e.rel, dst: e.dst });
    }

    nodeDeletes.push(node.id);
    moves.push({
      from: node.id,
      to: canonicalId,
      label: node.label,
      ico,
      paddedIco: padded,
      canonicalExisted: Boolean(existing),
      edges: incident.map((e) => ({ src: e.src, rel: e.rel, dst: e.dst })),
    });

    console.log(
      `  ${node.id} → ${canonicalId}  ${node.label}` +
        `${existing ? "  [MERGE into existing canonical node]" : ""}  (${incident.length} edge(s) re-pointed)`,
    );
  }

  if (refusals.length) {
    console.log(`\nREFUSED / dropped (${refusals.length}):`);
    for (const r of refusals) console.log(`    ${r}`);
  }

  console.log(
    `\nplan: ${nodeUpserts.length} canonical node upsert(s) · ${edgeUpserts.length} edge re-point(s) · ` +
      `${edgeDeletes.length} old edge delete(s) · ${nodeDeletes.length} malformed node delete(s)`,
  );

  let applied = false;
  if (commit && moves.length) {
    console.log(`\n--commit passed — applying...`);
    // Order matters: create the canonical nodes and edges FIRST, so no moment exists
    // where an edge references a node that has already been deleted.
    const n = await store.upsertKgNodes(nodeUpserts);
    const m = await store.upsertKgEdges(edgeUpserts);
    const de = await store.deleteKgEdges(edgeDeletes);
    // Verify nothing still references the malformed ids before deleting the nodes.
    const after = (
      await Promise.all(ALL_RELS.map((rel) => store.listKgEdges({ rel, limit: 200_000 })))
    ).flat();
    const stillReferenced = nodeDeletes.filter((id) => after.some((e) => e.src === id || e.dst === id));
    if (stillReferenced.length) {
      console.log(`  ⚠ NOT deleting ${stillReferenced.length} node(s) — edges still reference them: ${stillReferenced.join(", ")}`);
    }
    const deletable = nodeDeletes.filter((id) => !stillReferenced.includes(id));
    const dn = await store.deleteKgNodes(deletable);
    console.log(`  upserted ${n} node(s), ${m} edge(s); deleted ${de} old edge(s), ${dn} malformed node(s)`);
    applied = true;
  } else if (!commit) {
    console.log(`\nDRY-RUN: nothing written. Re-run with --commit to apply.`);
  }

  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(
    PAYLOAD_PATH,
    JSON.stringify(
      {
        batch: 9,
        track: "money",
        item: "Q-money-18",
        kind: "ico-id-canonicalization",
        generatedAt: new Date().toISOString(),
        dryRun: !commit,
        applied,
        note:
          "Company identity is `company:ico:<8-digit zero-padded IČO>`. Batch-006's ownership slice wrote 8 " +
          "unpadded nodes, one of which (IF Holding a.s.) duplicated an existing canonical node and severed its " +
          "ownership chain. Touches only company nodes and non-gated edges; refuses to move any `linked_to` tie.",
        moves,
        refusals,
        counts: {
          malformedFound: malformed.length,
          moved: moves.length,
          edgeRepoints: edgeUpserts.length,
          nodeDeletes: nodeDeletes.length,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\npayload written: ${PAYLOAD_PATH}`);
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
