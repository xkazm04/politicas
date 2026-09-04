// Orchestrator persist — serialize a case-loop batch payload into the LIVE graph.
// Fleet loops emit validated payloads (props-merges only); the write-lock holder runs
// this with an assigned pass number (kernel §Provenance: {track, pass} in write order).
//
// Two payload shapes:
//   edges: { provenanceStamp:{track,method,ref,computedAt}, edges:[{src,rel,dst,propsMerge}] }
//   nodes: { proposals:[{id, props}] }  (track/ref via --track/--ref)
//
// Annotation provenance is NESTED IN PROPS (`<ns>_provenance`) — the row's identity
// provenance column is never clobbered (the analytical loop's enrichment pattern,
// e.g. contestedness_provenance pass 4). Only existing rows are touched: a payload
// entry whose target is missing is a hard error (fabrication guard), never an insert.
//
//   npx tsx scripts/case-loops/persist-batch.ts --payload=<file> --pass=<n> \
//     [--ns=<prefix>] [--track=<t>] [--ref=<r>] [--commit]

import { readFileSync } from "node:fs";
import { getStore } from "../../lib/db/store";
import { unregisteredKeys } from "../../lib/kg/propRegistry";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);

/**
 * Thread an army's per-claim `citations` into the graph as `<ns>_citations`.
 *
 * Batches 001–005 collected citations on every dossier and this writer silently
 * dropped them (it merged `props` only), so the surfaces could source a dossier
 * at field level but never link the individual claim to the page it came from —
 * a real gap for a platform whose brand rule is "every rendered number cites its
 * source" (found in the 2026-07-25 manifestation pass). Accepts the two shapes
 * payloads actually use: an array of strings/objects, or `{claim, url, accessedAt}`
 * records. Absent/empty ⇒ nothing written, so re-persisting an old payload is a
 * no-op rather than a spurious empty field.
 */
function citationsProp(ns: string, p: { citations?: unknown }): Record<string, unknown> {
  const c = p.citations;
  if (!Array.isArray(c) || c.length === 0) return {};
  return { [`${ns}_citations`]: c };
}

interface EdgePayload {
  provenanceStamp?: { track?: string; method?: string; ref?: string; computedAt?: string };
  edges?: {
    src: string;
    rel: string;
    dst: string;
    propsMerge: Record<string, unknown>;
    /** Per-claim sources the army collected; threaded in as `<ns>_citations`. */
    citations?: unknown[];
  }[];
}
interface NodePayload {
  proposals?: { id: string; props: Record<string, unknown>; citations?: unknown[] }[];
}


/** The writer's own conventions: never "new", whatever the namespace. */
const WRITER_OWN = /(_provenance|_citations)$/;

/**
 * Refuse keys the registry does not list — the one gate between "a batch wrote a key" and
 * "a surface reads it". Collected across the whole payload and reported once, so a
 * payload with three unknown keys fails with all three named, not one per run.
 */
function gatePropKeys(
  entries: Array<{ label: string; scope: { kind: string } | { rel: string }; props: Record<string, unknown> }>,
): void {
  const unknown = new Map<string, number>();
  for (const e of entries) {
    for (const k of unregisteredKeys(e.scope, e.props)) {
      if (WRITER_OWN.test(k)) continue;
      const tag = `${"kind" in e.scope ? `node:${e.scope.kind}` : `edge:${e.scope.rel}`}.${k}`;
      unknown.set(tag, (unknown.get(tag) ?? 0) + 1);
    }
  }
  if (unknown.size === 0) return;
  const lines = [...unknown].map(([k, n]) => `  ${k}  (${n} rows)`).join("\n");
  if (flag("allow-new-keys")) {
    console.warn(
      `prop-key gate: ${unknown.size} key(s) NOT in lib/kg/prop-registry.json — allowed by --allow-new-keys; ` +
        `ADD THEM to the registry + graph-schema.md in this change:\n${lines}`,
    );
    return;
  }
  throw new Error(
    `prop-key gate: ${unknown.size} key(s) NOT in lib/kg/prop-registry.json — refusing to write:\n${lines}\n` +
      `register them (and describe them in docs/data-analysis/graph-schema.md), or pass --allow-new-keys for a deliberate addition.`,
  );
}

async function main() {
  const file = arg("payload");
  const pass = Number(arg("pass"));
  if (!file || !Number.isFinite(pass) || pass <= 0) {
    console.error("usage: persist-batch.ts --payload=<file> --pass=<n> [--ns=..] [--track=..] [--ref=..] [--commit]");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as EdgePayload & NodePayload;
  const store = await getStore();
  if (!store) throw new Error("no store");

  const computedAt = new Date().toISOString();
  let written = 0;

  if (raw.edges?.length) {
    const stamp = raw.provenanceStamp ?? {};
    const ns = arg("ns") ?? "corroboration";
    const provenance = {
      track: arg("track") ?? stamp.track ?? "unknown",
      pass,
      method: stamp.method ?? "verdict",
      ref: arg("ref") ?? stamp.ref ?? file,
      // ENRICHMENT, not origin: this path merges props onto rows that already
      // exist and never touches their `provenance` column, so it names the
      // WRITER rather than claiming a source. That is what lets the sentinel's
      // per-layer uniformity check say which script a divergent bucket came from.
      writer: "persist-batch",
      computedAt,
    };
    const live = await store.listKgEdges({ rel: raw.edges[0].rel });
    const byKey = new Map(live.map((e) => [`${e.src} ${e.rel} ${e.dst}`, e]));
    const merged = raw.edges.map((p) => {
      const e = byKey.get(`${p.src} ${p.rel} ${p.dst}`);
      if (!e) throw new Error(`payload edge not in graph (refusing to insert): ${p.src} ${p.rel} ${p.dst}`);
      return {
        ...e,
        props: {
          ...e.props,
          ...p.propsMerge,
          ...citationsProp(ns, p),
          [`${ns}_provenance`]: provenance,
        },
      };
    });
    gatePropKeys(raw.edges.map((p) => ({ label: `${p.src} ${p.rel} ${p.dst}`, scope: { rel: p.rel }, props: p.propsMerge })));
    if (flag("commit")) written += await store.upsertKgEdges(merged);
    console.log(`${flag("commit") ? "COMMITTED" : "DRY-RUN"}: ${merged.length} ${raw.edges[0].rel} edges props-merged (ns=${ns}, track=${provenance.track}, pass ${pass})`);
  }

  if (raw.proposals?.length) {
    const ns = arg("ns") ?? "effort";
    const provenance = {
      track: arg("track") ?? ns,
      pass,
      method: "verdict",
      ref: arg("ref") ?? file,
      writer: "persist-batch",
      computedAt,
    };
    const live = await store.listKgNodes({});
    const byId = new Map(live.map((n) => [n.id, n]));
    const merged = raw.proposals.map((p) => {
      const n = byId.get(p.id);
      if (!n) throw new Error(`payload node not in graph (refusing to insert): ${p.id}`);
      return {
        ...n,
        props: { ...n.props, ...p.props, ...citationsProp(ns, p), [`${ns}_provenance`]: provenance },
      };
    });
    gatePropKeys(raw.proposals.map((p) => ({ label: p.id, scope: { kind: byId.get(p.id)!.kind }, props: p.props })));
    if (flag("commit")) written += await store.upsertKgNodes(merged);
    console.log(`${flag("commit") ? "COMMITTED" : "DRY-RUN"}: ${merged.length} nodes props-merged (ns=${ns}, track=${provenance.track}, pass ${pass})`);
  }

  if (!raw.edges?.length && !raw.proposals?.length) throw new Error("payload has neither edges nor proposals");
  if (flag("commit")) console.log(`rows written: ${written}`);
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
