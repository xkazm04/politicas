/* Case ② Effort — BUILD phase: PSP9 (2021–2025 term) contribution restoration.
 *
 * Computes each CONTINUING MP's PSP9 contribution profile from the data available
 * on the graph COPY and writes it as a namespaced `contribution_psp9` sub-object
 * onto the person node — enabling the /poslanec + /zebricek TREND UI to show a real
 * term-over-term delta instead of the honestly-deleted fabricated one.
 *
 * FLEET MODE: writes ONLY to the copy (PGLITE_PATH=./.pglite-copy-effort). Live
 * write is a handoff item. NEVER touches ./.pglite.
 *
 * DATA AVAILABILITY (measured 2026-07-24, psp.cz network-blocked from this env):
 *   - committee/leadership : ✅ PSP9 memberships are already in the store (cross-term
 *                              registry), scoped via the organ tree (term PSP9 = organ 173).
 *   - legislative/speech   : ✅ from the CACHED activity dumps (tisky/interp/steno.zip),
 *                              filtered to termPspId 173.
 *   - participation/attendance : ⚠️ require the PSP9 roll-call dump (hl-2021ps.zip) which
 *                              is NOT yet ingested. Stored as null + flagged `complete:false`.
 *                              When the orchestrator runs the live vote ingest (handoff),
 *                              re-running this fills them and flips `complete:true`.
 *
 * Numbers come ONLY from computeContribution (gate a): we run it with the real
 * committee + activity inputs and take the four VOTE-INDEPENDENT components; the
 * vote-dependent ones are nulled rather than computed from empty denominators
 * (which would fabricate attendance=full). No contribution number is hand-authored.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/psp9-contribution.ts        # dry-run
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/psp9-contribution.ts --commit
 * Flags: --commit  --priorTerm=PSP9  --currentTerm=PSP10  --pass=N
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeContribution, type CommitteeSeat, type ContributionInputs } from "@/lib/analysis/contribution";
import { emptyCounts, normalizeActivity, type ActivityCounts } from "@/lib/ingest/sources/psp-activity";
import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";

const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
const arg = (name: string, fb = ""): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

/** A cached psp.cz dump, or null if not present locally (no network in fleet env). */
function cachedDump(fileName: string): Uint8Array | null {
  const p = join(CACHE_DIR, fileName);
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
}

const POSITION = new Set(["yes", "no", "abstain", "not_voting", "abstain_or_not_voting"]);

async function main() {
  const commit = flag("commit");
  const priorTerm = arg("priorTerm", "PSP9");
  const currentTerm = arg("currentTerm", "PSP10");
  const store = await getStore();
  if (!store) throw new Error("no store");

  const organs = await store.listOrgans({ limit: 5000 });
  const priorOrgan = organs.find((o) => o.abbrev === priorTerm);
  if (!priorOrgan) throw new Error(`no organ for ${priorTerm}`);
  const priorTermPspId = priorOrgan.pspId;

  const persons = await store.listPersons();
  const nameById = new Map(persons.map((p) => [p.pspId, p.nameFull]));
  const priorMandates = await store.listMandates({ termCode: priorTerm });
  const currentMandates = await store.listMandates({ termCode: currentTerm });
  const priorMemberships = await store.listMemberships({ termCode: priorTerm });
  const organTypeById = new Map(organs.map((o) => [o.pspId, o.organTypeCz]));

  // continuing MPs = held a mandate in BOTH terms
  const priorPersons = new Set(priorMandates.map((m) => m.personPspId));
  const currentPersons = new Set(currentMandates.map((m) => m.personPspId));
  const continuing = [...currentPersons].filter((pid) => priorPersons.has(pid));

  // PSP9 roll-call denominators — present only if hl-<prior>ps.zip was ingested.
  const priorVoteEvents = (await store.listVoteEvents({ termCode: priorTerm })).filter((v) => !v.voided && v.kind !== "manual");
  const priorBallots = await store.listVoteBallots({ termCode: priorTerm });
  const priorAbsences = (await store.listAbsences({ termCode: priorTerm })).filter((a) => a.termPspId === priorTermPspId);
  const votesPresent = priorVoteEvents.length > 0 && priorBallots.length > 0;

  const rollCallsHeld = priorVoteEvents.length;
  const sessionDays = new Set(priorVoteEvents.map((v) => (v.votedOn ? v.votedOn.slice(0, 10) : null)).filter(Boolean)).size;
  const positionByMandate = new Map<number, number>();
  for (const b of priorBallots) if (POSITION.has(b.choice)) positionByMandate.set(b.mandatePspId, (positionByMandate.get(b.mandatePspId) ?? 0) + 1);
  const excusedByMandate = new Map<number, Set<string>>();
  for (const a of priorAbsences) {
    const d = a.day?.slice(0, 10);
    if (!d) continue;
    const s = excusedByMandate.get(a.mandatePspId) ?? new Set<string>();
    s.add(d);
    excusedByMandate.set(a.mandatePspId, s);
  }
  const priorMandateByPerson = new Map(priorMandates.map((m) => [m.personPspId, m.pspId]));

  // committee seats per person for PSP9
  const seatsByPerson = new Map<number, CommitteeSeat[]>();
  for (const m of priorMemberships) {
    const arr = seatsByPerson.get(m.personPspId) ?? [];
    arr.push({ organType: m.organPspId != null ? organTypeById.get(m.organPspId) ?? null : null, functionType: m.functionTypeCz });
    seatsByPerson.set(m.personPspId, arr);
  }

  // PSP9 activity from cached dumps
  const tiskyZip = cachedDump("tisky.zip");
  const interpZip = cachedDump("interp.zip");
  const stenoZip = cachedDump("steno.zip");
  const activity = new Map<number, ActivityCounts>(
    (tiskyZip || interpZip || stenoZip)
      ? normalizeActivity({ tiskyZip: tiskyZip ?? undefined, interpZip: interpZip ?? undefined, stenoZip: stenoZip ?? undefined }, priorTermPspId).byPerson
      : [],
  );

  console.log(`PSP9 contribution restoration · prior=${priorTerm}(organ ${priorTermPspId}) current=${currentTerm}`);
  console.log(`continuing MPs: ${continuing.length} · votesPresent: ${votesPresent} (rollCalls ${rollCallsHeld}, ballots ${priorBallots.length})`);
  console.log(`activity dumps: tisky=${!!tiskyZip} interp=${!!interpZip} steno=${!!stenoZip}\n`);

  const nodes = await store.listKgNodes({ kind: "person", limit: 1000 });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pass = Number(arg("pass")) || 0;
  const computedAt = new Date().toISOString();

  const toWrite: KgNodeRow[] = [];
  const preview: { name: string; committee: number; leadership: number; legislative: number; speech: number; bills: number; interp: number; sp: number; part: number | null }[] = [];
  let missingNode = 0;

  for (const pid of continuing) {
    const seats = seatsByPerson.get(pid) ?? [];
    const act = activity.get(pid) ?? emptyCounts();
    const mandatePspId = priorMandateByPerson.get(pid);
    const inputs: ContributionInputs = {
      personPspId: pid,
      seats,
      ballotsWithPosition: mandatePspId ? positionByMandate.get(mandatePspId) ?? 0 : 0,
      rollCallsHeld,
      excusedDays: mandatePspId ? excusedByMandate.get(mandatePspId)?.size ?? 0 : 0,
      sessionDays,
      billsAuthored: act.billsAuthored,
      interpellations: act.writtenInterpellations + act.oralInterpellations,
      speechTurns: act.speechTurns,
    };
    const p = computeContribution(inputs);

    // Take vote-INDEPENDENT components always; vote-dependent only if the roll-call
    // dump is present. Otherwise null them (never fabricate attendance from 0 votes).
    const participation = votesPresent ? p.components.participation : null;
    const attendance = votesPresent ? p.components.attendance : null;
    const participationRate = votesPresent ? p.participationRate : null;
    const absenceRate = votesPresent ? p.absenceRate : null;
    const availablePts = p.components.committee + p.components.leadership + p.components.legislative + p.components.speech + (participation ?? 0) + (attendance ?? 0);

    const contributionPsp9 = {
      term: priorTerm,
      complete: votesPresent,
      missing: votesPresent ? [] : ["participation", "attendance"],
      committeeCount: p.committeeCount,
      leadershipCount: p.leadershipCount,
      billsAuthored: p.billsAuthored,
      interpellations: p.interpellations,
      speechTurns: p.speechTurns,
      participationRate,
      absenceRate,
      score: votesPresent ? p.contributionScore : null, // full 0–100 only when complete
      availablePoints: Math.round(availablePts * 10) / 10, // sum of the components we DO have
      components: {
        committee: p.components.committee,
        leadership: p.components.leadership,
        legislative: p.components.legislative,
        speech: p.components.speech,
        participation,
        attendance,
      },
      provenance: { track: "effort", pass, method: "deterministic", ref: "contribution-psp9", computedAt },
    };

    preview.push({ name: nameById.get(pid) ?? `#${pid}`, committee: p.components.committee, leadership: p.components.leadership, legislative: p.components.legislative, speech: p.components.speech, bills: p.billsAuthored, interp: p.interpellations, sp: p.speechTurns, part: participationRate });

    const existing = nodeById.get(`psp:person:${pid}`);
    if (!existing) {
      missingNode++;
      continue;
    }
    toWrite.push({
      id: existing.id,
      kind: "person",
      label: existing.label,
      props: { ...existing.props, contribution_psp9: contributionPsp9 },
      firstSeenPass: existing.firstSeenPass,
      provenance: existing.provenance,
    });
  }

  preview.sort((a, b) => b.legislative + b.speech - (a.legislative + a.speech));
  console.log("Sample PSP9 partial profiles (vote-independent components; sorted by legislative+speech):");
  preview.slice(0, 12).forEach((r) => console.log(`  ${r.name.padEnd(24)} cmte ${r.committee} lead ${r.leadership} legis ${r.legislative} speech ${r.speech} · ${r.bills}b ${r.interp}i ${r.sp}sp · part ${r.part ?? "—"}`));

  if (commit) {
    const n = await store.upsertKgNodes(toWrite);
    console.log(`\nCOMMITTED contribution_psp9 onto ${n} person nodes · complete=${votesPresent}${missingNode ? ` · ${missingNode} missing nodes` : ""}.`);
  } else {
    console.log(`\nDRY-RUN — would write contribution_psp9 onto ${toWrite.length} person nodes (complete=${votesPresent}). Re-run with --commit.`);
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
