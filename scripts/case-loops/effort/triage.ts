/* Case ② Effort — deterministic TRIAGE over the 207 PSP10 person nodes.
 *
 * Reads a COPY of the graph (PGLITE_PATH=./.pglite-copy-effort) — never the live
 * store — and emits the case ledger + triage ranking. NO LLM, NO writes to the
 * graph: this only READS person props (authored by kg-contribution-ingest) and
 * edges, computes club-baseline z-scores + the four triage lenses, and writes:
 *   docs/data-analysis/case-effort/ledger.json   (machine state, 207 rows)
 *   docs/data-analysis/case-effort/triage.json    (ranked signals + army pick)
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/triage.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TERM = "PSP10";
const OUT = "docs/data-analysis/case-effort";

const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const nullableNum = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

interface MpRow {
  pspId: number;
  name: string;
  club: string;
  score: number;
  participationRate: number;
  committeeCount: number;
  leadershipCount: number;
  absenceRate: number;
  billsAuthored: number;
  interpellations: number;
  speechTurns: number;
  absenteeManagerLead: boolean;
  contestedVoteRebellion: number | null;
  rebellionRate: number | null;
  linkedCompanies: number;
  contractCzk: number;
  // triage-derived
  zScoreVsClub: number; // composite z vs club mean
  quietWorkhorse: boolean;
  quietWorkhorseIndex: number;
  triageScore: number;
  lens: string[]; // which selection lenses caught this MP
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const mandates = (await store.listMandates({ termCode: TERM })) ?? [];
  const clubByMandate = await store.clubByMandate(TERM);
  const edges = await store.listKgEdges({ limit: 200_000 });

  // personPspId → club
  const clubByPerson = new Map<number, string>();
  for (const m of mandates) {
    const club = clubByMandate.get(m.pspId);
    if (club) clubByPerson.set(m.personPspId, club);
  }

  // money crossover from edges
  const linkedByPerson = new Map<number, Set<string>>();
  const contractCzkByCompany = new Map<string, number>();
  for (const e of edges) {
    if (e.rel === "linked_to") {
      const mt = /^psp:person:(\d+)$/.exec(e.src);
      if (mt) {
        const s = linkedByPerson.get(Number(mt[1])) ?? new Set<string>();
        s.add(e.dst);
        linkedByPerson.set(Number(mt[1]), s);
      }
    } else if (e.rel === "supplies") {
      contractCzkByCompany.set(e.src, (contractCzkByCompany.get(e.src) ?? 0) + num(e.weight));
    }
  }

  const rows: MpRow[] = persons.map((p) => {
    const pspId = Number(p.id.split(":").pop());
    const club = clubByPerson.get(pspId) ?? "—";
    const companies = linkedByPerson.get(pspId) ?? new Set<string>();
    const contractCzk = [...companies].reduce((a, c) => a + (contractCzkByCompany.get(c) ?? 0), 0);
    return {
      pspId,
      name: p.label,
      club,
      score: num(p.props.contribution_score),
      participationRate: num(p.props.participation_rate),
      committeeCount: num(p.props.committee_count),
      leadershipCount: num(p.props.leadership_count),
      absenceRate: num(p.props.absence_rate),
      billsAuthored: num(p.props.bills_authored),
      interpellations: num(p.props.interpellations),
      speechTurns: num(p.props.speech_turns),
      absenteeManagerLead: p.props.absentee_manager_lead === true,
      contestedVoteRebellion: nullableNum(p.props.contested_vote_rebellion),
      rebellionRate: nullableNum(p.props.rebellion_rate),
      linkedCompanies: companies.size,
      contractCzk,
      zScoreVsClub: 0,
      quietWorkhorse: false,
      quietWorkhorseIndex: 0,
      triageScore: 0,
      lens: [],
    };
  });

  // ── club baselines (mean + sd of score per club) ──────────────────────────
  const byClub = new Map<string, number[]>();
  for (const r of rows) {
    const a = byClub.get(r.club) ?? [];
    a.push(r.score);
    byClub.set(r.club, a);
  }
  const clubStats = new Map<string, { mean: number; sd: number; n: number }>();
  for (const [club, arr] of byClub) {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length) || 1e-9;
    clubStats.set(club, { mean, sd, n: arr.length });
  }
  for (const r of rows) {
    const cs = clubStats.get(r.club)!;
    r.zScoreVsClub = round((r.score - cs.mean) / cs.sd, 2);
  }

  // ── quiet workhorse: high committee+legislative work, low speech/visibility ─
  // Chamber-relative percentiles for the "work" axis vs the "visibility" axis.
  const workAxis = (r: MpRow) => r.committeeCount * 4 + r.leadershipCount * 6 + r.billsAuthored * 3 + r.interpellations * 2;
  const visAxis = (r: MpRow) => r.speechTurns;
  const works = rows.map(workAxis).sort((a, b) => a - b);
  const viss = rows.map(visAxis).sort((a, b) => a - b);
  const pct = (sorted: number[], v: number) => {
    let lo = 0;
    for (const x of sorted) if (x < v) lo++;
    return lo / sorted.length;
  };
  for (const r of rows) {
    const wp = pct(works, workAxis(r));
    const vp = pct(viss, visAxis(r));
    // quiet workhorse: work >= 60th pct AND visibility <= 35th pct
    r.quietWorkhorseIndex = round(wp - vp, 3);
    r.quietWorkhorse = wp >= 0.6 && vp <= 0.35;
  }

  // ── composite triage score: |z| (outlierness) + money crossover + rebellion ─
  for (const r of rows) {
    r.triageScore = round(
      Math.abs(r.zScoreVsClub) +
        (r.absenteeManagerLead ? 2 : 0) +
        (r.quietWorkhorse ? 1.5 : 0) +
        (r.contestedVoteRebellion ?? 0) * 1.5,
      3,
    );
  }

  // ── army selection: top5 + bottom5 composite, 5 absentee, 5 quiet workhorse ─
  const byScore = [...rows].sort((a, b) => b.score - a.score);
  const top5 = byScore.slice(0, 5);
  const bottom5 = byScore.slice(-5);
  const absenteeLeads = rows
    .filter((r) => r.absenteeManagerLead)
    .sort((a, b) => b.contractCzk - a.contractCzk)
    .slice(0, 5);
  const quietWorkhorses = rows
    .filter((r) => r.quietWorkhorse)
    .sort((a, b) => b.quietWorkhorseIndex - a.quietWorkhorseIndex);

  const pick = new Map<number, { row: MpRow; lens: string[] }>();
  const add = (r: MpRow, lens: string) => {
    const e = pick.get(r.pspId) ?? { row: r, lens: [] };
    if (!e.lens.includes(lens)) e.lens.push(lens);
    pick.set(r.pspId, e);
  };
  top5.forEach((r) => add(r, "top5"));
  bottom5.forEach((r) => add(r, "bottom5"));
  absenteeLeads.forEach((r) => add(r, "absentee"));
  // fill quiet-workhorse slots up to 20 total, best-index first, not already picked
  let qwCount = 0;
  for (const r of quietWorkhorses) {
    if (pick.size >= 20 && !pick.has(r.pspId)) break;
    if (qwCount >= 5 && !pick.has(r.pspId)) continue;
    add(r, "quiet-workhorse");
    qwCount++;
  }
  // if still under 20, add next-highest triage-score MPs
  const byTriage = [...rows].sort((a, b) => b.triageScore - a.triageScore);
  for (const r of byTriage) {
    if (pick.size >= 20) break;
    add(r, "high-triage");
  }

  for (const [pid, e] of pick) {
    const r = rows.find((x) => x.pspId === pid)!;
    r.lens = e.lens;
  }

  // ── ledger.json: 207 rows, stage=pending ──────────────────────────────────
  mkdirSync(OUT, { recursive: true });
  const ledger = {
    case: "effort",
    term: TERM,
    generatedAt: new Date().toISOString(),
    population: rows.length,
    batch: 1,
    units: rows
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({
        pspId: r.pspId,
        name: r.name,
        club: r.club,
        rank: i + 1,
        contribution_score: r.score,
        stage: "pending" as const,
        batch: null as number | null,
        signal: null as number | null,
        flags: {
          absentee_manager_lead: r.absenteeManagerLead,
          quiet_workhorse: r.quietWorkhorse,
          contested_vote_rebellion: r.contestedVoteRebellion,
          z_vs_club: r.zScoreVsClub,
        },
      })),
  };
  writeFileSync(`${OUT}/ledger.json`, JSON.stringify(ledger, null, 2));

  // ── triage.json: full signal detail + army ────────────────────────────────
  const army = [...pick.values()]
    .map((e) => e.row)
    .sort((a, b) => b.triageScore - a.triageScore);
  const triage = {
    generatedAt: new Date().toISOString(),
    clubStats: Object.fromEntries([...clubStats].map(([k, v]) => [k, { mean: round(v.mean, 1), sd: round(v.sd, 2), n: v.n }])),
    rows: [...rows].sort((a, b) => b.triageScore - a.triageScore),
    army: army.map((r) => ({ pspId: r.pspId, name: r.name, club: r.club, score: r.score, lens: r.lens, triageScore: r.triageScore, z: r.zScoreVsClub })),
  };
  writeFileSync(`${OUT}/triage.json`, JSON.stringify(triage, null, 2));

  // ── console summary ───────────────────────────────────────────────────────
  console.log(`TRIAGE · ${rows.length} MPs · clubs ${clubStats.size}`);
  console.log("\nClub baselines (mean score):");
  [...clubStats].sort((a, b) => b[1].mean - a[1].mean).forEach(([c, s]) => console.log(`  ${c.padEnd(10)} n=${String(s.n).padStart(3)} mean ${round(s.mean, 1)} sd ${round(s.sd, 1)}`));

  console.log(`\nTOP 5 score:`);
  top5.forEach((r) => console.log(`  ${r.name.padEnd(26)} ${r.club.padEnd(8)} ${r.score}  z=${r.zScoreVsClub}`));
  console.log(`BOTTOM 5 score:`);
  bottom5.forEach((r) => console.log(`  ${r.name.padEnd(26)} ${r.club.padEnd(8)} ${r.score}  z=${r.zScoreVsClub}`));
  console.log(`\nABSENTEE-MANAGER LEADS: ${rows.filter((r) => r.absenteeManagerLead).length}`);
  absenteeLeads.forEach((r) => console.log(`  ⚑ ${r.name.padEnd(26)} ${r.club.padEnd(8)} score ${r.score} · ${r.linkedCompanies}co · ${new Intl.NumberFormat("cs-CZ").format(Math.round(r.contractCzk))} CZK`));
  console.log(`\nQUIET WORKHORSES: ${quietWorkhorses.length}`);
  quietWorkhorses.slice(0, 10).forEach((r) => console.log(`  ✎ ${r.name.padEnd(26)} ${r.club.padEnd(8)} score ${r.score} · ${r.committeeCount}cmte ${r.leadershipCount}lead ${r.billsAuthored}bills ${r.speechTurns}sp · qwi=${r.quietWorkhorseIndex}`));

  console.log(`\nARMY (${army.length}):`);
  army.forEach((r) => console.log(`  ${r.name.padEnd(26)} ${r.club.padEnd(8)} score ${String(r.score).padStart(5)} · triage ${String(r.triageScore).padStart(5)} · [${r.lens.join(", ")}]`));

  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
