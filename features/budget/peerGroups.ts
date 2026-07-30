// BudgetMirror — vrstevnické skupiny (zveřejněné pravidlo, čisté odvození).
//
// Pravidlo, které plocha tiskne doslova (viz peerRuleText):
//   1. Vrstevníci obce = obce TÉHOŽ populačního pásma v TÉMŽE kraji, které mají
//      v záznamu rozpočtovou řadu (bez obce samotné).
//   2. Má-li takto vzniklá skupina méně než MIN_PEERS obcí, rozšíří se na celou
//      ČR (stejné pásmo) — malá skupina by z mediánu dělala výrok o dvou obcích.
//   3. I celostátní skupina může být malá (pásmo 100 000+ má 4 města) — počet
//      vrstevníků se proto vždy zobrazuje, nikdy nedomýšlí.
//
// Pásma sledují běžné členění MF/ČSÚ podle velikostních kategorií obcí.
// Vše čisté funkce nad Municipality/TownBudgetSeries — testy kolokované.

import type { Municipality, TownBudgetSeries } from "./mirrorData";

/** Populační pásma (dolní mez včetně, horní mez vyjma; poslední bez stropu). */
export const POPULATION_BANDS: readonly { min: number; max: number | null; label: string }[] = [
  { min: 0, max: 200, label: "do 199 obyvatel" },
  { min: 200, max: 500, label: "200–499 obyvatel" },
  { min: 500, max: 1_000, label: "500–999 obyvatel" },
  { min: 1_000, max: 2_000, label: "1 000–1 999 obyvatel" },
  { min: 2_000, max: 5_000, label: "2 000–4 999 obyvatel" },
  { min: 5_000, max: 10_000, label: "5 000–9 999 obyvatel" },
  { min: 10_000, max: 20_000, label: "10 000–19 999 obyvatel" },
  { min: 20_000, max: 50_000, label: "20 000–49 999 obyvatel" },
  { min: 50_000, max: 100_000, label: "50 000–99 999 obyvatel" },
  { min: 100_000, max: null, label: "100 000 a více obyvatel" },
];

/** Nejmenší kraj-skupina, kterou medián unese; menší se rozšiřuje celostátně. */
export const MIN_PEERS = 5;

export function bandIndexFor(population: number): number {
  for (let i = 0; i < POPULATION_BANDS.length; i++) {
    const b = POPULATION_BANDS[i];
    if (population >= b.min && (b.max === null || population < b.max)) return i;
  }
  // population < 0 nemůže z MONITORu přijít; kdyby přišla, patří do prvního pásma.
  return 0;
}

export interface PeerGroup {
  /** Vrstevníci v záznamu (bez obce samotné), seřazení podle dluhu vzestupně. */
  peers: Municipality[];
  bandIndex: number;
  bandLabel: string;
  /** "kraj" = pravidlo 1 stačilo · "celostátní" = rozšířeno pravidlem 2. */
  scope: "kraj" | "celostátní";
}

/**
 * Odvodí vrstevnickou skupinu obce podle zveřejněného pravidla. `covered` říká,
 * které obce mají rozpočtovou řadu — jen ty mohou být vrstevníky (medián z obcí
 * bez čísel neexistuje). Deterministické: vstupní pořadí rejstříku se zachovává
 * (stabilní filtr), žádné náhodné výběry.
 */
export function peerGroupFor(
  town: Municipality,
  registry: readonly Municipality[],
  covered: ReadonlySet<string>,
): PeerGroup {
  const bandIndex = bandIndexFor(town.population);
  const band = POPULATION_BANDS[bandIndex];
  const inBand = registry.filter(
    (m) => m.ic !== town.ic && covered.has(m.ic) && bandIndexFor(m.population) === bandIndex,
  );
  const inKraj = inBand.filter((m) => m.krajIndex === town.krajIndex);
  const scope: PeerGroup["scope"] = inKraj.length >= MIN_PEERS ? "kraj" : "celostátní";
  return {
    peers: scope === "kraj" ? inKraj : inBand,
    bandIndex,
    bandLabel: band.label,
    scope,
  };
}

/** Medián; prázdný vstup → null (medián z ničeho není 0). */
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface PeerMedians {
  debtPerCapita: number | null;
  capexRatio: number | null;
  saldoPerCapita: number | null;
  /** Medián dluhu na obyvatele po letech (osa = řady vrstevníků). */
  debtTrend: (number | null)[];
  /** Z kolika vrstevníků s vykázanou hodnotou se poslední medián počítá. */
  sampleSize: number;
}

/**
 * Mediány vrstevnické skupiny nad posledním rokem řad + trend dluhu po letech.
 * Vrstevník bez vykázané hodnoty do daného mediánu nevstupuje (null ≠ 0).
 */
export function peerMedians(
  peers: readonly Municipality[],
  series: ReadonlyMap<string, TownBudgetSeries>,
  yearCount: number,
): PeerMedians {
  const latestOf = (pick: (s: TownBudgetSeries) => (number | null)[]): number[] => {
    const vals: number[] = [];
    for (const p of peers) {
      const s = series.get(p.ic);
      if (!s) continue;
      const arr = pick(s);
      const v = arr[arr.length - 1];
      if (v !== null) vals.push(v);
    }
    return vals;
  };
  const debtLatest = latestOf((s) => s.debtPerCapita);
  const debtTrend: (number | null)[] = [];
  for (let i = 0; i < yearCount; i++) {
    const vals: number[] = [];
    for (const p of peers) {
      const v = series.get(p.ic)?.debtPerCapita[i];
      if (v !== null && v !== undefined) vals.push(v);
    }
    debtTrend.push(median(vals));
  }
  return {
    debtPerCapita: median(debtLatest),
    capexRatio: median(latestOf((s) => s.capexRatio)),
    saldoPerCapita: median(latestOf((s) => s.saldoPerCapita)),
    debtTrend,
    sampleSize: debtLatest.length,
  };
}
