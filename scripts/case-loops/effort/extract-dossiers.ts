/* Case ② Effort — extract the full GRAPH CONTEXT for each army MP into one JSON
 * file, so the enrichment subagents never open the (single-connection) copy.
 *
 * Reads the army from triage.json, pulls each MP's committees, sponsored bills
 * (with fate props + committee routing), co-voters, rebellions, and money edges,
 * and writes docs/data-analysis/case-effort/dossier-inputs.json.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/extract-dossiers.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TERM = "PSP10";
const OUT = "docs/data-analysis/case-effort";
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  type TriageRow = {
    pspId: number;
    zScoreVsClub?: number;
    quietWorkhorse?: boolean;
    quietWorkhorseIndex?: number;
    triageScore?: number;
    componentDivergence?: number;
    tenureClass?: "full_term" | "replacement";
    tenureDays?: number | null;
    workhorseFlavour?: "legislative" | "oversight" | null;
  };
  const triage = JSON.parse(readFileSync(`${OUT}/triage.json`, "utf8")) as {
    army: { pspId: number; lens: string[] }[];
    rows: TriageRow[];
  };
  const armyIds: number[] = triage.army.map((a) => a.pspId);
  const triageByPsp = new Map<number, TriageRow>(triage.rows.map((r) => [r.pspId, r]));

  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const bills = await store.listKgNodes({ kind: "bill", limit: 2000 });
  const organs = await store.listKgNodes({ kind: "organ", limit: 400 });
  const parties = await store.listKgNodes({ kind: "party", limit: 40 });
  const companies = await store.listKgNodes({ kind: "company", limit: 500 });
  const edges = await store.listKgEdges({ limit: 200_000 });
  const mandates = await store.listMandates({ termCode: TERM });
  const clubByMandate = await store.clubByMandate(TERM);
  const rawOrgans = await store.listOrgans({ limit: 3000 });

  const personById = new Map(persons.map((p) => [p.id, p]));
  const billById = new Map(bills.map((b) => [b.id, b]));
  const organById = new Map(organs.map((o) => [o.id, o]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const partyLabelById = new Map(parties.map((p) => [p.id, p.label]));
  const nameByPsp = new Map(persons.map((p) => [Number(p.id.split(":").pop()), p.label]));
  const rawOrganByPsp = new Map(rawOrgans.map((o) => [o.pspId, o]));

  const clubByPerson = new Map<number, string>();
  const regionByPerson = new Map<number, string | null>();
  for (const m of mandates) {
    const club = clubByMandate.get(m.pspId);
    if (club) clubByPerson.set(m.personPspId, club);
    regionByPerson.set(m.personPspId, m.regionPspId ? rawOrganByPsp.get(m.regionPspId)?.nameCz ?? null : null);
  }

  // bill → assigned_to committees
  const billCommittees = new Map<string, { organ: string; role: string; status: string }[]>();
  for (const e of edges) {
    if (e.rel !== "assigned_to") continue;
    const arr = billCommittees.get(e.src) ?? [];
    const o = organById.get(e.dst);
    const p = e.props as { role?: string; status?: string };
    arr.push({ organ: o?.label ?? e.dst, role: p.role ?? "", status: p.status ?? "" });
    billCommittees.set(e.src, arr);
  }

  const dossiers = armyIds.map((pspId) => {
    const selfId = `psp:person:${pspId}`;
    const node = personById.get(selfId);
    const t: TriageRow = triageByPsp.get(pspId) ?? { pspId };

    // sponsored bills
    const sponsoredBillIds = edges.filter((e) => e.rel === "sponsors" && e.src === selfId).map((e) => e.dst);
    const sponsoredBills = sponsoredBillIds.map((bid) => {
      const b = billById.get(bid);
      const props = (b?.props ?? {}) as Record<string, unknown>;
      const coSponsors = (props.sponsors as number[] | undefined ?? []).filter((s) => s !== pspId).map((s) => nameByPsp.get(s) ?? `#${s}`);
      return {
        tiskId: bid.split(":").pop(),
        cislo: num(props.cislo),
        druh: num(props.druh),
        origin: props.origin ?? null,
        submitter: props.submitter ?? null,
        amended_laws: props.amended_laws ?? [],
        flagged_conflict: props.flagged_conflict === true,
        coSponsors,
        committees: billCommittees.get(bid) ?? [],
      };
    });

    // committees (influential_in)
    const committees = edges
      .filter((e) => e.rel === "influential_in" && e.src === selfId)
      .map((e) => {
        const o = organById.get(e.dst);
        return {
          abbrev: o?.label ?? e.dst,
          organType: (o?.props as { organ_type?: string } | undefined)?.organ_type ?? null,
          nameCz: rawOrganByPsp.get(Number(e.dst.split(":").pop()))?.nameCz ?? null,
          role: (e.props as { role?: string }).role ?? "member",
          weight: num(e.weight),
        };
      })
      .sort((a, b) => b.weight - a.weight);

    // top co-voters
    const coVoters = edges
      .filter((e) => e.rel === "co_votes_with" && (e.src === selfId || e.dst === selfId))
      .map((e) => {
        const other = e.src === selfId ? e.dst : e.src;
        const op = Number(other.split(":").pop());
        return { name: nameByPsp.get(op) ?? `#${op}`, club: clubByPerson.get(op) ?? "—", agreement: num(e.weight), shared: num((e.props as { shared?: number }).shared) };
      })
      .sort((a, b) => b.agreement - a.agreement)
      .slice(0, 6);

    // rebellions
    const rebellions = edges
      .filter((e) => e.rel === "rebels_against" && e.src === selfId)
      .map((e) => {
        const p = e.props as { club?: string; rebelVotes?: number; eligibleVotes?: number };
        return { club: p.club ?? partyLabelById.get(e.dst) ?? "—", rate: num(e.weight), rebelVotes: num(p.rebelVotes), eligibleVotes: num(p.eligibleVotes) };
      })
      .sort((a, b) => b.rate - a.rate);

    // money edges
    const linkedCompanies = edges
      .filter((e) => e.rel === "linked_to" && e.src === selfId)
      .map((e) => {
        const c = companyById.get(e.dst);
        const cp = (c?.props ?? {}) as Record<string, unknown>;
        const contractCzk = edges.filter((x) => x.rel === "supplies" && x.src === e.dst).reduce((a, x) => a + num(x.weight), 0);
        return { company: c?.label ?? e.dst, ico: cp.ico ?? null, reviewState: (e.props as { review_state?: string }).review_state ?? "pending_review", contractCzk };
      });

    return {
      pspId,
      name: node?.label ?? nameByPsp.get(pspId) ?? `#${pspId}`,
      club: clubByPerson.get(pspId) ?? "—",
      region: regionByPerson.get(pspId) ?? null,
      lens: triage.army.find((a: { pspId: number }) => a.pspId === pspId)?.lens ?? [],
      props: {
        contribution_score: num(node?.props.contribution_score),
        participation_rate: num(node?.props.participation_rate),
        committee_count: num(node?.props.committee_count),
        leadership_count: num(node?.props.leadership_count),
        absence_rate: num(node?.props.absence_rate),
        bills_authored: num(node?.props.bills_authored),
        interpellations: num(node?.props.interpellations),
        speech_turns: num(node?.props.speech_turns),
        absentee_manager_lead: node?.props.absentee_manager_lead === true,
        contested_vote_rebellion: node?.props.contested_vote_rebellion ?? null,
        rebellion_rate: node?.props.rebellion_rate ?? null,
      },
      // PSP9 term-over-term profile (pass-14 restoration) — real prior-term comparison
      // where the MP continued from PSP9; null when not a continuing MP.
      contributionPsp9: node?.props.contribution_psp9 ?? null,
      triage: {
        zVsClub: t.zScoreVsClub,
        quietWorkhorse: t.quietWorkhorse,
        quietWorkhorseIndex: t.quietWorkhorseIndex,
        workhorseFlavour: t.workhorseFlavour ?? null,
        triageScore: t.triageScore,
        componentDivergence: t.componentDivergence ?? null,
        tenureClass: t.tenureClass ?? "full_term",
        tenureDays: t.tenureDays ?? null,
      },
      committees,
      sponsoredBills,
      coVoters,
      rebellions,
      linkedCompanies,
    };
  });

  writeFileSync(`${OUT}/dossier-inputs.json`, JSON.stringify({ generatedAt: new Date().toISOString(), term: TERM, dossiers }, null, 2));
  console.log(`Wrote ${dossiers.length} dossier inputs.`);
  for (const d of dossiers) {
    console.log(`  ${d.name.padEnd(24)} ${d.club.padEnd(8)} score ${d.props.contribution_score} · ${d.sponsoredBills.length} bills · ${d.committees.length} cmte · ${d.linkedCompanies.length} co · [${d.lens.join(",")}]`);
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
