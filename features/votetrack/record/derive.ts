// Pure derivation of the Seismograf vote record from the REAL ingested ledger.
//
// DB-free by design (the lib/analysis/kg.ts convention): inputs are plain typed
// rows + lookup maps, so every rule here is unit-tested in derive.test.ts and the
// loader (getVoteRecord.ts) stays a thin IO shell. Nothing in this module is
// authored by an LLM at runtime — counts, lines, Rice indices and rebellion rows
// are computed from ballots, or they do not exist.
//
// Disclosed rules (rendered verbatim in the UI copy):
//   • The club line is the STRICT majority of the club's positional (yes/no)
//     ballots on that vote; a tie yields no line and the vote is skipped for
//     that club. Same rule as lib/analysis/kg.ts `rebellion()`.
//   • The K bucket (zdržel se / nehlasoval, merged by the Chamber since
//     90/1995 Sb.) is NON-POSITIONAL: it never counts as agreement or rebellion.
//   • Voided (zmatečná) roll calls are excluded from every metric.
//   • Chamber cohesion per vote = positional-weighted mean of per-club Rice
//     indices over clubs with ≥ MIN_CLUB_POSITIONAL positional ballots.
//   • MPs without a resolved club (nezařazení) render but are never scored.
//   • Every recount is checked against the Chamber's OWN published tallies
//     (record/reconcile.ts); a difference is DISCLOSED, never repaired.

import { MIN_CLUB_POSITIONAL, MIN_ELIGIBLE_VOTES } from "@/lib/analysis/kg";
import { reconcileRecord, type PublishedTally } from "./reconcile";
import type {
  ChronicleEntry,
  ClubAggregate,
  ClubTally,
  ClubVoteStat,
  FullVoteRecord,
  LedgerVote,
  RebelEntry,
  RebelRank,
  SeismoDay,
  VoteIndexEntry,
  VoteStat,
} from "./types";

/** How many recent roll calls ship to the client at full ledger granularity.
 * The seismogram covers ALL valid votes; the window exists purely to bound the
 * page payload, and the UI states it. */
export const LEDGER_WINDOW = 48;
/** Chronicle / top-rebel caps — presentation bounds, disclosed in copy. */
export const CHRONICLE_CAP = 24;
export const TOP_REBELS_CAP = 12;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/* ── inputs ────────────────────────────────────────────────────────────────── */

export interface EventIn {
  pspId: number;
  votedOn: string | null;
  votedAt: string | null;
  sessionNo: number | null;
  voteNo: number | null;
  outcome: string;
  voided: boolean;
  titleLong: string | null;
  titleShort: string | null;
  titleNorm: string;
  sourceUrl: string;
  /**
   * The Chamber's OWN published tallies for this roll call (`vote_event.yes/no/
   * abstain/not_voting`). OPTIONAL on purpose: a caller that does not carry them
   * (features/profile/getRebellionRecord.ts builds its own EventIn rows) yields an
   * UNCOMPARED roll call — never a guessed one. Filled by `toEventIn` in
   * ledgerRead.ts, which is the read path both /hlasovani and /kompas go through.
   */
  published?: PublishedTally | null;
}

export interface BallotIn {
  votePspId: number;
  mandatePspId: number;
  choice: string;
}

export interface DeriveOptions {
  minClubPositional?: number;
  minEligible?: number;
  ledgerWindow?: number;
  chronicleCap?: number;
  topRebelsCap?: number;
}

/* ── choice classification ─────────────────────────────────────────────────── */

export type Bucket = "yes" | "no" | "k" | "away";

/** Store VoteChoice vocabulary (lib/ingest/normalize.ts) → display bucket.
 * abstain / not_voting / the merged K bucket are presence WITHOUT a position;
 * everything else non-positional means the MP was not at the desk. */
export function bucketOf(choice: string): Bucket {
  switch (choice) {
    case "yes":
      return "yes";
    case "no":
      return "no";
    case "abstain":
    case "not_voting":
    case "abstain_or_not_voting":
      return "k";
    default:
      return "away";
  }
}

const emptyTally = (): ClubTally => ({ yes: 0, no: 0, k: 0, away: 0 });

const addTally = (t: ClubTally, b: Bucket) => {
  t[b]++;
};

/** Strict-majority line over a tally; tie or no positional votes → null. */
export function lineOf(t: ClubTally): "yes" | "no" | null {
  if (t.yes === t.no) return null;
  return t.yes > t.no ? "yes" : "no";
}

/** max(yes,no)/(yes+no), 3dp; null without positional votes. */
export function disciplineOf(t: ClubTally): number | null {
  const pos = t.yes + t.no;
  if (pos === 0) return null;
  return round3(Math.max(t.yes, t.no) / pos);
}

/** Rice index |yes−no|/(yes+no), 3dp; null without positional votes. */
export function riceOf(t: ClubTally): number | null {
  const pos = t.yes + t.no;
  if (pos === 0) return null;
  return round3(Math.abs(t.yes - t.no) / pos);
}

/** Positional-weighted mean Rice over clubs with ≥ minClubPositional positional
 * ballots; null when no club qualifies. */
export function chamberCohesion(
  byClub: Readonly<Record<string, ClubVoteStat>>,
  minClubPositional: number = MIN_CLUB_POSITIONAL,
): number | null {
  let weight = 0;
  let sum = 0;
  for (const stat of Object.values(byClub)) {
    const pos = stat.yes + stat.no;
    if (pos < minClubPositional || stat.rice === null) continue;
    weight += pos;
    sum += stat.rice * pos;
  }
  return weight === 0 ? null : round3(sum / weight);
}

/* ── the full derivation ───────────────────────────────────────────────────── */

const titleOf = (e: EventIn): string => {
  const t = (e.titleLong ?? e.titleShort ?? e.titleNorm ?? "").trim();
  return t || `#${e.pspId}`;
};

/** Deterministic newest-first order: date, then session, then vote number. */
const newestFirst = (a: EventIn, b: EventIn): number =>
  (b.votedOn ?? "").localeCompare(a.votedOn ?? "") ||
  (b.sessionNo ?? 0) - (a.sessionNo ?? 0) ||
  (b.voteNo ?? 0) - (a.voteNo ?? 0) ||
  b.pspId - a.pspId;

/**
 * Platná (nezmatečná) hlasování v pořadí deníku — od nejnovějšího.
 *
 * Exportované SCHVÁLNĚ: první `ledgerWindow` prvků tohohle pořadí JE okno deníku,
 * a kdo potřebuje vědět, jestli hlasování do okna spadá (getKompas.ts kvůli
 * poctivým odkazům na kotvu `#h-…`), musí to číst z téhle jedné funkce. Druhá
 * kopie třídění by znamenala dvě různá okna nad jedním záznamem — a odkaz, který
 * podle jednoho z nich existuje a podle druhého ne.
 */
export function sortValidNewestFirst(events: readonly EventIn[]): EventIn[] {
  return events.filter((e) => !e.voided).sort(newestFirst);
}

export function deriveVoteRecord(
  input: {
    events: readonly EventIn[];
    ballots: readonly BallotIn[];
    clubByMandate: ReadonlyMap<number, string>;
    personByMandate: ReadonlyMap<number, number>;
    nameByPerson: ReadonlyMap<number, string>;
  },
  opts: DeriveOptions = {},
): FullVoteRecord {
  const minClubPositional = opts.minClubPositional ?? MIN_CLUB_POSITIONAL;
  const minEligible = opts.minEligible ?? MIN_ELIGIBLE_VOTES;
  const ledgerWindow = opts.ledgerWindow ?? LEDGER_WINDOW;
  const chronicleCap = opts.chronicleCap ?? CHRONICLE_CAP;
  const topRebelsCap = opts.topRebelsCap ?? TOP_REBELS_CAP;

  const { events, ballots, clubByMandate, personByMandate, nameByPerson } = input;

  const valid = sortValidNewestFirst(events);
  const eventById = new Map(valid.map((e) => [e.pspId, e]));

  /* pass 1 — per-vote per-club tallies */
  const tallies = new Map<number, Map<string, ClubTally>>();
  const unaffiliated = new Map<number, ClubTally>();
  const totals = new Map<number, ClubTally>();
  for (const b of ballots) {
    if (!eventById.has(b.votePspId)) continue; // voided or foreign-term vote
    const bucket = bucketOf(b.choice);
    let total = totals.get(b.votePspId);
    if (!total) {
      total = emptyTally();
      totals.set(b.votePspId, total);
    }
    addTally(total, bucket);
    const club = clubByMandate.get(b.mandatePspId);
    if (club === undefined) {
      let u = unaffiliated.get(b.votePspId);
      if (!u) {
        u = emptyTally();
        unaffiliated.set(b.votePspId, u);
      }
      addTally(u, bucket);
      continue;
    }
    let clubs = tallies.get(b.votePspId);
    if (!clubs) {
      clubs = new Map();
      tallies.set(b.votePspId, clubs);
    }
    let t = clubs.get(club);
    if (!t) {
      t = emptyTally();
      clubs.set(club, t);
    }
    addTally(t, bucket);
  }

  /* per-vote stats */
  const statById = new Map<number, VoteStat>();
  for (const e of valid) {
    const clubs = tallies.get(e.pspId) ?? new Map<string, ClubTally>();
    const byClub: Record<string, ClubVoteStat> = {};
    for (const [club, t] of clubs) {
      byClub[club] = { ...t, line: lineOf(t), discipline: disciplineOf(t), rice: riceOf(t) };
    }
    statById.set(e.pspId, {
      pspId: e.pspId,
      cohesion: chamberCohesion(byClub, minClubPositional),
      rebelCount: 0,
      byClub,
      unaffiliated: unaffiliated.get(e.pspId) ?? emptyTally(),
      total: totals.get(e.pspId) ?? emptyTally(),
    });
  }

  /* pass 2 — rebels (needs the lines from pass 1) */
  const rebelsByVote = new Map<number, RebelEntry[]>();
  const rebelAcc = new Map<number, { name: string; club: string; rebelVotes: number; eligibleVotes: number }>();
  for (const b of ballots) {
    const stat = statById.get(b.votePspId);
    if (!stat) continue;
    const bucket = bucketOf(b.choice);
    if (bucket !== "yes" && bucket !== "no") continue;
    const club = clubByMandate.get(b.mandatePspId);
    if (club === undefined) continue;
    const line = stat.byClub[club]?.line ?? null;
    if (line === null) continue;
    const person = personByMandate.get(b.mandatePspId);
    if (person === undefined) continue;
    let acc = rebelAcc.get(person);
    if (!acc) {
      acc = { name: nameByPerson.get(person) ?? `#${person}`, club, rebelVotes: 0, eligibleVotes: 0 };
      rebelAcc.set(person, acc);
    }
    acc.eligibleVotes++;
    if (bucket !== line) {
      acc.rebelVotes++;
      stat.rebelCount++;
      let list = rebelsByVote.get(b.votePspId);
      if (!list) {
        list = [];
        rebelsByVote.set(b.votePspId, list);
      }
      list.push({ personPspId: person, name: acc.name, club, choice: bucket, line });
    }
  }
  for (const list of rebelsByVote.values()) list.sort((a, b) => a.name.localeCompare(b.name, "cs"));

  /* ledger window */
  const ledger: LedgerVote[] = valid.slice(0, ledgerWindow).map((e) => ({
    pspId: e.pspId,
    title: titleOf(e),
    outcome: e.outcome,
    votedOn: e.votedOn,
    time: e.votedAt && e.votedAt.length >= 16 ? e.votedAt.slice(11, 16) : null,
    sessionNo: e.sessionNo,
    voteNo: e.voteNo,
    sourceUrl: e.sourceUrl,
    stat: statById.get(e.pspId)!,
    rebels: rebelsByVote.get(e.pspId) ?? [],
  }));
  const inLedger = new Set(ledger.map((l) => l.pspId));

  /* per-vote index — the compact projection /kompas selects its questions from.
   * Zero extra passes over the ballots: everything here is already in `valid`,
   * `totals` and `statById`. It exists so the compass can never compute a SECOND
   * answer about one roll call (before 2026-08-11 it re-folded all ~406 000
   * ballots for exactly these two facts — the chamber tally and the club line).
   * `total` stays `null` for a roll call we hold no ballot for: the same rule the
   * reconciliation below follows, and the reason `stat.total`'s zero-filled tally
   * (which exists for rendering) must not be used here. */
  const voteIndex: VoteIndexEntry[] = valid.map((e) => {
    const stat = statById.get(e.pspId)!;
    const clubLines: Record<string, "yes" | "no"> = {};
    for (const [club, s] of Object.entries(stat.byClub)) {
      if (s.line !== null) clubLines[club] = s.line;
    }
    return {
      pspId: e.pspId,
      title: titleOf(e),
      votedOn: e.votedOn,
      sessionNo: e.sessionNo,
      voteNo: e.voteNo,
      outcome: e.outcome,
      sourceUrl: e.sourceUrl,
      total: totals.get(e.pspId) ?? null,
      clubLines,
      inLedger: inLedger.has(e.pspId),
    };
  });

  /* seismogram — one bucket per voting day, oldest first */
  const byDay = new Map<string, { votes: number; rebels: number; cohesions: number[]; worst: { pspId: number; cohesion: number } | null }>();
  for (const e of valid) {
    if (!e.votedOn) continue;
    let day = byDay.get(e.votedOn);
    if (!day) {
      day = { votes: 0, rebels: 0, cohesions: [], worst: null };
      byDay.set(e.votedOn, day);
    }
    const stat = statById.get(e.pspId)!;
    day.votes++;
    day.rebels += stat.rebelCount;
    if (stat.cohesion !== null) {
      day.cohesions.push(stat.cohesion);
      if (day.worst === null || stat.cohesion < day.worst.cohesion) day.worst = { pspId: e.pspId, cohesion: stat.cohesion };
    }
  }
  const seismogram: SeismoDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const worstEvent = d.worst ? eventById.get(d.worst.pspId)! : null;
      return {
        date,
        votes: d.votes,
        meanCohesion: d.cohesions.length ? round3(d.cohesions.reduce((s, v) => s + v, 0) / d.cohesions.length) : null,
        rebels: d.rebels,
        worst:
          d.worst && worstEvent
            ? {
                pspId: d.worst.pspId,
                title: titleOf(worstEvent),
                cohesion: d.worst.cohesion,
                sourceUrl: worstEvent.sourceUrl,
                inLedger: inLedger.has(d.worst.pspId),
              }
            : null,
      };
    });

  /* club aggregates over ALL valid votes */
  const clubAcc = new Map<string, { discSum: number; discVotes: number; riceSum: number; riceVotes: number; lineVotes: number }>();
  for (const stat of statById.values()) {
    for (const [club, s] of Object.entries(stat.byClub)) {
      let a = clubAcc.get(club);
      if (!a) {
        a = { discSum: 0, discVotes: 0, riceSum: 0, riceVotes: 0, lineVotes: 0 };
        clubAcc.set(club, a);
      }
      if (s.line !== null && s.discipline !== null) {
        a.discSum += s.discipline;
        a.discVotes++;
        a.lineVotes++;
      }
      if (s.rice !== null && s.yes + s.no >= minClubPositional) {
        a.riceSum += s.rice;
        a.riceVotes++;
      }
    }
  }
  // Seats read off the most recent valid roll call (200 ballots per vote).
  const latestStat = valid.length ? statById.get(valid[0].pspId)! : null;
  const seatsOf = (club: string): number => {
    const t = latestStat?.byClub[club];
    return t ? t.yes + t.no + t.k + t.away : 0;
  };
  const clubs: ClubAggregate[] = [...clubAcc.entries()]
    .map(([club, a]) => ({
      club,
      seats: seatsOf(club),
      avgDiscipline: a.discVotes ? round3(a.discSum / a.discVotes) : null,
      cohesion: a.riceVotes ? round3(a.riceSum / a.riceVotes) : null,
      lineVotes: a.lineVotes,
    }))
    .sort((a, b) => b.seats - a.seats || a.club.localeCompare(b.club, "cs"));

  /* rebellion chronicle — newest first across all valid votes */
  const chronicle: ChronicleEntry[] = [];
  for (const e of valid) {
    const list = rebelsByVote.get(e.pspId);
    if (!list) continue;
    for (const r of list) {
      chronicle.push({
        ...r,
        votePspId: e.pspId,
        title: titleOf(e),
        votedOn: e.votedOn,
        sourceUrl: e.sourceUrl,
        inLedger: inLedger.has(e.pspId),
      });
      if (chronicle.length >= chronicleCap) break;
    }
    if (chronicle.length >= chronicleCap) break;
  }

  /* top rebels — rate over ≥ minEligible eligible votes */
  const topRebels: RebelRank[] = [...rebelAcc.entries()]
    .filter(([, a]) => a.eligibleVotes >= minEligible)
    .map(([personPspId, a]) => ({
      personPspId,
      name: a.name,
      club: a.club,
      rebelVotes: a.rebelVotes,
      eligibleVotes: a.eligibleVotes,
      rate: round3(a.rebelVotes / a.eligibleVotes),
    }))
    .sort((a, b) => b.rate - a.rate || b.rebelVotes - a.rebelVotes || a.name.localeCompare(b.name, "cs"))
    .slice(0, topRebelsCap);

  const validDates = valid.map((e) => e.votedOn).filter((d): d is string => d !== null);
  let ballotCount = 0;
  for (const b of ballots) if (eventById.has(b.votePspId)) ballotCount++;

  /* kontrola přepočtu proti zveřejněným součtům sněmovny — NÁLEZ, ne oprava.
   * `derived` je celosněmovní tally z uložených hlasů; hlasování, ke kterému
   * nedržíme ani jeden hlas, jde do kontroly jako `null` (vlastní kategorie
   * `withoutBallots`), nikdy jako nulový přepočet — proto se tu čte `totals`
   * a NE `stat.total`, který prázdné tally dopočítává nulami pro vykreslení. */
  const reconciliation = reconcileRecord(
    valid.map((e) => ({
      votePspId: e.pspId,
      votedOn: e.votedOn,
      derived: totals.get(e.pspId) ?? null,
      published: e.published,
    })),
  );

  return {
    ledger,
    seismogram,
    clubs,
    chronicle,
    topRebels,
    reconciliation,
    voteIndex,
    coverage: {
      events: events.length,
      valid: valid.length,
      voided: events.length - valid.length,
      ballots: ballotCount,
      from: validDates.length ? validDates.reduce((a, b) => (a < b ? a : b)) : null,
      to: validDates.length ? validDates.reduce((a, b) => (a > b ? a : b)) : null,
      ledgerWindow: Math.min(ledgerWindow, valid.length),
      unaffiliatedSeats: latestStat ? latestStat.unaffiliated.yes + latestStat.unaffiliated.no + latestStat.unaffiliated.k + latestStat.unaffiliated.away : 0,
    },
  };
}
