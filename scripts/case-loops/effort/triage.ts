/* Case ② Effort — deterministic TRIAGE over the 207 PSP10 person nodes.
 *
 * Reads a COPY of the graph (PGLITE_PATH=./.pglite-copy-effort) — never the live
 * store — and emits the case ledger + triage ranking. NO LLM, NO writes to the
 * graph: this only READS person props (authored by kg-contribution-ingest) and
 * edges, computes club-baseline z-scores + the triage lenses, and writes:
 *   docs/data-analysis/case-effort/ledger.json   (machine state, 207 rows)
 *   docs/data-analysis/case-effort/triage.json    (ranked signals + army pick)
 *
 * Batch-aware (batch 002+): if ledger.json already exists from a prior batch, this
 * run picks up where it left off — units whose stage != "pending" are DONE and are
 * excluded from the new army pool; the new batch number is prior batch + 1.
 *
 * Batch-002 addition (Q-effort-1, the batch-001 lesson made real): a deterministic
 * `never_cast_ballot` pre-filter (participation_rate==0 && committee_count==0) runs
 * BEFORE the absentee-manager crossover, so phantom/declined mandates never consume
 * an absentee-lead army slot again, and gets a deterministic `effort_low_score_reason`
 * candidate (`declined_mandate`) attached directly — no Opus dossier needed for the
 * mechanical case.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/triage.ts
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/triage.ts --army=30
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TERM = "PSP10";
const OUT = "docs/data-analysis/case-effort";

// Q-effort-12 (batch 004): role_window_mismatch meta-class (batch-003 reflection) — the
// mid-term role change floor-artifact (minister/deputy_pm/prime_minister/institutional
// promotion). These MPs' low plenary props are a SCORE-WINDOW artifact, not a one-sided
// work profile, so they must not consume a componentDivergence army slot. Sourced from
// batch-003's own dossiers (§Headline finding) — effort_low_score_reason is set for
// Fiala/Plaga already (prior batches); the 6 batch-003 instances get their reason payload
// this batch (see batch-004-role-window-mismatch.json) but are excluded from the lens
// here regardless of persist timing, since triage always reads the live graph BEFORE
// this batch's own payload lands.
const ROLE_WINDOW_MISMATCH_PSP_IDS = new Set([
  6621, // Karel Havlíček — 1st Deputy PM + Industry & Trade, since 2025-12-15
  7022, // Petr Macinka — Deputy PM + Foreign Affairs, since 2025-12
  6545, // Alena Schillerová — Minister of Finance, since 2025-12-15
  6150, // Andrej Babiš — Prime Minister, since 2025-12-09
  6544, // Lubomír Metnar — Minister of Interior, since 2025-12-15
  6788, // Barbora Urbanová — Deputy Speaker of the Chamber, since 2026-06-05
]);

const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const nullableNum = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

const argArmy = process.argv.find((a) => a.startsWith("--army="));
const ARMY_SIZE = argArmy ? Number(argArmy.split("=")[1]) : 20;

interface PriorUnit { pspId: number; stage: string; batch: number | null; signal: number | null }
interface PriorLedger { batch: number; units: PriorUnit[] }

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
  hasPsp9: boolean;
  // triage-derived
  zScoreVsClub: number; // composite z vs club mean
  quietWorkhorse: boolean;
  quietWorkhorseIndex: number;
  workhorseFlavour: "legislative" | "oversight" | null; // P31: two positive-symmetry flavours
  neverCastBallot: boolean; // batch-002 pre-filter (Q-effort-1)
  tenureClass: "full_term" | "replacement" | "departed" | "never_seated"; // Q-effort-5 (batch 003), 4-class synced batch 004
  tenureDays: number | null;
  componentDivergence: number; // batch-003 retune (Q-effort-6): stddev of 6 (club×tenure_class)-cohort
  // z-scored components — one-sided vs COMPARABLE peers, not vs an absolute 0-1 scale.
  // See scripts/case-loops/effort/divergence-retune.ts for the discriminative-power validation
  // (old sd 0.098 → new sd 0.323, distinct values 38→95 of 207) that justified this replacement.
  triageScore: number;
  lens: string[]; // which selection lenses caught this MP
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  // ── resume state: prior ledger tells us the batch number + who is already done ──
  let priorBatch = 0;
  const doneIds = new Set<number>();
  const priorUnitsById = new Map<number, PriorUnit>();
  if (existsSync(`${OUT}/ledger.json`)) {
    const prior = JSON.parse(readFileSync(`${OUT}/ledger.json`, "utf8")) as PriorLedger;
    priorBatch = prior.batch ?? 0;
    for (const u of prior.units) {
      priorUnitsById.set(u.pspId, u);
      if (u.stage && u.stage !== "pending") doneIds.add(u.pspId);
    }
  }
  const BATCH = priorBatch + 1;

  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const mandates = (await store.listMandates({ termCode: TERM })) ?? [];
  const clubByMandate = await store.clubByMandate(TERM);
  const edges = await store.listKgEdges({ limit: 200_000 });
  const memberships = (await store.listMemberships({ termCode: TERM, limit: 200_000 })) ?? [];

  // ── Q-effort-5 (batch 003) / batch-004 SYNC FIX: tenure, from membership.fromAt/toAt on
  // organ 174 (the PSP10 chamber itself) — the only reliable per-person start date in this
  // ingest (mandate table's own mandateFrom/mandateTo columns are almost entirely null).
  // Used both for the tenure annotation payload (tenure.ts) and to cohort
  // componentDivergence below. Batch-004 reflection (Opus QA) caught that THIS file still
  // carried the OLD fromAt-only 2-class classifier after tenure.ts was made end-date-aware
  // in batch 003 (toAt → departed/never_seated) — meaning ledger.json/triage.json recorded
  // Beran, Šichtařová, Kott (all departed) as full_term/293d, the exact artefact batch 003
  // shipped a fix for, just in the wrong file. Fixed here to match tenure.ts exactly.
  const CHAMBER_ORGAN_PSP_ID = 174;
  const chamberFromByPerson = new Map<number, string>();
  const chamberToByPerson = new Map<number, string>();
  for (const m of memberships) {
    if (m.organPspId === CHAMBER_ORGAN_PSP_ID && m.kind === "member" && m.fromAt) {
      const existing = chamberFromByPerson.get(m.personPspId);
      if (!existing || m.fromAt < existing) {
        chamberFromByPerson.set(m.personPspId, m.fromAt);
        if (m.toAt) chamberToByPerson.set(m.personPspId, m.toAt); else chamberToByPerson.delete(m.personPspId);
      }
    }
  }
  const startFreq = new Map<string, number>();
  for (const d of chamberFromByPerson.values()) startFreq.set(d.slice(0, 10), (startFreq.get(d.slice(0, 10)) ?? 0) + 1);
  let modeStartDay = "", modeStartCount = 0;
  for (const [d, n] of startFreq) if (n > modeStartCount) { modeStartDay = d; modeStartCount = n; }
  const tenureClassOf = (pspId: number, participationRate: number, committeeCount: number): "full_term" | "replacement" | "departed" | "never_seated" => {
    const iso = chamberFromByPerson.get(pspId);
    const toIso = chamberToByPerson.get(pspId);
    if (toIso) {
      const neverCast = participationRate === 0 && committeeCount === 0;
      return neverCast ? "never_seated" : "departed";
    }
    return iso && iso.slice(0, 10) === modeStartDay ? "full_term" : "replacement";
  };

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
    const participationRate = num(p.props.participation_rate);
    const committeeCount = num(p.props.committee_count);
    return {
      pspId,
      name: p.label,
      club,
      score: num(p.props.contribution_score),
      participationRate,
      committeeCount,
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
      hasPsp9: p.props.contribution_psp9 != null,
      zScoreVsClub: 0,
      quietWorkhorse: false,
      quietWorkhorseIndex: 0,
      workhorseFlavour: null,
      neverCastBallot: participationRate === 0 && committeeCount === 0,
      tenureClass: tenureClassOf(pspId, participationRate, committeeCount),
      tenureDays: chamberFromByPerson.has(pspId)
        ? Math.round(
            ((chamberToByPerson.has(pspId) ? new Date(chamberToByPerson.get(pspId)!) : new Date("2026-07-24T00:00:00.000Z")).getTime() -
              new Date(chamberFromByPerson.get(pspId)!).getTime()) /
              86_400_000,
          )
        : null,
      componentDivergence: 0,
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
    // P31: two positive-symmetry flavours — legislative-authorship vs oversight-institutional
    if (r.quietWorkhorse) {
      r.workhorseFlavour = r.billsAuthored > 0 ? "legislative" : "oversight";
    }
  }

  // ── component divergence V2 (batch-003 retune, Q-effort-6) ──────────────────
  // Old (batch-002) definition: stddev of the 6 raw 0-1 normalized components, same
  // absolute yardstick for every MP — near-degenerate (most MPs clustered 0.4-0.48,
  // sd 0.098 over the full population, per divergence-retune.ts's validation run).
  // New: CLUB-RELATIVE (z-score each component against a cohort mean/sd, not an absolute
  // 0-1 scale) and PARTICIPATION-PAIRED (the cohort is club × tenure_class, using the
  // Q-effort-5 tenure annotation above, so a 35-day replacement MP is never compared
  // against full-term clubmates' participation denominators). Cohorts under 3 members
  // fall back to club-wide, then population-wide. Validated: sd 0.098 → 0.323, distinct
  // values (2dp) 38 → 95 of 207 — see payloads/batch-003-divergence-validation.json.
  const COMMITTEE_SAT = 3, LEGIS_SAT = 4, SPEECH_SAT = 40;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const meanSd = (vals: number[]) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1e-9;
    return { mean, sd };
  };
  const compsOf = (r: MpRow) => [
    clamp01(r.committeeCount / COMMITTEE_SAT),
    r.leadershipCount > 0 ? 1 : 0,
    r.participationRate,
    1 - r.absenceRate,
    clamp01((r.billsAuthored + r.interpellations) / LEGIS_SAT),
    clamp01(r.speechTurns / SPEECH_SAT),
  ];
  // Q-effort-12 (batch 004): replacement MPs are pooled CROSS-CLUB (cohort key drops the
  // club for tenureClass=="replacement") — batch 003's club::tenure_class cohorting put
  // 3 of 7 replacements in cohorts <3, which fell all the way back to club-wide and undid
  // the participation-pairing intent entirely. Pooling all replacements together (7 MPs,
  // still short-tenure peers of each other regardless of club) keeps the comparison
  // meaningful without falling back past it.
  const cohortKey = (r: MpRow) => (r.tenureClass === "replacement" ? "replacement::ALL" : `${r.club}::${r.tenureClass}`);
  const byCohort = new Map<string, MpRow[]>();
  const byClubAll = new Map<string, MpRow[]>();
  for (const r of rows) {
    (byCohort.get(cohortKey(r)) ?? byCohort.set(cohortKey(r), []).get(cohortKey(r))!).push(r);
    (byClubAll.get(r.club) ?? byClubAll.set(r.club, []).get(r.club)!).push(r);
  }
  // Q-effort-12: MIN_COHORT raised 3 → 8 (batch-003 reflection: tiny cohorts are
  // self-referential — a 3-member cohort z-scores each member almost entirely against
  // itself, which is not a meaningful "outlier vs peers" signal).
  //
  // BUG FOUND BY BATCH-004 OPUS REFLECTION, FIXED HERE: raising MIN_COHORT to 8 in the
  // same change that pooled the 7 replacement MPs into "replacement::ALL" was a NO-OP —
  // 7 < 8, so the pooled cohort was discarded on every replacement MP and all 7 fell
  // straight back to club-wide, the exact distortion the pooling was written to remove
  // (it now fired on 7/7 instead of the pre-fix 3/7). The "replacement::ALL" cohort is a
  // deliberate DESIGN cohort (all short-tenure peers, intentionally pooled), not an
  // accidental small one, so it is exempted from the MIN_COHORT floor below.
  const MIN_COHORT = 8;
  const REPLACEMENT_POOL_KEY = "replacement::ALL";
  const popCompStats = [0, 1, 2, 3, 4, 5].map((i) => meanSd(rows.map((r) => compsOf(r)[i])));
  for (const r of rows) {
    const key = cohortKey(r);
    let group = byCohort.get(key)!;
    let basis: "cohort" | "club" | "population" = "cohort";
    const exemptFromMinCohort = key === REPLACEMENT_POOL_KEY; // deliberate design cohort, not accidental
    if (!exemptFromMinCohort && group.length < MIN_COHORT) { group = byClubAll.get(r.club)!; basis = "club"; }
    if (!exemptFromMinCohort && group.length < MIN_COHORT) basis = "population";
    const myComps = compsOf(r);
    const zScores = [0, 1, 2, 3, 4, 5].map((i) => {
      const { mean, sd } = basis === "population" ? popCompStats[i] : meanSd(group.map((g) => compsOf(g)[i]));
      return (myComps[i] - mean) / sd;
    });
    r.componentDivergence = round(meanSd(zScores).sd, 3);
  }

  // ── composite triage score: |z| (outlierness) + money crossover + rebellion ─
  // Batch-002: never_cast_ballot MPs are DOWN-weighted for the absentee dimension
  // (pre-filter, Q-effort-1) — their z-outlierness alone can still surface them for
  // clean-stage annotation, but they no longer inflate as "absentee" candidates.
  for (const r of rows) {
    r.triageScore = round(
      Math.abs(r.zScoreVsClub) +
        (r.absenteeManagerLead && !r.neverCastBallot ? 2 : 0) +
        (r.quietWorkhorse ? 1.5 : 0) +
        (r.contestedVoteRebellion ?? 0) * 1.5 +
        r.componentDivergence * 1.2,
      3,
    );
  }

  // ── pool: remaining (not yet processed in a prior batch) ──────────────────
  const pool = rows.filter((r) => !doneIds.has(r.pspId));

  // ── Q-effort-1: never_cast_ballot pre-filter over ALL 207 (not just the pool) ──
  const neverCastAll = rows.filter((r) => r.neverCastBallot);
  const neverCastNew = neverCastAll.filter((r) => !doneIds.has(r.pspId)); // newly discovered this batch

  // ── army selection from the POOL: extremes + absentee (phantom-filtered) +
  //    quiet-workhorse (fixed slots, BOTH flavours) + contested-rebellion overlap +
  //    component-divergence (mid-band, one-sided composition) ──────────────────
  const byScorePool = [...pool].sort((a, b) => b.score - a.score);
  const topN = byScorePool.slice(0, 6);
  // batch-003 tenure-normalization (Q-effort-5 steering): exclude replacement MPs from the
  // "bottom" lens too — a short-tenure MP's low ABSOLUTE score is a tenure artifact, not a
  // laggard signal (same reasoning as the never_cast_ballot pre-filter, extended). Filter
  // FIRST, then take the true lowest 4 by score (filtering after slicing would bias toward
  // the higher-scoring end of the sliced window — fixed during batch-003 development).
  const bottomN = byScorePool
    .filter((r) => !r.neverCastBallot && r.tenureClass !== "replacement")
    .slice(-4);
  const absenteeLeadsPool = pool
    .filter((r) => r.absenteeManagerLead && !r.neverCastBallot) // pre-filter FIRST
    .sort((a, b) => b.contractCzk - a.contractCzk);
  const quietLegislative = pool
    .filter((r) => r.workhorseFlavour === "legislative")
    .sort((a, b) => b.quietWorkhorseIndex - a.quietWorkhorseIndex)
    .slice(0, 4);
  const quietOversight = pool
    .filter((r) => r.workhorseFlavour === "oversight")
    .sort((a, b) => b.quietWorkhorseIndex - a.quietWorkhorseIndex)
    .slice(0, 4);
  const contestedOverlap = pool
    .filter((r) => (r.contestedVoteRebellion ?? 0) >= 5)
    .sort((a, b) => (b.contestedVoteRebellion ?? 0) - (a.contestedVoteRebellion ?? 0))
    .slice(0, 5);
  // threshold recalibrated for the V2 scale (was 0.35 on the old ~0-0.5 scale; new metric
  // runs roughly 0-2, population mean ~0.76 — use the top-quartile-ish 0.9 cut, still
  // paired with the mid-band score condition so a "divergent" pick means one-sided WORK,
  // not just a structural floor/ceiling score)
  // Q-effort-12: exclude never_cast_ballot (already its own "phantom-mandate" lens),
  // role_window_mismatch, AND tenure_class=="replacement" (batch-004 reflection: a 55-day
  // replacement MP — Forman — still took a divergence slot even after the MIN_COHORT/
  // cohort-pooling fix, because pooling only changes the Z-SCORE BASIS, not whether a
  // short-tenure MP's one-sided profile is a real signal or a structural artifact; the
  // lens itself must exclude the class, the same way it already excludes never_cast_ballot
  // and role_window_mismatch) from the divergence lens.
  const divergent = pool
    .filter((r) => r.componentDivergence >= 0.9 && r.score >= 35 && r.score <= 75) // mid-band, one-sided
    .filter((r) => !r.neverCastBallot && !ROLE_WINDOW_MISMATCH_PSP_IDS.has(r.pspId) && r.tenureClass !== "replacement" && r.tenureClass !== "departed" && r.tenureClass !== "never_seated")
    .sort((a, b) => b.componentDivergence - a.componentDivergence)
    .slice(0, 6);

  const pick = new Map<number, { row: MpRow; lens: string[] }>();
  const add = (r: MpRow, lens: string) => {
    const e = pick.get(r.pspId) ?? { row: r, lens: [] };
    if (!e.lens.includes(lens)) e.lens.push(lens);
    pick.set(r.pspId, e);
  };
  topN.forEach((r) => add(r, "top"));
  bottomN.forEach((r) => add(r, "bottom"));
  absenteeLeadsPool.forEach((r) => add(r, "absentee"));
  quietLegislative.forEach((r) => add(r, "quiet-workhorse-legislative"));
  quietOversight.forEach((r) => add(r, "quiet-workhorse-oversight"));
  contestedOverlap.forEach((r) => add(r, "contested"));
  divergent.forEach((r) => add(r, "divergence"));
  // never_cast_ballot MPs newly discovered this batch get a mechanical clean-stage slot
  // too (cheap: declined_mandate is deterministic, but a one-line dossier still runs the
  // enrich stage to confirm the executive-office story, per the batch-001 pattern).
  neverCastNew.forEach((r) => add(r, "phantom-mandate"));
  // fill remaining slots up to ARMY_SIZE with next-highest triage-score MPs from the pool
  const byTriagePool = [...pool].sort((a, b) => b.triageScore - a.triageScore);
  for (const r of byTriagePool) {
    if (pick.size >= ARMY_SIZE) break;
    add(r, "high-triage");
  }

  for (const [pid, e] of pick) {
    const r = rows.find((x) => x.pspId === pid)!;
    r.lens = e.lens;
  }

  // ── ledger.json: 207 rows, carry forward prior batches' stage/signal ──────
  mkdirSync(`${OUT}/payloads`, { recursive: true });
  const ledger = {
    case: "effort",
    term: TERM,
    generatedAt: new Date().toISOString(),
    population: rows.length,
    batch: BATCH,
    units: rows
      .sort((a, b) => b.score - a.score)
      .map((r, i) => {
        const prior = priorUnitsById.get(r.pspId);
        const inArmy = pick.has(r.pspId);
        return {
          pspId: r.pspId,
          name: r.name,
          club: r.club,
          rank: i + 1,
          contribution_score: r.score,
          stage: prior?.stage && prior.stage !== "pending" ? prior.stage : inArmy ? "triaged" : ("pending" as const),
          batch: prior?.batch ?? (inArmy ? BATCH : null),
          signal: prior?.signal ?? null,
          flags: {
            absentee_manager_lead: r.absenteeManagerLead,
            never_cast_ballot: r.neverCastBallot,
            quiet_workhorse: r.quietWorkhorse,
            workhorse_flavour: r.workhorseFlavour,
            contested_vote_rebellion: r.contestedVoteRebellion,
            z_vs_club: r.zScoreVsClub,
            component_divergence: r.componentDivergence,
            tenure_class: r.tenureClass,
            tenure_days: r.tenureDays,
          },
        };
      }),
  };
  writeFileSync(`${OUT}/ledger.json`, JSON.stringify(ledger, null, 2));

  // ── triage.json: full signal detail + army ────────────────────────────────
  const army = [...pick.values()]
    .map((e) => e.row)
    .sort((a, b) => b.triageScore - a.triageScore);
  const triage = {
    generatedAt: new Date().toISOString(),
    batch: BATCH,
    clubStats: Object.fromEntries([...clubStats].map(([k, v]) => [k, { mean: round(v.mean, 1), sd: round(v.sd, 2), n: v.n }])),
    neverCastBallot: { totalAcrossPopulation: neverCastAll.length, newThisBatch: neverCastNew.map((r) => ({ pspId: r.pspId, name: r.name, club: r.club })) },
    rows: [...rows].sort((a, b) => b.triageScore - a.triageScore),
    army: army.map((r) => ({
      pspId: r.pspId,
      name: r.name,
      club: r.club,
      score: r.score,
      lens: r.lens,
      triageScore: r.triageScore,
      z: r.zScoreVsClub,
      neverCastBallot: r.neverCastBallot,
      hasPsp9: r.hasPsp9,
    })),
  };
  writeFileSync(`${OUT}/triage.json`, JSON.stringify(triage, null, 2));

  // ── console summary ───────────────────────────────────────────────────────
  console.log(`TRIAGE batch ${BATCH} · ${rows.length} MPs · pool ${pool.length} (${doneIds.size} already done) · clubs ${clubStats.size}`);
  console.log(`\nQ-effort-1 never_cast_ballot: ${neverCastAll.length} total across population, ${neverCastNew.length} new this batch:`);
  neverCastNew.forEach((r) => console.log(`  ⚑ ${r.name.padEnd(26)} ${r.club.padEnd(8)} — participation 0, committee 0 → effort_low_score_reason candidate: declined_mandate`));

  console.log(`\nARMY (${army.length}) for batch ${BATCH}:`);
  army.forEach((r) => console.log(`  ${r.name.padEnd(26)} ${r.club.padEnd(8)} score ${String(r.score).padStart(5)} · triage ${String(r.triageScore).padStart(5)} · [${r.lens.join(", ")}]`));

  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
