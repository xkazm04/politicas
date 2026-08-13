/* Contribution index — the 2026-07-29 CORRECTION recompute (committee breadth counts
 * distinct BODIES, not psp.cz membership ROWS; stored rates gain 2 decimals).
 *
 * Why this exists instead of re-running kg-contribution-ingest.ts: that script re-derives
 * bills/interpellations/speeches from LIVE psp.cz dumps, so a re-run today would silently
 * fold whatever the chamber has done since pass 11 into a commit whose stated subject is a
 * formula correction. This pass changes ONE thing and proves it:
 *
 *   · every non-committee input is taken VERBATIM off the person node (bills_authored,
 *     interpellations, speech_turns) or recomputed from the SAME store rows pass 11 read
 *     (ballots, absences, roll calls);
 *   · before writing anything it REPLAYS the old formula over those inputs and refuses to
 *     commit unless the replayed score equals the stored `contribution_score` for EVERY MP.
 *     If the replay disagrees, the store is not the one pass 11 scored and a "correction"
 *     would be a rewrite — so it aborts instead.
 *
 * ── RELATION TO kg-contribution-ingest.ts (2026-08-04) ─────────────────────────────
 * That script is the OTHER writer of these props. It re-derives from live psp.cz dumps
 * and now refuses `--commit` over nodes stamped with a ref it does not stamp itself
 * (guardContributionWrite) — so it can no longer quietly overwrite a correction this
 * script applied. This script needs no such guard: its REPLAY GATE is stronger, since it
 * refuses to write unless the OLD formula reproduces every stored value first, which no
 * store written by a third formula can satisfy.
 *
 * This script is also the ONLY one that moves `contribution_psp9`, the PSP9 trend
 * baseline; the ingest states on every commit that it leaves it alone.
 *
 * The pre-correction formula it replays lives in lib/analysis/contribution-legacy.ts,
 * deliberately frozen (its saturation literals must NOT follow the live formula — a
 * moving proof gate proves nothing).
 *
 * MERGE-PRESERVING (memory/kg-upsert-replaces-props.md): upsertKgNodes REPLACES props, so
 * every write here is `{...liveNode.props, ...corrected}` over the node read in this run,
 * and only person nodes are touched. firstSeenPass + node provenance are carried through.
 *
 *   npx tsx scripts/data-analysis/kg-contribution-recompute.ts                 # dry-run
 *   npx tsx scripts/data-analysis/kg-contribution-recompute.ts --commit --pass=42
 * Flags: --commit  --term=PSP10  --pass=N  --json=<path>  (audit table for the commit body)
 */
import { writeFileSync } from "node:fs";

import {
  absenteeManagerSignal,
  computeContribution,
  COMMITTEE_SATURATION,
  CONTRIBUTION_FORMULA_REF,
  CONTRIBUTION_WEIGHTS,
  isCommitteeSeat,
  type CommitteeSeat,
} from "@/lib/analysis/contribution";
import { legacyScore } from "@/lib/analysis/contribution-legacy";
import { nextPass } from "@/lib/analysis/kg";
import { isoDay } from "@/lib/analysis/money-feed";
import { staleScoreWarnings } from "@/lib/analysis/score-citations";
import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Same ballot vocabulary as kg-contribution-ingest.ts (pass 11). */
const POSITION = new Set(["yes", "no", "abstain", "not_voting", "abstain_or_not_voting"]);

async function main() {
  const commit = flag("commit");
  const term = arg("term", "PSP10");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }

  const mandates = (await store.listMandates()).filter((m) => m.termCode === term);
  const memberships = await store.listMemberships({ termCode: term });
  const priorTerm = arg("priorTerm", "PSP9");
  const priorMemberships = await store.listMemberships({ termCode: priorTerm });
  const organs = await store.listOrgans();
  const voteEvents = await store.listVoteEvents({ termCode: term });
  const ballots = await store.listVoteBallots({ termCode: term });
  const absences = await store.listAbsences({ termCode: term });
  const personNodes = await store.listKgNodes({ kind: "person", limit: 1000 });

  const organTypeById = new Map(organs.map((o) => [o.pspId, o.organTypeCz]));
  const personToMandate = new Map(mandates.map((m) => [m.personPspId, m.pspId]));

  // Denominators — identical derivation to pass 11.
  const activeVotes = voteEvents.filter((v) => !v.voided && v.kind !== "manual");
  const rollCallsHeld = activeVotes.length;
  const sessionDays = new Set(activeVotes.map((v) => (v.votedAt ? isoDay(v.votedAt) : null)).filter(Boolean)).size;

  const positionByMandate = new Map<number, number>();
  for (const b of ballots) if (POSITION.has(b.choice)) positionByMandate.set(b.mandatePspId, (positionByMandate.get(b.mandatePspId) ?? 0) + 1);
  const excusedByMandate = new Map<number, Set<string>>();
  for (const a of absences) {
    const d = isoDay(a.day);
    if (!d) continue;
    const s = excusedByMandate.get(a.mandatePspId) ?? new Set<string>();
    s.add(d);
    excusedByMandate.set(a.mandatePspId, s);
  }

  const seatsByPerson = new Map<number, CommitteeSeat[]>();
  for (const m of memberships) {
    const arr = seatsByPerson.get(m.personPspId) ?? [];
    arr.push({
      organPspId: m.organPspId,
      organType: m.organPspId != null ? organTypeById.get(m.organPspId) ?? null : null,
      functionType: m.functionTypeCz,
    });
    seatsByPerson.set(m.personPspId, arr);
  }

  // Prior-term (PSP9) committee seats — the trend baseline `contribution_psp9` was scored by
  // the SAME formula, so leaving it on the row basis would make the term-over-term delta
  // report a committee change that never happened. Only its committee-derived fields are
  // touched; its legislative/speech numbers come from psp.cz dumps this pass never reads.
  const priorSeatsByPerson = new Map<number, CommitteeSeat[]>();
  for (const m of priorMemberships) {
    const arr = priorSeatsByPerson.get(m.personPspId) ?? [];
    arr.push({
      organPspId: m.organPspId,
      organType: m.organPspId != null ? organTypeById.get(m.organPspId) ?? null : null,
      functionType: m.functionTypeCz,
    });
    priorSeatsByPerson.set(m.personPspId, arr);
  }
  const committeePoints = (n: number) => round1(clamp01(n / COMMITTEE_SATURATION) * CONTRIBUTION_WEIGHTS.committee);

  // Money crossover — the absentee-manager lead has to be re-evaluated because scores move
  // across its 40-point threshold. Read exactly as pass 11 read it.
  const linkedByPerson = new Map<number, Set<string>>();
  for (const e of await store.listKgEdges({ rel: "linked_to" })) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    if (!m) continue;
    const set = linkedByPerson.get(Number(m[1])) ?? new Set<string>();
    set.add(e.dst);
    linkedByPerson.set(Number(m[1]), set);
  }
  const contractCzkByCompany = new Map<string, number>();
  for (const e of await store.listKgEdges({ rel: "supplies" })) {
    contractCzkByCompany.set(e.src, (contractCzkByCompany.get(e.src) ?? 0) + (typeof e.weight === "number" ? e.weight : 0));
  }

  const nodeById = new Map(personNodes.map((n) => [n.id, n]));
  const pass = Number(arg("pass")) || nextPass(personNodes);
  const computedAt = new Date().toISOString();

  const currentPersonIds = [...new Set(mandates.map((m) => m.personPspId))];
  console.log(`Contribution CORRECTION recompute · term ${term} · ${currentPersonIds.length} MPs · pass ${pass} · ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log(`denominators: ${rollCallsHeld} roll calls over ${sessionDays} sitting days`);

  const audit: {
    pid: number;
    name: string;
    scoreBefore: number;
    scoreAfter: number;
    committeeBefore: number;
    committeeAfter: number;
    leadershipBefore: number;
    leadershipAfter: number;
    absenteeBefore: boolean;
    absenteeAfter: boolean;
  }[] = [];
  const replayMismatch: string[] = [];
  const toWrite: KgNodeRow[] = [];
  let missingNode = 0;
  let psp9Nodes = 0;
  let psp9Moved = 0;
  const psp9Skipped: string[] = [];

  for (const pid of currentPersonIds) {
    const node = nodeById.get(`psp:person:${pid}`);
    if (!node) {
      missingNode++;
      continue;
    }
    const psp9Raw = node.props.contribution_psp9;
    if (psp9Raw != null) psp9Nodes++;

    const mandatePspId = personToMandate.get(pid);
    const seats = seatsByPerson.get(pid) ?? [];
    const ballotsWithPosition = mandatePspId ? positionByMandate.get(mandatePspId) ?? 0 : 0;
    const excusedDays = mandatePspId ? excusedByMandate.get(mandatePspId)?.size ?? 0 : 0;
    const bills = num(node.props.bills_authored);
    const interpellations = num(node.props.interpellations);
    const speechTurns = num(node.props.speech_turns);

    const rawParticipation = rollCallsHeld > 0 ? clamp01(ballotsWithPosition / rollCallsHeld) : 0;
    const rawAbsence = sessionDays > 0 ? clamp01(excusedDays / sessionDays) : 0;

    // ── proof gate: replay the OLD formula over these inputs ────────────────────
    const legacy = legacyScore({ seats, participationRate: rawParticipation, absenceRate: rawAbsence, bills, interpellations, speechTurns });
    const storedScore = num(node.props.contribution_score);
    const problems: string[] = [];
    if (legacy.score !== storedScore) problems.push(`score ${legacy.score} ≠ stored ${storedScore}`);
    if (legacy.committeeRows !== num(node.props.committee_count)) problems.push(`committee ${legacy.committeeRows} ≠ stored ${num(node.props.committee_count)}`);
    if (legacy.leadershipRows !== num(node.props.leadership_count)) problems.push(`leadership ${legacy.leadershipRows} ≠ stored ${num(node.props.leadership_count)}`);
    if (legacy.participationRate !== num(node.props.participation_rate)) problems.push(`participation ${legacy.participationRate} ≠ stored ${num(node.props.participation_rate)}`);
    if (legacy.absenceRate !== num(node.props.absence_rate)) problems.push(`absence ${legacy.absenceRate} ≠ stored ${num(node.props.absence_rate)}`);
    if (problems.length > 0) replayMismatch.push(`  ${node.label} — ${problems.join("; ")}`);

    // ── the corrected profile ──────────────────────────────────────────────────
    const profile = computeContribution({
      personPspId: pid,
      seats,
      ballotsWithPosition,
      rollCallsHeld,
      excusedDays,
      sessionDays,
      billsAuthored: bills,
      interpellations,
      speechTurns,
    });
    const companies = linkedByPerson.get(pid) ?? new Set<string>();
    const contractCzk = [...companies].reduce((a, c) => a + (contractCzkByCompany.get(c) ?? 0), 0);
    const signal = absenteeManagerSignal(profile, { linkedCompanies: companies.size, contractCzk });

    audit.push({
      pid,
      name: node.label,
      scoreBefore: storedScore,
      scoreAfter: profile.contributionScore,
      committeeBefore: num(node.props.committee_count),
      committeeAfter: profile.committeeCount,
      leadershipBefore: num(node.props.leadership_count),
      leadershipAfter: profile.leadershipCount,
      absenteeBefore: node.props.absentee_manager_lead === true,
      absenteeAfter: signal.isAbsenteeManagerLead,
    });

    // ── the prior-term baseline, committee fields only ─────────────────────────
    let psp9Corrected: Record<string, unknown> | undefined;
    if (psp9Raw && typeof psp9Raw === "object") {
      const p9 = psp9Raw as Record<string, unknown>;
      const priorSeats = (priorSeatsByPerson.get(pid) ?? []).filter(isCommitteeSeat);
      const legacyRows = priorSeats.length;
      if (legacyRows !== num(p9.committeeCount)) {
        // The stored baseline was not produced from these rows — leave it alone and say so
        // rather than overwrite a number we cannot reproduce.
        psp9Skipped.push(`${node.label} (rows ${legacyRows} ≠ stored ${num(p9.committeeCount)})`);
      } else {
        const p9profile = computeContribution({
          personPspId: pid,
          seats: priorSeats,
          ballotsWithPosition: 0,
          rollCallsHeld: 0,
          excusedDays: 0,
          sessionDays: 0,
        });
        const oldComps = (p9.components ?? {}) as Record<string, number | null>;
        const deltaCommittee = round1(committeePoints(p9profile.committeeCount) - num(oldComps.committee));
        if (deltaCommittee !== 0) psp9Moved++;
        psp9Corrected = {
          ...p9,
          committeeCount: p9profile.committeeCount,
          leadershipCount: p9profile.leadershipCount,
          components: { ...oldComps, committee: committeePoints(p9profile.committeeCount) },
          availablePoints: round1(num(p9.availablePoints) + deltaCommittee),
          score: typeof p9.score === "number" ? round1(p9.score + deltaCommittee) : p9.score,
          committee_correction: { pass, ref: CONTRIBUTION_FORMULA_REF, computedAt },
        };
      }
    }

    toWrite.push({
      id: node.id,
      kind: "person",
      label: node.label,
      // MERGE, never rebuild — the node carries effort-loop dossier props from passes 32–38.
      props: {
        ...node.props,
        contribution_score: profile.contributionScore,
        committee_count: profile.committeeCount,
        leadership_count: profile.leadershipCount,
        participation_rate: profile.participationRate,
        absence_rate: profile.absenceRate,
        absentee_manager_lead: signal.isAbsenteeManagerLead,
        ...(psp9Corrected ? { contribution_psp9: psp9Corrected } : {}),
        // The ref is NEVER a literal here — it comes from the formula that just scored
        // this node (lib/analysis/contribution.ts CONTRIBUTION_FORMULA_REF), so the data
        // cannot claim a lineage the code does not declare. See that constant's contract.
        contribution_provenance: {
          pass,
          method: "deterministic",
          ref: CONTRIBUTION_FORMULA_REF,
          computedAt,
          corrects: "committee_count counted psp.cz membership ROWS; it now counts distinct BODIES",
        },
      },
      firstSeenPass: node.firstSeenPass,
      provenance: node.provenance,
    });
  }

  if (replayMismatch.length > 0) {
    console.error(`\nABORT — the OLD formula replayed over this store does not reproduce the stored values for ${replayMismatch.length}/${currentPersonIds.length} MPs:`);
    replayMismatch.slice(0, 10).forEach((l) => console.error(l));
    console.error("This store is not the one the stored scores were computed from; a 'correction' here would be an unattributable rewrite. Nothing written.");
    await store.close();
    process.exit(2);
  }
  console.log(`replay gate: OLD formula reproduces stored score/committee/leadership/rates for ${currentPersonIds.length - missingNode}/${currentPersonIds.length} MPs ✓`);
  if (psp9Nodes > 0) {
    console.log(
      `contribution_psp9 (prior-term baseline): ${psp9Nodes} nodes carry it · committee fields corrected on ${psp9Nodes - psp9Skipped.length} · ${psp9Moved} baselines actually move · ${psp9Skipped.length} left untouched (unreproducible)`,
    );
    psp9Skipped.slice(0, 5).forEach((s) => console.log(`    skipped: ${s}`));
  }

  const moved = audit.filter((a) => a.scoreAfter !== a.scoreBefore);
  const pointsRemoved = round1(moved.reduce((s, a) => s + (a.scoreBefore - a.scoreAfter), 0));
  const satBefore = audit.filter((a) => a.committeeBefore >= COMMITTEE_SATURATION).length;
  const satAfter = audit.filter((a) => a.committeeAfter >= COMMITTEE_SATURATION).length;
  const rankOf = (key: "scoreBefore" | "scoreAfter") => {
    const sorted = [...audit].sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name, "cs"));
    return new Map(sorted.map((a, i) => [a.pid, i + 1]));
  };
  const rankBefore = rankOf("scoreBefore");
  const rankAfter = rankOf("scoreAfter");
  const rankMoved = audit.filter((a) => rankBefore.get(a.pid) !== rankAfter.get(a.pid));

  console.log(`\nscore changed for ${moved.length}/${audit.length} MPs · ${pointsRemoved} index points removed · saturated (≥${COMMITTEE_SATURATION} bodies) ${satBefore} → ${satAfter}`);
  console.log(`rank changed for ${rankMoved.length}/${audit.length} MPs (strict descending, name tie-break — the ordering in place today)`);
  console.log(`absentee-manager leads: ${audit.filter((a) => a.absenteeBefore).length} → ${audit.filter((a) => a.absenteeAfter).length}`);
  console.log("\nlargest score drops:");
  [...moved]
    .sort((a, b) => b.scoreBefore - b.scoreAfter - (a.scoreBefore - a.scoreAfter))
    .slice(0, 15)
    .forEach((a) =>
      console.log(
        `  ${a.name.padEnd(28)} ${a.scoreBefore} → ${a.scoreAfter} (${round1(a.scoreAfter - a.scoreBefore)}) · ${a.committeeBefore}→${a.committeeAfter} bodies · rank ${rankBefore.get(a.pid)} → ${rankAfter.get(a.pid)}`,
      ),
    );
  const biggestRankGain = [...audit]
    .map((a) => ({ a, d: (rankBefore.get(a.pid) ?? 0) - (rankAfter.get(a.pid) ?? 0) }))
    .sort((x, y) => y.d - x.d)
    .slice(0, 5);
  console.log("\nlargest rank GAINS (unchanged score, others fell past them):");
  biggestRankGain.forEach(({ a, d }) => console.log(`  ${a.name.padEnd(28)} rank ${rankBefore.get(a.pid)} → ${rankAfter.get(a.pid)} (+${d})`));

  // ── PROSE INVALIDATED BY THIS RECOMPUTE ────────────────────────────────────
  // A dossier is WRITTEN AGAINST a score, so moving the score silently makes the prose
  // that quotes it wrong. Pass 42 moved 33 scores and nothing noticed that 16 analyst
  // fields on 16 MPs still carried the superseded number — for six days, on the public
  // profile page (found by Case ② batch 010, which had to reconstruct the before-state
  // from a backup copy of the store to see it).
  //
  // This check belongs HERE and nowhere else: it needs both the old and the new value,
  // and this is the only place that holds both. It reports; it never edits prose.
  const staleProse: string[] = [];
  for (const a of moved) {
    const node = nodeById.get(`psp:person:${a.pid}`);
    if (!node) continue;
    for (const [field, text] of Object.entries(node.props)) {
      if (typeof text !== "string" || !field.startsWith("effort_")) continue;
      staleProse.push(...staleScoreWarnings(a.name, field, text, a.scoreBefore, a.scoreAfter));
    }
  }
  if (staleProse.length) {
    console.log(`\n⚠ PROSE INVALIDATED BY THIS RECOMPUTE · ${staleProse.length} field(s) quote a score this pass supersedes.`);
    console.log("  These are analyst-written and are NOT corrected here — the numeral may sit inside a");
    console.log("  claim (a trend, a comparison to a club mean) that the new value can break. Route them");
    console.log("  through the case loop's rewrite path before the correction is considered shipped.");
    staleProse.forEach((w) => console.log(`  ⚠ ${w}`));
  } else {
    console.log("\nprose check: no dossier field quotes a score this recompute supersedes.");
  }

  const jsonPath = arg("json");
  if (jsonPath) {
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          computedAt,
          pass,
          moved: moved.length,
          pointsRemoved,
          saturation: { before: satBefore, after: satAfter },
          rows: audit.map((a) => ({ ...a, rankBefore: rankBefore.get(a.pid), rankAfter: rankAfter.get(a.pid) })),
        },
        null,
        1,
      ),
    );
    console.log(`\naudit written to ${jsonPath}`);
  }

  if (commit) {
    const n = await store.upsertKgNodes(toWrite);
    console.log(`\nCOMMITTED: ${n} person nodes corrected (pass ${pass})${missingNode ? ` · ${missingNode} MPs had no graph node (skipped)` : ""}.`);
  } else {
    console.log(`\nDRY-RUN — would correct ${toWrite.length} person nodes. Re-run with --commit to write.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
