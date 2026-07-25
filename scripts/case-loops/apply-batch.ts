/* Case loops — BATCH 007: the generalized insert-capable writer.
 *
 * `persist-batch.ts` (shared, out of this batch's boundary) is deliberately
 * props-merge-only: any payload entry whose target isn't already live is a hard
 * error, never an insert. That refusal is a real fabrication guard (it has caught
 * real errors) — this script does NOT weaken it. It builds the missing capability
 * batch-006's law case needed once already (`law/apply-amends-regen.ts`, the
 * template this generalizes): a writer that CAN insert brand-new nodes/edges, with
 * every one of the safety properties persist-batch already has, plus the two new
 * ones an insert path needs that a merge-only path doesn't:
 *
 *   1. NODE-THEN-EDGE ORDERING. An edge whose endpoint (src or dst) is neither an
 *      already-live node NOR a node this same run is about to create is a HARD
 *      ERROR that refuses the entire run before anything is written — never a
 *      silently-skipped edge (a case loop that "mostly" ran and quietly dropped
 *      some edges is worse than one that refused outright: the omission would
 *      look like an honest negative from every downstream consumer).
 *   2. PROVENANCE PRESERVATION. Merging onto a pre-existing node/edge NEVER
 *      touches its identity `provenance` column — only a nested, namespaced note
 *      (`props.apply_batch_<key>`) is added, same convention as
 *      `persist-batch.ts`'s `<ns>_provenance` and `apply-amends-regen.ts`'s D4 fix.
 *      A brand-NEW row gets the payload's own provenance with the real `--pass`
 *      substituted for the payload's placeholder `pass: null`.
 *   3. DELETION ALLOWLIST. Nothing is ever deleted unless it is BOTH (a) listed in
 *      this file's `DELETION_ALLOWLIST` with a one-line reason and (b) matched at
 *      runtime against a real live row. Per `apply-amends-regen.ts`'s reflection-
 *      pass lesson (3 of 6 exclusion entries once carried a wrong id and silently
 *      no-op'd, meaning audit-confirmed-false rows would still have been written
 *      by a live commit despite the prose claiming they were excluded) — the same
 *      class of bug is generalized here into ONE startup assertion that runs
 *      before ANY adapter-specific logic: every `DELETION_ALLOWLIST` entry must
 *      match a live edge or the whole run refuses, loudly, before touching the
 *      store.
 *   4. KIND/REL ENUM ENFORCEMENT against `lib/analysis/kg-verdict.ts`'s
 *      `KG_NODE_KINDS`/`KG_EDGE_RELS` — an unknown kind or rel is a hard error,
 *      never silently coerced or dropped. (This batch is GRANTED write access to
 *      that file for exactly this: `owns_stake`, `notice`, `cites`, `concerns`
 *      were added there in the same change as this script.)
 *
 * Payload SHAPE differs across the three batch-007 inputs (a re-point payload, a
 * dated ownership-chain slice, a notice/cites/concerns proposal) — rather than
 * fork three near-identical scripts (the thing this batch was explicitly told not
 * to do), each shape gets a small pure ADAPTER that normalizes it into one common
 * `NormalizedBatch` IR, and one shared `applyBatch()` core does every safety check
 * and every write, once. `--which=<key>` selects the adapter + hardcoded payload
 * path (same convention as `apply-amends-regen.ts`'s `NODE_PAYLOAD`/`EDGE_PAYLOAD`
 * consts — a case loop's inputs are known, reviewed files, not arbitrary user
 * input).
 *
 * Fleet-mode write safety (same convention as money/purge-osvc.ts,
 * law/apply-amends-regen.ts):
 *   - `--dry-run` is the DEFAULT (no flags, or an explicit --dry-run, never writes).
 *   - only `--commit` performs a write.
 *   - `--commit` requires `--pass=<n>` (a real assigned pass number).
 *   - `--commit` with `PGLITE_PATH` unset (i.e. targeting the live default
 *     `./.pglite`) is REFUSED unless `--confirm-live` is also passed.
 *
 * Always writes a report artifact (dry-run AND commit) to
 *   docs/data-analysis/case-sources/batch-007-apply-report-<which>.json
 *
 *   # dry-run against a copy (safe, default):
 *   PGLITE_PATH=./.pglite-copy-apply npx tsx scripts/case-loops/apply-batch.ts --which=prak-repoint
 *   PGLITE_PATH=./.pglite-copy-apply npx tsx scripts/case-loops/apply-batch.ts --which=ownership-chains
 *   PGLITE_PATH=./.pglite-copy-apply npx tsx scripts/case-loops/apply-batch.ts --which=kiosek
 *
 *   # orchestrator's real live commit (never run by this driver, per fleet rules):
 *   npx tsx scripts/case-loops/apply-batch.ts --which=<key> --commit --confirm-live --pass=<N>
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getStore } from "../../lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "../../lib/db/types";
import { KG_EDGE_RELS, KG_NODE_KINDS } from "../../lib/analysis/kg-verdict";

/* ── common IR every adapter normalizes into ──────────────────────────────── */

export interface ApplyNode {
  id: string;
  kind: string;
  label: string;
  props: Record<string, unknown>;
  /** Payload's own provenance, `pass: null` placeholder — substituted with --pass on a genuine insert. */
  provenance: Record<string, unknown>;
}
export interface ApplyEdge {
  src: string;
  rel: string;
  dst: string;
  weight?: number | null;
  props: Record<string, unknown>;
  provenance: Record<string, unknown>;
}
export interface ProposedDeletion {
  src: string;
  rel: string;
  dst: string;
  reason: string;
}
export interface ExcludedEdge {
  src: string;
  rel: string;
  dst: string;
  reason: string;
}
export interface NormalizedBatch {
  key: string;
  nodes: ApplyNode[];
  edges: ApplyEdge[];
  /** Edges a payload flags for retirement/deletion — NEVER deleted unless also in DELETION_ALLOWLIST (P50). */
  proposedDeletions: ProposedDeletion[];
  /** Edges the adapter itself refused to carry forward (unknown rel, unresolved target) — reported, never applied. */
  excludedEdges: ExcludedEdge[];
}

/* ── adapters (pure: payload JSON -> NormalizedBatch) ─────────────────────── */

/** batch-006-prak-repoint.json: nodeCreateProposal + edgeRepointProposals (money case). */
export function adaptPrakRepoint(payload: {
  generatedAt: string;
  nodeCreateProposal: { id: string; kind: string; label: string; props: Record<string, unknown>; provenance: Record<string, unknown> };
  edgeRepointProposals: {
    oldEdge: { src: string; rel: string; dst: string };
    newEdge: { src: string; rel: string; dst: string; propsMerge: Record<string, unknown> };
  }[];
}): NormalizedBatch {
  const nodes: ApplyNode[] = [payload.nodeCreateProposal];
  const edges: ApplyEdge[] = payload.edgeRepointProposals.map((p) => ({
    src: p.newEdge.src,
    rel: p.newEdge.rel,
    dst: p.newEdge.dst,
    props: p.newEdge.propsMerge,
    provenance: {
      track: "money",
      pass: null,
      method: "verdict",
      ref: "case-money/batch-006 · dataor PRaK re-point (Q-money-7)",
      computedAt: payload.generatedAt,
    },
  }));
  // P50: the retired old edge is a PROPOSED deletion only — never auto-applied.
  // DELETION_ALLOWLIST below is empty by design (see its docblock): the orchestrator
  // decides, explicitly, whether to retire these two, not this batch.
  const proposedDeletions: ProposedDeletion[] = payload.edgeRepointProposals.map((p) => ({
    ...p.oldEdge,
    reason: `repointed to corrected company node ${payload.nodeCreateProposal.id} (Q-money-7, batch-006) — old edge targeted the wrong IČO`,
  }));
  return { key: "prak-repoint", nodes, edges, proposedDeletions, excludedEdges: [] };
}

/**
 * batch-006-ownership-chains.json: nodeCreateProposals + ownsStakeEdgeProposals
 * (money case). REAL FINDING (deterministic, caught before any LLM/audit step):
 * `kg_edge`'s primary key is the plain triple (src, rel, dst) — it carries no
 * time dimension. 35 of the 55 `owns_stake` proposals share a (src,rel,dst) key
 * with at least one sibling (13 groups; a company held stock, or held a board
 * seat, across multiple dated periods — e.g. state ownership 2006→2015 then
 * 2015→2019 of the same subsidiary). A naive per-row upsert would silently make
 * the LAST period in file order win and erase every earlier dated stake.
 *
 * batch-007 Opus audit findings #1–#3 (fixed here, not just documented):
 *   - #2: 8 of 55 rows are board-seat memberships (`share` absent/null), not a
 *     dated shareholding — `owns_stake`'s contract per kg-verdict.ts is a stake,
 *     not a directorship. Non-stake rows are routed to `excludedEdges`, never
 *     silently folded into an ownership edge (a future `board_seat` rel is the
 *     right home for them, out of this batch's scope).
 *   - #1: among true stake rows sharing a key, "latest by `from`" is NOT a safe
 *     winner — an OPEN period (still-active stake, `to: null`) must always beat
 *     a closed one regardless of date, or an active 100%-owned subsidiary reads
 *     as `share: null`/terminated at the top level (verified against this exact
 *     payload: the AGROFERT→Synthesia and two hospital-holding groups would
 *     otherwise have shown a null/terminated top-level stake). Winner precedence:
 *     open period > higher share > later `from`.
 *   - #3: the tiebreak is now a total order (`from`, then `to` with an open
 *     period sorting last, then `-share`) so the winner is never file-order-
 *     dependent; a stake row with a missing/non-ISO `from` is a hard error
 *     rather than silently sorting as "oldest" (an empty-string coerce would
 *     have hidden exactly this class of bug).
 *   - #15: `periods[]` is now ALWAYS emitted (even for a single-period group,
 *     for a uniform consumer shape) and carries every original prop key plus
 *     each period's own `provenance` — not a hardcoded 6-key whitelist that
 *     would silently drop a future payload's extra fields or a period's own
 *     provenance.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function adaptOwnershipChains(payload: {
  generatedAt: string;
  nodeCreateProposals: { id: string; kind: string; label: string; props: Record<string, unknown>; provenance: Record<string, unknown> }[];
  ownsStakeEdgeProposals: {
    src: string;
    rel: string;
    dst: string;
    props: Record<string, unknown> & { from?: string; to?: string; share?: number | null; role?: string };
    provenance: Record<string, unknown>;
  }[];
}): NormalizedBatch {
  const nodes: ApplyNode[] = payload.nodeCreateProposals;
  const excludedEdges: ExcludedEdge[] = [];

  const stakeRows = payload.ownsStakeEdgeProposals.filter((p) => {
    const isStake = typeof p.props.share === "number";
    if (!isStake) {
      excludedEdges.push({ src: p.src, rel: p.rel, dst: p.dst, reason: `props.share is not a number (role=${JSON.stringify(p.props.role)}) — a board/officer seat, not a dated shareholding; owns_stake's contract per kg-verdict.ts is a stake` });
    }
    return isStake;
  });
  for (const p of stakeRows) {
    if (typeof p.props.from !== "string" || !ISO_DATE.test(p.props.from)) {
      throw new ApplyBatchError(`REFUSED: owns_stake row ${p.src}->${p.dst} has a missing/non-ISO props.from (${JSON.stringify(p.props.from)}) — refusing to guess a sort order for it.`);
    }
  }

  const byKey = new Map<string, typeof stakeRows>();
  for (const p of stakeRows) {
    const key = `${p.src}|${p.rel}|${p.dst}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(p);
    byKey.set(key, bucket);
  }

  // Total order used for BOTH the winner pick and the periods[] history order:
  // an open period (to == null) sorts after every closed period regardless of
  // date, then by `from` ascending, then by `to` (open last), then by -share.
  const OPEN_SENTINEL = "9999-99-99";
  const orderKey = (p: (typeof stakeRows)[number]): [string, string, number] => [String(p.props.from), String(p.props.to ?? OPEN_SENTINEL), -(p.props.share ?? 0)];
  const cmp = (a: (typeof stakeRows)[number], b: (typeof stakeRows)[number]) => {
    const [af, at, ash] = orderKey(a);
    const [bf, bt, bsh] = orderKey(b);
    if (af !== bf) return af < bf ? -1 : 1;
    if (at !== bt) return at < bt ? -1 : 1;
    if (ash !== bsh) return ash < bsh ? -1 : 1;
    return 0;
  };

  const edges: ApplyEdge[] = [...byKey.entries()].map(([, group]) => {
    const sorted = [...group].sort(cmp);
    // Winner: an OPEN period always outranks a closed one; among same-openness
    // rows the total order above (latest from, then highest share) decides.
    const open = sorted.filter((p) => p.props.to == null || p.props.to === undefined);
    const winner = open.length > 0 ? open[open.length - 1] : sorted[sorted.length - 1];
    const merged: ApplyEdge = {
      src: winner.src,
      rel: winner.rel,
      dst: winner.dst,
      props: {
        ...winner.props,
        periods: sorted.map((p) => ({ ...p.props, provenance: p.provenance })),
        multi_period_merged: sorted.length > 1,
      },
      provenance: winner.provenance,
    };
    return merged;
  });

  return { key: "ownership-chains", nodes, edges, proposedDeletions: [], excludedEdges };
}

/**
 * kiosek-payload.json (case-sources): nodes (kind=notice) + edges (cites/concerns
 * to law/company targets, some not yet minted; plus a `concerns_person_ico`
 * marker that is NOT a real graph rel — the payload's own handoff says so).
 * Edges are excluded (never silently dropped — reported in `excludedEdges`) when:
 *   (a) `rel` is not a real enum value (`concerns_person_ico`) — routes natural-
 *       person IČO mentions out of the graph per the Opus verification finding
 *       in case-sources/handoff.md;
 *   (b) `targetExists === false` — the payload's own label for a `law:sb:*` or
 *       `company:ico:*` id that hasn't been minted by the owning case yet; this
 *       adapter does NOT trust that label blindly, though — `applyBatch()`'s
 *       node-then-edge check re-verifies every surviving edge's endpoints
 *       against the live store regardless of what this flag claims.
 */
export function adaptKiosek(payload: {
  generatedAt: string;
  nodes: { id: string; kind: string; label: string; props: Record<string, unknown>; rationale?: string }[];
  edges: { src: string; rel: string; dst: string; targetExists?: boolean; wouldNeed?: string; rationale: string }[];
}): NormalizedBatch {
  const nodes: ApplyNode[] = payload.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: n.props,
    provenance: { track: "sources", pass: null, method: "verdict", ref: "case-sources/batch-006 · kiosek notice/cites/concerns", computedAt: payload.generatedAt },
  }));

  const excludedEdges: ExcludedEdge[] = [];
  const edges: ApplyEdge[] = [];
  for (const e of payload.edges) {
    if (!(KG_EDGE_RELS as readonly string[]).includes(e.rel)) {
      excludedEdges.push({ src: e.src, rel: e.rel, dst: e.dst, reason: `rel ${JSON.stringify(e.rel)} is not a real graph relation (${e.wouldNeed ?? "internal routing marker"})` });
      continue;
    }
    if (e.targetExists === false) {
      excludedEdges.push({ src: e.src, rel: e.rel, dst: e.dst, reason: `payload marks targetExists:false — ${e.wouldNeed ?? "target not minted by its owning case yet"}` });
      continue;
    }
    edges.push({
      src: e.src,
      rel: e.rel,
      dst: e.dst,
      props: { rationale: e.rationale },
      provenance: { track: "sources", pass: null, method: "verdict", ref: "case-sources/batch-006 · kiosek notice/cites/concerns", computedAt: payload.generatedAt },
    });
  }

  return { key: "kiosek", nodes, edges, proposedDeletions: [], excludedEdges };
}

/* ── deletion allowlist (P50) ──────────────────────────────────────────────
 * EMPTY BY DESIGN. The prak-repoint payload flags its 2 old edges as retirement
 * candidates, but per the payload's own note ("the old edge must NOT be silently
 * deleted without an explicit allowlist entry, per P50") the default posture is
 * to LEAVE them — a re-point is additive (new edge + a documented candidate
 * deletion), not destructive, until a human/orchestrator makes the deletion
 * decision explicit by adding an entry here with a one-line justification,
 * reviewed BEFORE a live commit. */
export const DELETION_ALLOWLIST: ProposedDeletion[] = [
  // ORCHESTRATOR DECISION 2026-07-25, batch 007, after the prak-repoint insert.
  // These two edges point Bendl (346) and Brabec (6184) at IČO 49683144 "PRAK
  // spol. s r.o." — an s.r.o. since 1993, which structurally CANNOT have had the
  // představenstvo seat the tie claims (batch-002 C7). The correct entity, IČO
  // 61858111 "PRaK, a.s. v likvidaci", is dataor-corroborated with both members'
  // dated board records (batch 006, Q-money-7), and its edges are now live.
  // Leaving these would make the graph assert BOTH — a false tie about two named
  // MPs rendering on /penize. Retired for the same reason and by the same
  // evidence standard as the 49 OSVČ false edges in pass 22. The full record
  // (old ids, evidence chain, reasoning) survives in the payload, the vault and
  // git history; only the false assertion goes.
  { src: "psp:person:346", rel: "linked_to", dst: "company:ico:49683144", reason: "superseded by the dataor-corroborated PRaK re-point (Q-money-7); wrong-entity tie, batch-002 C7" },
  { src: "psp:person:6184", rel: "linked_to", dst: "company:ico:49683144", reason: "superseded by the dataor-corroborated PRaK re-point (Q-money-7); wrong-entity tie, batch-002 C7" },
];

/* ── the shared, generalized apply core ────────────────────────────────────── */

export interface ApplyStore {
  listKgNodes(opts?: { kind?: string; limit?: number }): Promise<KgNodeRow[]>;
  listKgEdges(opts?: { rel?: string; limit?: number }): Promise<KgEdgeRow[]>;
  upsertKgNodes(rows: KgNodeRow[]): Promise<number>;
  upsertKgEdges(rows: KgEdgeRow[]): Promise<number>;
  deleteKgEdges(keys: readonly { src: string; rel: string; dst: string }[]): Promise<number>;
}

export interface ApplyBatchOptions {
  /** A real assigned pass number for genuinely NEW rows. Required whenever the batch has any node/edge that isn't already live. */
  pass: number;
  /** Namespace for the merge-preserving annotation note on already-live rows. */
  ns: string;
  commit: boolean;
}

export interface ApplyBatchReport {
  key: string;
  mode: "commit" | "dry-run";
  pass: number | null;
  nodes: { total: number; byKind: Record<string, { inserted: number; merged: number }> };
  edges: { total: number; byRel: Record<string, { inserted: number; merged: number }> };
  excludedEdges: ExcludedEdge[];
  proposedDeletions: { entry: ProposedDeletion; allowlisted: boolean; deleted: boolean }[];
  rejections: string[];
}

export class ApplyBatchError extends Error {}

/**
 * The one shared engine every adapter's NormalizedBatch runs through. Order:
 *   0. deletion-allowlist startup assertion (must run before ANY other logic —
 *      same reflection-pass lesson `apply-amends-regen.ts` learned: an exclusion
 *      list that doesn't match reality must fail LOUDLY, not silently no-op).
 *   1. kind/rel enum enforcement — hard error, refuses the whole run.
 *   2. node-then-edge endpoint check — hard error, refuses the whole run.
 *   3. node phase (insert new / provenance-preserving merge on existing).
 *   4. edge phase (insert new / provenance-preserving merge on existing).
 *   5. deletion phase (only DELETION_ALLOWLIST-matched proposedDeletions).
 * Steps 1-2 throw BEFORE any store write happens in commit mode — a rejected
 * batch writes nothing at all, never a partial batch.
 */
export async function applyBatch(store: ApplyStore, batch: NormalizedBatch, opts: ApplyBatchOptions): Promise<ApplyBatchReport> {
  const rejections: string[] = [];

  // ---- Step 0: deletion-allowlist startup assertion ----
  // Opus audit #4: an allowlist entry must match BOTH a live edge AND a
  // proposedDeletion of THIS batch — checking only "matches a live edge" lets
  // an entry from a DIFFERENT `--which` payload pass the assertion while
  // deleting nothing (silent no-op, undetectable from the report) once armed.
  // Restricting the check to entries relevant to this batch's own
  // proposedDeletions also stops one case's armed entry from hard-refusing an
  // unrelated case's run.
  const relevantAllowlist = DELETION_ALLOWLIST.filter((entry) => batch.proposedDeletions.some((d) => d.src === entry.src && d.rel === entry.rel && d.dst === entry.dst));
  const liveEdgesForAllowlistCheck = relevantAllowlist.length > 0 ? await store.listKgEdges({}) : [];
  const liveEdgeKeySet = new Set(liveEdgesForAllowlistCheck.map((e) => `${e.src}|${e.rel}|${e.dst}`));
  for (const entry of relevantAllowlist) {
    const key = `${entry.src}|${entry.rel}|${entry.dst}`;
    if (!liveEdgeKeySet.has(key)) {
      throw new ApplyBatchError(
        `REFUSED: DELETION_ALLOWLIST entry ${key} does not match any live edge — the deletion would silently no-op ` +
          `(this is exactly the class of bug apply-amends-regen.ts's reflection pass caught: an allowlist entry with a ` +
          `wrong id looks like it excludes something while a live commit would still leave it untouched or, worse here, ` +
          `mislead the operator about what was actually deleted).`,
      );
    }
  }

  // ---- Step 1: kind/rel enum enforcement ----
  const badNodeKinds = batch.nodes.filter((n) => !(KG_NODE_KINDS as readonly string[]).includes(n.kind));
  if (badNodeKinds.length > 0) {
    throw new ApplyBatchError(`REFUSED: unknown node kind(s) not in KG_NODE_KINDS: ${badNodeKinds.map((n) => `${n.id} (kind=${JSON.stringify(n.kind)})`).join(", ")}`);
  }
  const badEdgeRels = batch.edges.filter((e) => !(KG_EDGE_RELS as readonly string[]).includes(e.rel));
  if (badEdgeRels.length > 0) {
    throw new ApplyBatchError(`REFUSED: unknown edge rel(s) not in KG_EDGE_RELS: ${badEdgeRels.map((e) => `${e.src}->${e.dst} (rel=${JSON.stringify(e.rel)})`).join(", ")}`);
  }

  // ---- Step 2: node-then-edge endpoint check ----
  const liveNodes = await store.listKgNodes({});
  const liveNodeIds = new Set(liveNodes.map((n) => n.id));
  const newNodeIds = new Set(batch.nodes.map((n) => n.id));
  const knownIds = new Set([...liveNodeIds, ...newNodeIds]);
  const missingEndpoints = batch.edges.filter((e) => !knownIds.has(e.src) || !knownIds.has(e.dst));
  if (missingEndpoints.length > 0) {
    throw new ApplyBatchError(
      `REFUSED: ${missingEndpoints.length} edge(s) reference an endpoint that is neither a live node nor a node this batch creates — ` +
        `a hard error, never a silent skip:\n` +
        missingEndpoints.map((e) => `  ${e.src} --${e.rel}--> ${e.dst}${!knownIds.has(e.src) ? " [src missing]" : ""}${!knownIds.has(e.dst) ? " [dst missing]" : ""}`).join("\n"),
    );
  }

  // ---- Step 3: node phase ----
  const liveNodeById = new Map(liveNodes.map((n) => [n.id, n]));
  const nodeRows: KgNodeRow[] = [];
  const nodesByKind: Record<string, { inserted: number; merged: number }> = {};
  for (const n of batch.nodes) {
    const bucket = (nodesByKind[n.kind] ??= { inserted: 0, merged: 0 });
    const existing = liveNodeById.get(n.id);
    if (existing) {
      bucket.merged++;
      // Nested, namespaced note — NEVER spread the payload's props over the
      // existing row's (Opus audit #8: a naive `{...existing, ...n}` silently
      // overwrites/erases an existing prop with no report entry, unlike the
      // edge-merge path which was already nested). Any key the payload wanted
      // to change on an already-live node is recorded in `rejections`, never
      // applied silently.
      for (const [k, v] of Object.entries(n.props)) {
        if (k in existing.props && JSON.stringify(existing.props[k]) !== JSON.stringify(v)) {
          rejections.push(`node ${n.id}: prop ${JSON.stringify(k)} differs (live=${JSON.stringify(existing.props[k])}, payload=${JSON.stringify(v)}) — live value kept, payload value nested under ${opts.ns}_${batch.key}_note instead of overwriting`);
        }
      }
      if (n.kind !== existing.kind) rejections.push(`node ${n.id}: payload kind ${JSON.stringify(n.kind)} differs from live kind ${JSON.stringify(existing.kind)} — live kind kept`);
      if (n.label !== existing.label) rejections.push(`node ${n.id}: payload label ${JSON.stringify(n.label)} differs from live label ${JSON.stringify(existing.label)} — live label kept`);
      nodeRows.push({
        id: existing.id,
        kind: existing.kind,
        label: existing.label,
        props: { ...existing.props, [`${opts.ns}_${batch.key}_note`]: { ...n.props, mergedAt: new Date().toISOString(), source: batch.key } },
        firstSeenPass: existing.firstSeenPass,
        provenance: existing.provenance, // UNTOUCHED — identity provenance preserved.
      });
    } else {
      bucket.inserted++;
      nodeRows.push({
        id: n.id,
        kind: n.kind,
        label: n.label,
        props: n.props,
        firstSeenPass: opts.pass,
        provenance: { ...n.provenance, pass: opts.pass },
      });
    }
  }

  // ---- Step 4: edge phase ----
  const liveEdges = knownIds.size > 0 && batch.edges.length > 0 ? await store.listKgEdges({}) : [];
  const liveEdgeByKey = new Map(liveEdges.map((e) => [`${e.src}|${e.rel}|${e.dst}`, e]));
  const edgeRows: KgEdgeRow[] = [];
  const edgesByRel: Record<string, { inserted: number; merged: number }> = {};
  for (const e of batch.edges) {
    const key = `${e.src}|${e.rel}|${e.dst}`;
    const bucket = (edgesByRel[e.rel] ??= { inserted: 0, merged: 0 });
    const existing = liveEdgeByKey.get(key);
    if (existing) {
      bucket.merged++;
      edgeRows.push({
        src: existing.src,
        rel: existing.rel,
        dst: existing.dst,
        weight: e.weight ?? existing.weight,
        props: { ...existing.props, [`${opts.ns}_${batch.key}_note`]: { ...e.props, mergedAt: new Date().toISOString(), source: batch.key } },
        provenance: existing.provenance, // UNTOUCHED — identity provenance preserved.
      });
    } else {
      bucket.inserted++;
      edgeRows.push({
        src: e.src,
        rel: e.rel,
        dst: e.dst,
        weight: e.weight ?? null,
        props: e.props,
        provenance: { ...e.provenance, pass: opts.pass },
      });
    }
  }

  // ---- Step 5: deletion phase (allowlist-matched only) ----
  const deletionResults: { entry: ProposedDeletion; allowlisted: boolean; deleted: boolean }[] = [];
  const relevantAllowlistKeySet = new Set(relevantAllowlist.map((d) => `${d.src}|${d.rel}|${d.dst}`));
  const toDelete: ProposedDeletion[] = [];
  for (const d of batch.proposedDeletions) {
    const key = `${d.src}|${d.rel}|${d.dst}`;
    const allowlisted = relevantAllowlistKeySet.has(key);
    if (allowlisted) toDelete.push(d);
    deletionResults.push({ entry: d, allowlisted, deleted: false }); // `deleted` finalized after the write below, from the store's OWN reported count (Opus audit #5) — never assumed.
  }

  if (opts.commit) {
    await store.upsertKgNodes(nodeRows);
    await store.upsertKgEdges(edgeRows);
    if (toDelete.length > 0) {
      const deletedCount = await store.deleteKgEdges(toDelete.map((d) => ({ src: d.src, rel: d.rel, dst: d.dst })));
      if (deletedCount !== toDelete.length) {
        throw new ApplyBatchError(`REFUSED to report success: asked to delete ${toDelete.length} allowlisted edge(s), store reports only ${deletedCount} actually deleted — the report must never claim a deletion the DB didn't perform.`);
      }
      for (const r of deletionResults) if (r.allowlisted) r.deleted = true;
    }
  }

  return {
    key: batch.key,
    mode: opts.commit ? "commit" : "dry-run",
    pass: opts.commit ? opts.pass : null,
    nodes: { total: batch.nodes.length, byKind: nodesByKind },
    edges: { total: batch.edges.length, byRel: edgesByRel },
    excludedEdges: batch.excludedEdges,
    proposedDeletions: deletionResults,
    rejections,
  };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

const PAYLOADS: Record<string, { path: string; adapter: (raw: unknown) => NormalizedBatch }> = {
  "prak-repoint": { path: "docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json", adapter: (raw) => adaptPrakRepoint(raw as Parameters<typeof adaptPrakRepoint>[0]) },
  "ownership-chains": { path: "docs/data-analysis/case-money/payloads/batch-006-ownership-chains.json", adapter: (raw) => adaptOwnershipChains(raw as Parameters<typeof adaptOwnershipChains>[0]) },
  kiosek: { path: "docs/data-analysis/case-sources/kiosek-payload.json", adapter: (raw) => adaptKiosek(raw as Parameters<typeof adaptKiosek>[0]) },
};

/**
 * Opus audit #13: nothing asserted that a payload still holds the shape the
 * orchestrator reviewed between "dry-run looked right" and "--commit was run
 * for real" — a payload edit or an adapter regression could silently change
 * what gets written with no signal. Reviewed-and-expected shape per payload,
 * derived from the same dry-run this batch's handoff reports; a mismatch is a
 * hard refusal before any write, same severity class as the endpoint/enum checks.
 */
const EXPECTED_COUNTS: Record<string, { nodes: number; edges: number; excludedEdges: number }> = {
  "prak-repoint": { nodes: 1, edges: 2, excludedEdges: 0 },
  "ownership-chains": { nodes: 19, edges: 33, excludedEdges: 8 },
  kiosek: { nodes: 20, edges: 36, excludedEdges: 80 },
};

const arg = (name: string): string | undefined => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const which = arg("which");
  if (!which || !PAYLOADS[which]) {
    console.error(`usage: apply-batch.ts --which=<${Object.keys(PAYLOADS).join("|")}> [--commit --pass=<n> [--confirm-live]] [--ns=<ns>]`);
    process.exit(1);
  }
  const commit = flag("commit");
  const passArg = arg("pass");
  const pass = passArg ? Number(passArg) : NaN;
  const ns = arg("ns") ?? "apply_batch_007";

  if (commit && !(Number.isInteger(pass) && pass > 0)) {
    // Opus audit #11: Number.isFinite alone accepted 0/negative/fractional —
    // strictly weaker than persist-batch.ts's own `pass > 0` gate, and 0 is
    // exactly the placeholder apply-amends-regen.ts substitutes away.
    console.error("REFUSED: --commit requires --pass=<n> where n is a positive integer (a real assigned pass number, never a placeholder).");
    process.exit(1);
  }
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Either point PGLITE_PATH at a copy/fixture, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }

  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH to a copy/fixture for a dry run — never the live ./.pglite without --confirm-live)");
    process.exit(1);
  }

  console.log(`apply-batch (batch-007) · --which=${which} · ${commit ? `COMMIT (pass ${pass})` : "DRY-RUN"}\n`);

  const cfg = PAYLOADS[which];
  const raw = JSON.parse(readFileSync(cfg.path, "utf8"));
  const normalized = cfg.adapter(raw);

  const expected = EXPECTED_COUNTS[which];
  const outPathEarly = `docs/data-analysis/case-sources/batch-007-apply-report-${which}.json`;
  if (expected && (normalized.nodes.length !== expected.nodes || normalized.edges.length !== expected.edges || normalized.excludedEdges.length !== expected.excludedEdges)) {
    const msg =
      `REFUSED: --which=${which} normalized to ${normalized.nodes.length} nodes / ${normalized.edges.length} edges / ${normalized.excludedEdges.length} excluded, ` +
      `expected ${expected.nodes} / ${expected.edges} / ${expected.excludedEdges} (the shape a prior dry-run reviewed) — the payload or adapter changed since review; refusing to write.`;
    console.error(msg);
    await mkdir(path.dirname(outPathEarly), { recursive: true });
    await writeFile(outPathEarly, JSON.stringify({ key: which, mode: "refused", error: msg, generatedAt: new Date().toISOString() }, null, 2));
    await store.close();
    process.exit(1);
    return;
  }

  let report: ApplyBatchReport;
  try {
    report = await applyBatch(store, normalized, { pass: Number.isInteger(pass) && pass > 0 ? pass : 0, ns, commit });
  } catch (e) {
    // Opus audit #6: a failed/refused run must still leave a durable artifact —
    // "no report at all" after an attempted (and possibly partial) commit is
    // forensically invisible, exactly the failure mode this script exists to
    // prevent. Always write SOMETHING, even on the error path.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    await mkdir(path.dirname(outPathEarly), { recursive: true });
    await writeFile(outPathEarly, JSON.stringify({ key: which, mode: commit ? "commit-failed" : "dry-run-failed", error: msg, generatedAt: new Date().toISOString() }, null, 2));
    await store.close();
    process.exit(1);
    return;
  }

  console.log(`Nodes: ${report.nodes.total} total`);
  for (const [kind, c] of Object.entries(report.nodes.byKind)) console.log(`  ${kind}: ${c.inserted} insert, ${c.merged} merge`);
  console.log(`Edges: ${report.edges.total} total`);
  for (const [rel, c] of Object.entries(report.edges.byRel)) console.log(`  ${rel}: ${c.inserted} insert, ${c.merged} merge`);
  if (report.excludedEdges.length) {
    console.log(`Excluded edges (never applied): ${report.excludedEdges.length}`);
    for (const ex of report.excludedEdges.slice(0, 10)) console.log(`  ${ex.src} --${ex.rel}--> ${ex.dst} — ${ex.reason}`);
    if (report.excludedEdges.length > 10) console.log(`  ... and ${report.excludedEdges.length - 10} more`);
  }
  if (report.proposedDeletions.length) {
    console.log(`Proposed deletions: ${report.proposedDeletions.length}`);
    for (const d of report.proposedDeletions) console.log(`  ${d.entry.src} --${d.entry.rel}--> ${d.entry.dst} [${d.allowlisted ? "ALLOWLISTED" : "NOT ALLOWLISTED — left untouched"}] — ${d.entry.reason}`);
  }

  const outPath = outPathEarly;
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${outPath}`);
  console.log(commit ? `\nCOMMITTED pass ${pass}.` : `\nDRY-RUN: nothing written to the store.`);

  await store.close();
}

if (process.argv[1] && process.argv[1].endsWith("apply-batch.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
