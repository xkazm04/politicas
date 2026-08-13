/* DETERMINISTIC knowledge-graph edge builder — Phase 1 of the self-expanding KG
 * loop (docs/knowledge-graph-loop.md §4.3, §10.1). Reads the raw civic graph via
 * the Store, computes the quantitative substrate in code (lib/analysis/kg.ts —
 * NO LLM), and upserts typed nodes + typed weighted edges into kg_node/kg_edge.
 *
 * Edges built here (all recomputable from raw ballots/memberships):
 *   co_votes_with  person↔person  weight = agreement rate over shared positional votes
 *   rebels_against person→party   weight = rebellion rate vs the club's majority line
 *   influential_in person→organ   weight = committee role rank
 * Node props: person.rebellion_rate / .committee_count · party.cohesion / .seats ·
 *   organ.member_count.
 *
 * ── THIS WRITER DOES NOT ERASE WHAT IT DID NOT COMPUTE (2026-08-13) ──────────────
 * `upsertKgNodes` does `props = excluded.props` — a WHOLESALE REPLACE
 * (lib/db/pglite/repositories/kg.ts; memory/kg-upsert-replaces-props.md). This script
 * used to build each node's props from scratch, so a `--commit` erased, on all 207 MPs,
 * every prop written by any other pass: contribution_score, participation_rate,
 * absence_rate, bills_authored, speech_turns, interpellations, leadership_count,
 * absentee_manager_lead, contribution_psp9, amendments_authored, bills_first_signed/
 * co_signed, effort_tenure_class — each of them read today by
 * features/civicscore/getLeaderboardData.ts, features/profile/getProfileData.ts and
 * features/money/moneyLoader.ts. Four sibling writers had already adopted the
 * read-merge for exactly this reason; this one, the area's main entry point, had not.
 *
 * It now reads the nodes it is about to write BEFORE writing them and merges through
 * `mergeComputedNodeProps` (lib/analysis/kg.ts): the props THIS run computes win,
 * every other stored prop survives. `firstSeenPass` is carried through from the
 * existing node — it records which pass CREATED the node, and a re-run with
 * `--pass=50` used to restamp all ~250 of them. `provenance` IS restamped, on
 * purpose: it dates the numbers in `props`, and leaving it frozen at pass 1 beside a
 * freshly recomputed rebellion_rate would be a false vintage on a surface whose whole
 * brand is that a number carries its source.
 *
 * ── AND --reset IS GUARDED ────────────────────────────────────────────────────────
 * `clearKg()` deletes EVERY node and edge, not just this writer's. On today's graph
 * that is ~154 000 nodes / ~178 000 edges wiped and ~1 000 written back — /penize,
 * /zakony, /denik and /graf go dark. `guardKgReset` names what would be lost and
 * refuses; `--supersede` is the explicit override (the kg-contribution-ingest
 * precedent) and a dry run always prints the verdict.
 *
 * A recompute does NOT need `--reset`: the upsert replaces each claim in place.
 *
 * PGLITE IS SINGLE-CONNECTION and this script READS ballots and (with --commit)
 * WRITES the kg_* tables through one connection. Run it when no dev server holds
 * ./.pglite. For a read-only dry-run against a live DB, point it at a copy:
 *   cp -r .pglite .pglite-copy
 *   PGLITE_PATH=./.pglite-copy npx tsx scripts/data-analysis/kg-compute.ts
 *
 *   npx tsx scripts/data-analysis/kg-compute.ts            # dry-run (default): compute + hand-checks
 *   npx tsx scripts/data-analysis/kg-compute.ts --commit   # upsert kg_node/kg_edge (merge-preserving)
 *   npx tsx scripts/data-analysis/kg-compute.ts --commit --reset --supersede   # wipe kg_* first (destructive)
 */
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import type { VoteChoice } from "@/lib/ingest/normalize";
import {
  coVotingEdges,
  committeeInfluence,
  guardKgReset,
  mergeComputedNodeProps,
  partyCohesion,
  positionOf,
  rebellion,
  type BallotInput,
  type ClubRef,
  type MembershipInput,
} from "@/lib/analysis/kg";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

/** Committee-type organs (výbor / komise, incl. Stálá/Vyšetřovací komise) — matched
 *  loosely so exact-string drift in organ_type_cz doesn't silently drop a committee. */
const COMMITTEE_TYPE = /v[ýy]bor|komis/i;

function personUrn(pspId: number): string {
  return `psp:person:${pspId}`;
}
function organUrn(pspId: number): string {
  return `psp:organ:${pspId}`;
}

async function main() {
  const term = arg("term", "PSP10");
  const pass = Number(arg("pass", "1"));
  const commit = process.argv.includes("--commit");
  const reset = process.argv.includes("--reset");
  const supersede = process.argv.includes("--supersede");
  const computedAt = new Date().toISOString();
  const provenance = (ref: string) => ({ pass, method: "deterministic", ref, computedAt });

  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }

  /* ── load the raw graph ──────────────────────────────────────────────────── */
  const persons = await store.listPersons();
  const organs = await store.listOrgans();
  const mandates = await store.listMandates({ termCode: term });
  const memberships = await store.listMemberships({ termCode: term });
  const voteEvents = await store.listVoteEvents({ termCode: term });
  const rawBallots = await store.listVoteBallots({ termCode: term });
  const clubAbbrevByMandate = await store.clubByMandate(term);

  const personName = new Map<number, string>();
  for (const p of persons) personName.set(p.pspId, p.nameFull);

  // The term chamber is the organ whose abbrev IS the term code; clubs + committees
  // are its children (same linkage clubByMandate relies on).
  const chamber = organs.find((o) => o.abbrev === term);
  const chamberPspId = chamber?.pspId ?? null;
  const children = organs.filter((o) => o.parentPspId === chamberPspId);
  const clubOrgans = children.filter((o) => o.organTypeCz === "Klub");
  const committeeOrgans = children.filter((o) => COMMITTEE_TYPE.test(o.organTypeCz ?? ""));
  const committeeIds = new Set(committeeOrgans.map((o) => o.pspId));
  const clubOrganByAbbrev = new Map<string, number>();
  for (const o of clubOrgans) if (o.abbrev) clubOrganByAbbrev.set(o.abbrev, o.pspId);

  /* ── resolution maps for the pure functions ──────────────────────────────── */
  const mandateToPerson = new Map<number, number>();
  for (const m of mandates) mandateToPerson.set(m.pspId, m.personPspId);

  const mandateToClub = new Map<number, ClubRef>();
  const seatsByClub = new Map<number, number>();
  for (const [mandateId, abbrev] of clubAbbrevByMandate) {
    const organId = clubOrganByAbbrev.get(abbrev);
    if (organId === undefined) continue;
    mandateToClub.set(mandateId, { organId, abbrev });
    seatsByClub.set(organId, (seatsByClub.get(organId) ?? 0) + 1);
  }

  const voided = new Set<number>();
  for (const v of voteEvents) if (v.voided) voided.add(v.pspId);

  const ballots: BallotInput[] = rawBallots.map((b) => ({
    voteId: b.votePspId,
    mandateId: b.mandatePspId,
    choice: b.choice as VoteChoice,
  }));
  const positionalCount = ballots.filter((b) => positionOf(b.choice) !== null).length;

  const membershipInputs: MembershipInput[] = memberships
    .filter((m) => m.organPspId !== null)
    .map((m) => ({ person: m.personPspId, organId: m.organPspId as number, functionName: m.functionNameCz }));

  /* ── compute (deterministic; owns every number) ──────────────────────────── */
  const coVotes = coVotingEdges(ballots, voided, mandateToPerson);
  const { edges: rebels, byPerson: rebelByPerson } = rebellion(ballots, voided, mandateToPerson, mandateToClub);
  const cohesion = partyCohesion(ballots, voided, mandateToClub);
  const { edges: influence, degree: committeeDegree } = committeeInfluence(membershipInputs, committeeIds);

  const memberCountByCommittee = new Map<number, number>();
  for (const e of influence) memberCountByCommittee.set(e.organId, (memberCountByCommittee.get(e.organId) ?? 0) + 1);

  /* ── assemble nodes ──────────────────────────────────────────────────────────
   * Two steps on purpose. First the props THIS run computes; then the read-merge
   * against the node as it stands in the store, so no other pass's enrichment is
   * lost (see the header). `computed` is what this writer OWNS — nothing else. */
  interface ComputedNode {
    id: string;
    kind: KgNodeRow["kind"];
    label: string;
    props: Record<string, unknown>;
    ref: string;
  }
  const computed: ComputedNode[] = [];

  const personIds = new Set(mandateToPerson.values());
  for (const pid of personIds) {
    const props: Record<string, unknown> = {};
    const reb = rebelByPerson.get(pid);
    if (reb) props.rebellion_rate = reb.rate;
    const deg = committeeDegree.get(pid);
    if (deg !== undefined) props.committee_count = deg;
    computed.push({
      id: personUrn(pid),
      kind: "person",
      label: personName.get(pid) ?? `MP ${pid}`,
      props,
      ref: "kg-compute:person",
    });
  }

  for (const o of clubOrgans) {
    const props: Record<string, unknown> = { seats: seatsByClub.get(o.pspId) ?? 0 };
    const coh = cohesion.get(o.pspId);
    if (coh) {
      props.cohesion = coh.cohesion;
      props.cohesion_votes = coh.votes;
    }
    computed.push({
      id: organUrn(o.pspId),
      kind: "party",
      label: o.abbrev ?? o.nameCz ?? `organ ${o.pspId}`,
      props,
      ref: "kg-compute:party",
    });
  }

  for (const o of committeeOrgans) {
    const members = memberCountByCommittee.get(o.pspId);
    if (!members) continue; // no PSP10 members resolved → skip a dangling node
    computed.push({
      id: organUrn(o.pspId),
      kind: "organ",
      label: o.abbrev ?? o.nameCz ?? `organ ${o.pspId}`,
      props: { member_count: members, organ_type: o.organTypeCz },
      ref: "kg-compute:organ",
    });
  }

  // The stored nodes of the three kinds this writer rebuilds. Read by KIND (indexed,
  // ~250 rows here) rather than by the id list, because the same read answers the
  // second question --reset needs: which stored rows would this run NOT put back.
  const REBUILT_KINDS = ["person", "party", "organ"] as const;
  const storedRebuilt = (
    await Promise.all(REBUILT_KINDS.map((kind) => store.listKgNodes({ kind })))
  ).flat();
  const storedById = new Map(storedRebuilt.map((n) => [n.id, n]));

  let preservedProps = 0; // props kept alive by the merge that a from-scratch build would have erased
  const nodes: KgNodeRow[] = computed.map((c) => {
    const prev = storedById.get(c.id);
    // THE FIX: computed props win, every other stored prop survives.
    const props = mergeComputedNodeProps(prev?.props, c.props);
    preservedProps += Object.keys(props).length - Object.keys(c.props).length;
    return {
      id: c.id,
      kind: c.kind,
      label: c.label,
      props,
      // Which pass CREATED the node — never restamped by a recompute.
      firstSeenPass: prev?.firstSeenPass ?? pass,
      provenance: provenance(c.ref),
    };
  });

  /* ── assemble edges ──────────────────────────────────────────────────────── */
  const edges: KgEdgeRow[] = [];
  for (const e of coVotes) {
    edges.push({
      src: personUrn(e.src),
      rel: "co_votes_with",
      dst: personUrn(e.dst),
      weight: e.agreement,
      props: { shared: e.shared, agree: e.agree },
      provenance: provenance("kg-compute:co_votes_with"),
    });
  }
  for (const e of rebels) {
    edges.push({
      src: personUrn(e.person),
      rel: "rebels_against",
      dst: organUrn(e.clubOrganId),
      weight: e.rate,
      props: { rebelVotes: e.rebelVotes, eligibleVotes: e.eligibleVotes, club: e.clubAbbrev },
      provenance: provenance("kg-compute:rebels_against"),
    });
  }
  for (const e of influence) {
    edges.push({
      src: personUrn(e.person),
      rel: "influential_in",
      dst: organUrn(e.organId),
      weight: e.weight,
      props: { role: e.role },
      provenance: provenance("kg-compute:influential_in"),
    });
  }

  /* ── hand-check report (§10.1: verify edge counts against hand-checks) ────── */
  const nonVoided = voteEvents.length - voided.size;
  console.log(`\n== kg-compute (${term}, pass ${pass}) ==`);
  console.log(
    `inputs: ${mandates.length} mandates · ${personIds.size} persons · ` +
      `${voteEvents.length} votes (${voided.size} voided → ${nonVoided} used) · ` +
      `${ballots.length} ballots (${positionalCount} positional) · ${memberships.length} memberships`,
  );

  console.log(`\norgan children of the ${term} chamber (committee predicate = /výbor|komis/i):`);
  const typeCount = new Map<string, number>();
  for (const o of children) typeCount.set(o.organTypeCz ?? "∅", (typeCount.get(o.organTypeCz ?? "∅") ?? 0) + 1);
  for (const [t, n] of [...typeCount.entries()].sort((a, b) => b[1] - a[1])) {
    const isCommittee = COMMITTEE_TYPE.test(t);
    console.log(`  ${isCommittee ? "✓" : " "} ${t.padEnd(24)} ${n}`);
  }
  console.log(`  → ${clubOrgans.length} clubs · ${committeeOrgans.length} committees`);

  console.log(`\nnodes: ${nodes.length}  (${countBy(nodes, (n) => n.kind)})`);
  console.log(`edges: ${edges.length}  (${countBy(edges, (e) => e.rel)})`);

  // co-voting: distribution + the single highest-agreement pair (expect same club)
  if (coVotes.length) {
    const agrs = coVotes.map((e) => e.agreement).sort((a, b) => a - b);
    const top = [...coVotes].sort((a, b) => b.agreement - a.agreement)[0];
    console.log(
      `\nco_votes_with: agreement min ${agrs[0]} · median ${agrs[(agrs.length / 2) | 0]} · max ${agrs[agrs.length - 1]}`,
    );
    console.log(
      `  strongest pair: ${personName.get(top.src)} (${clubOf(top.src)}) ↔ ` +
        `${personName.get(top.dst)} (${clubOf(top.dst)}) — ${top.agreement} over ${top.shared} shared`,
    );
  }

  // rebellion: top rebels (expect small rates, independents/defectors highest)
  console.log(`\nrebels_against: top 5 by rate`);
  for (const e of rebels.slice(0, 5)) {
    console.log(`  ${String(personName.get(e.person) ?? e.person).padEnd(26)} ${e.clubAbbrev.padEnd(8)} ${e.rate}  (${e.rebelVotes}/${e.eligibleVotes})`);
  }

  // cohesion: every club, most-disciplined first (expect near 1.0)
  console.log(`\nparty cohesion (Rice index):`);
  for (const c of [...cohesion.values()].sort((a, b) => b.cohesion - a.cohesion)) {
    console.log(`  ${c.clubAbbrev.padEnd(8)} ${c.cohesion}  seats ${seatsByClub.get(c.clubOrganId) ?? 0}  votes ${c.votes}`);
  }

  function clubOf(pid: number): string {
    for (const [mandateId, p] of mandateToPerson) if (p === pid) return mandateToClub.get(mandateId)?.abbrev ?? "?";
    return "?";
  }

  /* ── persist ─────────────────────────────────────────────────────────────── */
  console.log(
    `\nprop merge: ${storedById.size} of ${nodes.length} nodes already existed · ` +
      `${preservedProps} stored prop(s) preserved that a from-scratch build would have erased ` +
      `(contribution_score, effort_*, … — see the header).`,
  );

  // The --reset verdict is computed and PRINTED even on a dry run: the operator must
  // be able to see the refusal before reaching for the flag, not after.
  const resetVerdict = reset
    ? guardKgReset({
        storedNodeKinds: await store.kgKindCounts(),
        storedEdgeRels: await store.countKgEdgesByRel(),
        storedNodeIdsOfRebuiltKinds: storedRebuilt.map((n) => n.id),
        rebuiltNodeIds: nodes.map((n) => n.id),
        rebuiltNodeKinds: REBUILT_KINDS,
        rebuiltEdgeRels: edges.map((e) => e.rel),
        supersede,
      })
    : null;
  if (resetVerdict) console.log(`\nreset guard: ${resetVerdict.message}`);

  if (!commit) {
    console.log(`\nDRY-RUN — pass --commit to upsert ${nodes.length} nodes + ${edges.length} edges into kg_node/kg_edge.`);
    await store.close();
    return;
  }
  if (resetVerdict && !resetVerdict.allowed) {
    console.error("\nNOTHING WRITTEN.");
    await store.close();
    process.exit(3);
  }
  if (reset) {
    await store.clearKg();
    console.log(`\ncleared kg_node/kg_edge`);
  }
  const wroteNodes = await store.upsertKgNodes(nodes);
  const wroteEdges = await store.upsertKgEdges(edges);
  console.log(
    `\ncommitted: ${wroteNodes} nodes · ${wroteEdges} edges → ` +
      `kg_node=${await store.countKgNodes()} kg_edge=${await store.countKgEdges()} ${JSON.stringify(await store.countKgEdgesByRel())}`,
  );
  await store.close();
}

function countBy<T>(rows: T[], key: (r: T) => string): string {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([k, n]) => `${k}=${n}`).join(", ");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
