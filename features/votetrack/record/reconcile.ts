// Sněmovna kontroluje sama sebe — přepočet proti zveřejněným součtům.
//
// ── Proč tenhle modul vznikl (2026-08-10) ───────────────────────────────────────
// U KAŽDÉHO jmenovitého hlasování zveřejňuje sněmovna vlastní součty (`vote_event`
// nese sloupce `yes` / `no` / `abstain` / `notVoting`, viz lib/db/types.ts). Do dneška
// je votetrack nečetl: disciplína, linie i rebelie stály na NAŠEM přepočtu ze 406 000
// jmenovitých hlasů a nikdo ho nikdy neporovnal s tím, co o týchž hlasováních tvrdí
// zdroj. Na ploše, jejíž značkou je „každé číslo se dá zkontrolovat“, to byla jediná
// vrstva, kterou zkontrolovat nešlo.
//
// ── Co se porovnává a co ne ────────────────────────────────────────────────────
// Porovnává se JEDNA KU JEDNÉ, nikdy „přibližně“:
//   pro   ↔ yes
//   proti ↔ no
//   „zdržel se / nehlasoval“ ↔ abstain + notVoting
// Slot „nepřihlášen / omluven“ (`away`) se NEPOROVNÁVÁ: zdroj pro něj žádný sloupec
// nezveřejňuje, takže by porovnání muselo dopočítat, kolik poslanců „mělo být“ v sále —
// a to je odhad, ne údaj. Sloučený slot K existuje proto, že sněmovna sama od novely
// 90/1995 Sb. „zdržel se“ a „nehlasoval“ nerozlišuje (viz record/types.ts); zveřejněné
// sloupce ho drží rozpadlý, proto se sčítají.
//
// ── Co se dělá s rozdílem ──────────────────────────────────────────────────────
// NIC se neopravuje. Rozdíl je NÁLEZ — buď se rozchází naše ingesce, nebo zveřejněná
// data zdroje — a zveřejní se i s počtem a nejhorším příkladem. Týž precedens jako
// u nemožných dat smluv (lib/analysis/plausible-date.ts): řádek si údaj nechá, rozdíl
// se konstatuje, nikdy nepřepisuje.
//
// Čistý modul (žádný store, žádné `server-only`), fixture-testovaný v reconcile.test.ts.

import type { ClubTally } from "./types";

/** Sloupce, které sněmovna sama zveřejnila u jednoho hlasování. Každý smí být
 *  `null` — ingesce nese to, co nesl dump, nic se nedoplňuje. */
export interface PublishedTally {
  yes: number | null;
  no: number | null;
  abstain: number | null;
  notVoting: number | null;
}

/** Sloty, které jdou porovnat jedna ku jedné. `away` tu ZÁMĚRNĚ není — viz hlavička. */
export type ReconcileBucket = "yes" | "no" | "k";

/** Pořadí, ve kterém se sloty procházejí — deterministické, nikdy podle pořadí klíčů. */
export const RECONCILE_BUCKETS: readonly ReconcileBucket[] = ["yes", "no", "k"];

/** Jedno hlasování na vstupu kontroly. `derived === null` znamená, že k němu
 *  nedržíme ani jeden jmenovitý hlas — přepočet pro něj neexistuje. */
export interface ReconcileInput {
  votePspId: number;
  votedOn: string | null;
  derived: ClubTally | null;
  published: PublishedTally | null | undefined;
}

export interface VoteReconciliation {
  votePspId: number;
  votedOn: string | null;
  /** Sloty porovnané u tohohle hlasování, v pořadí RECONCILE_BUCKETS. */
  compared: ReconcileBucket[];
  /** přepočet − zveřejněno, pro každý porovnaný slot. */
  deltas: Partial<Record<ReconcileBucket, number>>;
  /** Σ |odchylka| přes porovnané sloty. 0 ⇒ přepočet souhlasí. */
  distance: number;
}

export interface ReconciliationSummary {
  /** Platná hlasování, na která se kontrola dívala. */
  votes: number;
  /** Z nich ta, ke kterým držíme aspoň jeden jmenovitý hlas (tedy je co přepočítat). */
  recounted: number;
  /** Z přepočtených ta, kde šel porovnat aspoň jeden slot. */
  compared: number;
  /** Porovnaná hlasování, kde se každý porovnaný slot shoduje. */
  agreed: number;
  /** Porovnaná hlasování, kde se aspoň jeden slot liší. */
  discrepancies: number;
  /** Součet porovnaných slotů přes všechna porovnaná hlasování. */
  comparedBuckets: number;
  /** Přepočtená hlasování, u kterých zdroj nezveřejnil ani jeden porovnatelný sloupec. */
  uncompared: number;
  /** Platná hlasování bez jediného jmenovitého hlasu v našem záznamu. */
  withoutBallots: number;
  /** Největší rozdíl; při shodné vzdálenosti nižší id hlasování. `null`, když se nic neliší. */
  worst: VoteReconciliation | null;
}

const sumOrNull = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : a + b;

/**
 * Porovná NÁŠ přepočet jednoho hlasování se zveřejněnými součty. Slot, pro který
 * zdroj nemá údaj, se prostě neporovnává — nikdy se nedohaduje nulou.
 */
export function reconcileVote(row: ReconcileInput): VoteReconciliation {
  const compared: ReconcileBucket[] = [];
  const deltas: Partial<Record<ReconcileBucket, number>> = {};
  let distance = 0;

  if (row.derived !== null && row.published) {
    const official: Record<ReconcileBucket, number | null> = {
      yes: row.published.yes,
      no: row.published.no,
      k: sumOrNull(row.published.abstain, row.published.notVoting),
    };
    for (const bucket of RECONCILE_BUCKETS) {
      const value = official[bucket];
      if (value === null || !Number.isFinite(value)) continue;
      const delta = row.derived[bucket] - value;
      compared.push(bucket);
      deltas[bucket] = delta;
      distance += Math.abs(delta);
    }
  }

  return { votePspId: row.votePspId, votedOn: row.votedOn, compared, deltas, distance };
}

/** Přísnější než „největší“: při stejné vzdálenosti vyhrává nižší id, ať je nejhorší
 *  příklad nad týmž záznamem vždy tentýž — stránka ho jmenuje. */
const worseThan = (candidate: VoteReconciliation, current: VoteReconciliation | null): boolean =>
  current === null ||
  candidate.distance > current.distance ||
  (candidate.distance === current.distance && candidate.votePspId < current.votePspId);

/** Kontrola celého záznamu. Na vstupu jsou PLATNÁ (nezmatečná) hlasování — zmatečná
 *  jsou vyřazená z každé metriky, takže je nemá smysl porovnávat ani tady. */
export function reconcileRecord(rows: readonly ReconcileInput[]): ReconciliationSummary {
  let recounted = 0;
  let compared = 0;
  let agreed = 0;
  let discrepancies = 0;
  let comparedBuckets = 0;
  let uncompared = 0;
  let withoutBallots = 0;
  let worst: VoteReconciliation | null = null;

  for (const row of rows) {
    if (row.derived === null) {
      withoutBallots++;
      continue;
    }
    recounted++;
    const result = reconcileVote(row);
    if (result.compared.length === 0) {
      uncompared++;
      continue;
    }
    compared++;
    comparedBuckets += result.compared.length;
    if (result.distance === 0) {
      agreed++;
      continue;
    }
    discrepancies++;
    if (worseThan(result, worst)) worst = result;
  }

  return {
    votes: rows.length,
    recounted,
    compared,
    agreed,
    discrepancies,
    comparedBuckets,
    uncompared,
    withoutBallots,
    worst,
  };
}
