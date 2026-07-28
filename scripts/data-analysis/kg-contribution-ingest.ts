/* Case ② Effort — compute each current MP's CONTRIBUTION score from data already in
 * the graph (committee memberships + voting participation + attendance) and write it
 * onto their person node, plus the Case ② × ① crossover (absentee-manager lead).
 *
 * All scoring is the pure, fixture-tested lib/analysis/contribution.ts; this script is
 * only the store read → assembly → READ-MERGE write. It NEVER clobbers a person node's
 * existing Case-2 props (rebellion_rate, cohesion, …): it reads the node, merges the
 * contribution_* props on top, and keeps firstSeenPass + the original provenance,
 * tagging the enrichment with a contribution_provenance sub-object (a new pass).
 *
 *   npx tsx scripts/data-analysis/kg-contribution-ingest.ts               # dry-run
 *   npx tsx scripts/data-analysis/kg-contribution-ingest.ts --commit      # write
 * Flags: --commit  --term=PSP10  --pass=N
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { absenteeManagerSignal, computeContribution, type CommitteeSeat, type ContributionInputs } from "@/lib/analysis/contribution";
import { isoDay } from "@/lib/analysis/money-feed";
import { emptyCounts, normalizeActivity, type ActivityCounts } from "@/lib/ingest/sources/psp-activity";
import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));

/* Cached psp.cz dump download (same source/UA/cache as scripts/data-analysis/ingest.ts). */
const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
const PSP_BASE = "https://www.psp.cz/eknih/cdrom/opendata";
const UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";
async function getDump(fileName: string, refetch: boolean): Promise<Uint8Array | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (!refetch && existsSync(path)) return new Uint8Array(readFileSync(path));
  try {
    const res = await fetch(`${PSP_BASE}/${fileName}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) {
      console.log(`  ! ${fileName} → HTTP ${res.status}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(path, bytes);
    return bytes;
  } catch (e) {
    console.log(`  ! ${fileName} fetch failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** A cast ballot represents a real position (present + registered a choice). The
 *  merged post-1995 abstain/not-voting bucket (K) still counts as a cast position;
 *  excused / not-logged-in / pre-oath do not. */
const POSITION = new Set(["yes", "no", "abstain", "not_voting", "abstain_or_not_voting"]);

async function main() {
  const commit = flag("commit");
  const term = arg("term", "PSP10");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }

  const persons = await store.listPersons();
  const mandates = (await store.listMandates()).filter((m) => m.termCode === term);
  const memberships = await store.listMemberships({ termCode: term });
  const organs = await store.listOrgans();
  const voteEvents = await store.listVoteEvents({ termCode: term });
  const ballots = await store.listVoteBallots({ termCode: term });
  const absences = await store.listAbsences({ termCode: term });
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();

  const organTypeById = new Map(organs.map((o) => [o.pspId, o.organTypeCz]));
  const personToMandate = new Map(mandates.map((m) => [m.personPspId, m.pspId]));
  const nameById = new Map(persons.map((p) => [p.pspId, p.nameFull]));

  // Participation + attendance denominators (term-level).
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
    arr.push({ organPspId: m.organPspId, organType: m.organPspId != null ? organTypeById.get(m.organPspId) ?? null : null, functionType: m.functionTypeCz });
    seatsByPerson.set(m.personPspId, arr);
  }

  // Money crossover, read from the stored graph (Case ①): companies linked to a person,
  // and the contract CZK those companies supply.
  const linkedCompaniesByPerson = new Map<number, Set<string>>();
  const contractCzkByCompany = new Map<string, number>();
  for (const e of edges) {
    if (e.rel === "linked_to") {
      const m = /^psp:person:(\d+)$/.exec(e.src);
      if (m) {
        const set = linkedCompaniesByPerson.get(Number(m[1])) ?? new Set<string>();
        set.add(e.dst);
        linkedCompaniesByPerson.set(Number(m[1]), set);
      }
    } else if (e.rel === "supplies") {
      contractCzkByCompany.set(e.src, (contractCzkByCompany.get(e.src) ?? 0) + (typeof e.weight === "number" ? e.weight : 0));
    }
  }

  const personNodeById = new Map(nodes.filter((n) => n.kind === "person").map((n) => [n.id, n]));
  const pass = Number(arg("pass")) || Math.max(0, ...nodes.map((n) => n.firstSeenPass)) + 1;
  const computedAt = new Date().toISOString();

  const currentPersonIds = [...new Set(mandates.map((m) => m.personPspId))];
  console.log(`Case ② contribution · term ${term} · ${currentPersonIds.length} MPs · pass ${pass} · ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log(`denominators: ${rollCallsHeld} roll calls over ${sessionDays} sitting days\n`);

  // Effort deepening — psp.cz activity dumps (bill authorship + interpellations + speeches).
  const termPspId = organs.find((o) => o.abbrev === term)?.pspId ?? mandates[0]?.termPspId ?? null;
  let activity = new Map<number, ActivityCounts>();
  if (!flag("no-activity") && termPspId != null) {
    console.log(`psp.cz activity dumps (term organ ${termPspId})…`);
    const refetch = flag("refetch");
    const [tiskyZip, interpZip, stenoZip] = await Promise.all([
      getDump("tisky.zip", refetch),
      getDump("interp.zip", refetch),
      getDump("steno.zip", refetch),
    ]);
    const bundle = normalizeActivity(
      { tiskyZip: tiskyZip ?? undefined, interpZip: interpZip ?? undefined, stenoZip: stenoZip ?? undefined },
      termPspId,
    );
    activity = bundle.byPerson;
    console.log(
      `  → ${bundle.totals.mpAuthoredBills} MP-authored bills · ${bundle.totals.writtenInterpellations} written + ${bundle.totals.oralInterpellations} oral interpellations · ${bundle.totals.speechTurnPeople} MPs spoke\n`,
    );
  }

  const rows: { pid: number; score: number; committees: number; participation: number; bills: number; speeches: number; companies: number; czk: number; absentee: boolean }[] = [];
  const toWrite: KgNodeRow[] = [];
  let missingNode = 0;

  for (const pid of currentPersonIds) {
    const mandatePspId = personToMandate.get(pid);
    const act = activity.get(pid) ?? emptyCounts();
    const inputs: ContributionInputs = {
      personPspId: pid,
      seats: seatsByPerson.get(pid) ?? [],
      ballotsWithPosition: mandatePspId ? positionByMandate.get(mandatePspId) ?? 0 : 0,
      rollCallsHeld,
      excusedDays: mandatePspId ? excusedByMandate.get(mandatePspId)?.size ?? 0 : 0,
      sessionDays,
      billsAuthored: act.billsAuthored,
      interpellations: act.writtenInterpellations + act.oralInterpellations,
      speechTurns: act.speechTurns,
    };
    const profile = computeContribution(inputs);
    const companies = linkedCompaniesByPerson.get(pid) ?? new Set<string>();
    const contractCzk = [...companies].reduce((a, c) => a + (contractCzkByCompany.get(c) ?? 0), 0);
    const signal = absenteeManagerSignal(profile, { linkedCompanies: companies.size, contractCzk });

    rows.push({ pid, score: profile.contributionScore, committees: profile.committeeCount, participation: profile.participationRate, bills: profile.billsAuthored, speeches: profile.speechTurns, companies: companies.size, czk: contractCzk, absentee: signal.isAbsenteeManagerLead });

    const existing = personNodeById.get(`psp:person:${pid}`);
    if (!existing) {
      missingNode++;
      continue;
    }
    toWrite.push({
      id: existing.id,
      kind: "person",
      label: existing.label,
      props: {
        ...existing.props,
        contribution_score: profile.contributionScore,
        committee_count: profile.committeeCount,
        leadership_count: profile.leadershipCount,
        participation_rate: profile.participationRate,
        absence_rate: profile.absenceRate,
        bills_authored: profile.billsAuthored,
        interpellations: profile.interpellations,
        speech_turns: profile.speechTurns,
        absentee_manager_lead: signal.isAbsenteeManagerLead,
        contribution_provenance: { pass, method: "deterministic", ref: "contribution", computedAt },
      },
      firstSeenPass: existing.firstSeenPass,
      provenance: existing.provenance,
    });
  }

  const byScore = [...rows].sort((a, b) => b.score - a.score);
  const line = (r: (typeof rows)[number]) =>
    `    ${(nameById.get(r.pid) ?? `psp:${r.pid}`).padEnd(24)} score ${String(r.score).padStart(5)} · ${r.committees} cmte · part ${r.participation} · ${r.bills}bills ${r.speeches}sp` +
    (r.companies ? ` · ${r.companies} co / ${fmt(r.czk)} CZK` : "");
  console.log("TOP contributors:");
  byScore.slice(0, 5).forEach((r) => console.log(line(r)));
  console.log("BOTTOM contributors:");
  byScore.slice(-5).forEach((r) => console.log(line(r)));

  const leads = rows.filter((r) => r.absentee).sort((a, b) => b.czk - a.czk);
  console.log(`\nABSENTEE-MANAGER LEADS (low effort + real money ties) — ${leads.length}:`);
  leads.forEach((r) => console.log(`  ⚑ ${(nameById.get(r.pid) ?? `psp:${r.pid}`).padEnd(24)} score ${r.score} · ${r.companies} companies · ${fmt(r.czk)} CZK contracts`));

  if (commit) {
    const n = await store.upsertKgNodes(toWrite);
    console.log(`\nCOMMITTED: contribution enriched onto ${n} person nodes (pass ${pass})${missingNode ? ` · ${missingNode} MPs had no graph node (skipped)` : ""}.`);
  } else {
    console.log(`\nDRY-RUN — would enrich ${toWrite.length} person nodes${missingNode ? ` · ${missingNode} MPs have no graph node` : ""}. Re-run with --commit to write.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
