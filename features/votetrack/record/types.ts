// Serializable shapes of the REAL vote record — what getVoteRecord() hands the
// /hlasovani client tree. Derived deterministically in record/derive.ts from the
// ingested PSP10 ledger (vote_event + vote_ballot + clubByMandate); every rule is
// disclosed in the UI copy (record/../copy.ts) per the brand rule.

import type { ReconciliationSummary } from "./reconcile";

/** Per-club ballot buckets for one roll call. The K bucket exists because the
 * Chamber itself stopped distinguishing "zdržel se" from "nehlasoval" in 1995
 * (90/1995 Sb.) — see lib/ingest/normalize.ts; we never split it. */
export interface ClubTally {
  /** ano (A) */
  yes: number;
  /** ne (B/N) */
  no: number;
  /** zdržel se / nehlasoval — merged K bucket (+ historic C/F) */
  k: number;
  /** nepřihlášen / omluven / před slibem — no presence at the desk */
  away: number;
}

export interface ClubVoteStat extends ClubTally {
  /** Strict majority of the club's positional (yes/no) votes; tie or none → null. */
  line: "yes" | "no" | null;
  /** max(yes,no)/(yes+no), 3dp — share of positional voters on the line. Null when no positional votes. */
  discipline: number | null;
  /** Rice index |yes−no|/(yes+no), 3dp. Null when no positional votes. */
  rice: number | null;
}

export interface VoteStat {
  pspId: number;
  /** Chamber cohesion: positional-weighted mean Rice over clubs with ≥ minClubPositional positional votes; null when no club qualifies. 3dp. */
  cohesion: number | null;
  rebelCount: number;
  byClub: Record<string, ClubVoteStat>;
  /** Ballots of MPs without a resolved club (nezařazení) — shown, never scored. */
  unaffiliated: ClubTally;
  total: ClubTally;
}

export interface RebelEntry {
  personPspId: number;
  name: string;
  club: string;
  choice: "yes" | "no";
  line: "yes" | "no";
}

export interface LedgerVote {
  pspId: number;
  title: string;
  outcome: string;
  votedOn: string | null;
  /** "HH:MM" from voted_at, when present. */
  time: string | null;
  sessionNo: number | null;
  voteNo: number | null;
  sourceUrl: string;
  stat: VoteStat;
  rebels: RebelEntry[];
}

export interface SeismoDay {
  /** ISO voting day. */
  date: string;
  votes: number;
  /** Mean vote cohesion across the day's votes with a cohesion value; null if none. 3dp. */
  meanCohesion: number | null;
  rebels: number;
  /** The day's lowest-cohesion roll call — the crack the needle points at. */
  worst: { pspId: number; title: string; cohesion: number; sourceUrl: string; inLedger: boolean } | null;
}

export interface ClubAggregate {
  club: string;
  /** Seats read off the most recent valid roll call's ballot count for the club. */
  seats: number;
  /** Mean per-vote discipline over votes where the club had a line, 3dp. */
  avgDiscipline: number | null;
  /** Mean Rice cohesion over qualifying votes (≥ minClubPositional positional), 3dp. */
  cohesion: number | null;
  /** Votes where the club had a (non-tied) line. */
  lineVotes: number;
}

export interface ChronicleEntry extends RebelEntry {
  votePspId: number;
  title: string;
  votedOn: string | null;
  sourceUrl: string;
  inLedger: boolean;
}

export interface RebelRank {
  personPspId: number;
  name: string;
  club: string;
  rebelVotes: number;
  eligibleVotes: number;
  /** rebelVotes / eligibleVotes, 3dp. */
  rate: number;
}

/**
 * Jedno PLATNÉ hlasování v kompaktním rejstříku — to, co si o hlasování
 * odvodila derivace a co z toho čte volební kompas.
 *
 * ── Proč to tu je (2026-08-11) ─────────────────────────────────────────────
 * `getKompas.ts` si nad týmiž 406 000 hlasy počítal DVĚ věci, které tahle
 * derivace už spočítala a zahodila: celosněmovní tally každého otagovaného
 * hlasování (průchod A) a linii klubu podle přísné většiny (půlka průchodu B).
 * Dvě kopie jednoho pravidla nad jedním záznamem znamenají dvě čísla o jednom
 * hlasování — a v tomhle případě i druhý šestnáctisekundový průchod na okno
 * mema. Rejstřík je to jediné, co kompas z hlasů potřebuje pro VÝBĚR otázek;
 * jmenovité hlasy vybraných ~20 hlasování si dočítá zvlášť a indexovaně.
 *
 * Rejstřík je jen z PLATNÝCH hlasování (zmatečná sem nepatří stejně jako do
 * žádné jiné metriky) a v pořadí deníku — od nejnovějšího.
 */
export interface VoteIndexEntry {
  pspId: number;
  /** titleLong ?? titleShort ?? titleNorm, jinak `#pspId` — táž funkce jako deník. */
  title: string;
  votedOn: string | null;
  sessionNo: number | null;
  voteNo: number | null;
  outcome: string;
  sourceUrl: string;
  /**
   * Celosněmovní tally hlasování (všechny uložené hlasy, bucketované), nebo
   * `null`, pokud k hlasování NEDRŽÍME ani jeden hlas — přesně jako v kontrole
   * proti zveřejněným součtům. Nulový přepočet se nedopočítává: „nemáme hlasy"
   * a „nikdo nehlasoval" jsou dvě různá tvrzení.
   */
  total: ClubTally | null;
  /** Linie klubu (přísná většina pozičních hlasů); klub bez linie tu není. */
  clubLines: Record<string, "yes" | "no">;
  /** Leží hlasování v okně deníku (`coverage.ledgerWindow` nejnovějších platných)? */
  inLedger: boolean;
}

export interface VoteRecordData {
  /** The `ledgerWindow` most recent valid roll calls, newest first. */
  ledger: LedgerVote[];
  /** One entry per voting day, oldest first — the seismogram's spine. */
  seismogram: SeismoDay[];
  /** Sorted by seats desc, then abbrev (cs) — stable render order. */
  clubs: ClubAggregate[];
  /** Rebellion instances, newest first, capped. */
  chronicle: ChronicleEntry[];
  /** Highest rebellion rates over ≥ minEligible eligible votes, capped. */
  topRebels: RebelRank[];
  /**
   * Kontrola NAŠEHO přepočtu proti součtům, které sněmovna sama zveřejnila
   * (record/reconcile.ts). Je to NÁLEZ, ne oprava: rozdíl se vypíše i s počtem
   * a nejhorším příkladem, žádná ze dvou stran se nepřepisuje. Hlasování bez
   * zveřejněných sloupců je NEPOROVNANÉ, nikdy dohadované.
   */
  reconciliation: ReconciliationSummary;
  /**
   * Rejstřík VŠECH platných hlasování (viz `VoteIndexEntry`) — vstup, ze kterého
   * volební kompas vybírá otázky.
   *
   * VOLITELNÝ SCHVÁLNĚ, a je to jediné pole záznamu, které je: `getVoteRecord()`
   * ho před předáním klientovi /hlasovani ZAHAZUJE (`toWireRecord`), protože ta
   * stránka z něj nevykresluje nic a jsou to stovky kB navíc přes síť. Derivace
   * ho plní vždy — proto `FullVoteRecord` níž, který ho má povinný a který
   * memoizuje `getFullVoteRecord()`.
   */
  voteIndex?: VoteIndexEntry[];
  coverage: {
    events: number;
    valid: number;
    voided: number;
    ballots: number;
    from: string | null;
    to: string | null;
    ledgerWindow: number;
    unaffiliatedSeats: number;
  };
}

/** Záznam tak, jak ho derivace VRACÍ a jak ho drží memo: s rejstříkem. */
export type FullVoteRecord = VoteRecordData & { voteIndex: VoteIndexEntry[] };
