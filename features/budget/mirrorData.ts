// BudgetMirror — datová vrstva plochy /rozpocty.
//
// Rozbaluje dva generované moduly (features/budget/data/*.generated.ts — plný
// rejstřík 6 254 obcí + rozpočtové ukazatele stažené dávky) do typovaných
// struktur a nese vyhledávání nad rejstříkem. Vše čisté funkce — kolokované
// testy v mirrorData.test.ts.
//
// Kompaktní řádkový formát (místo JSON pole objektů) drží rejstřík ~220 kB
// místo ~700 kB — při 6 254 řádcích je to rozdíl, který uživatel na mobilu
// pozná. Parser je přísný: vadný řádek shodí modul při načtení (fail-loud),
// protože generátor je deterministický a vadný řádek znamená poškozený soubor,
// ne "trochu jiná data".

import { perCapita, capexRatioPct } from "@/lib/ingest/sources/monitor";
import { KRAJE, REGISTRY_PACKED } from "./data/registryData.generated";
import { SNAPSHOT_YEARS, SNAPSHOTS_PACKED } from "./data/budgetSnapshots.generated";

/** Obec v rejstříku — každá z 6 254, ať už má napojená čísla, nebo ne. */
export interface Municipality {
  /** 8místné IČO — klíč MONITORu i URL /rozpocty/[ico]. */
  ic: string;
  name: string;
  county: string;
  krajIndex: number;
  krajName: string;
  population: number;
}

/** Rozpočtová řada jedné obce (roky = SNAPSHOT_YEARS, hodnoty po letech).
 *  null = MONITOR hodnotu pro daný rok nevykázal — nikdy se nedopočítává. */
export interface TownBudgetSeries {
  ic: string;
  years: readonly number[];
  debtPerCapita: (number | null)[];
  capexRatio: (number | null)[];
  saldoPerCapita: (number | null)[];
}

/** Poslední vykázaný rok jedné obce — trojice metrik pro řádky a dvojpruhy. */
export interface TownLatestMetrics {
  year: number;
  debtPerCapita: number | null;
  capexRatio: number | null;
  saldoPerCapita: number | null;
}

/* ── Rejstřík ─────────────────────────────────────────────────────────────── */

/** Zabalí řádky rejstříku do formátu REGISTRY_PACKED (inverze parseRegistry —
 *  používá ji regenerační běh monitor.ts → generátor, testy drží round-trip). */
export function packRegistry(rows: readonly Municipality[]): string {
  return rows
    .map((r) => {
      if (!/^\d{8}$/.test(r.ic)) throw new Error(`packRegistry: vadné IČO ${r.ic}`);
      if (/[|\n]/.test(r.name + r.county)) throw new Error(`packRegistry: nepovolený znak v ${r.name}`);
      return [r.ic, r.name, r.county, r.krajIndex, r.population].join("|");
    })
    .join("\n");
}

export function parseRegistry(packed: string): Municipality[] {
  const out: Municipality[] = [];
  for (const line of packed.split("\n")) {
    if (line === "") continue;
    const parts = line.split("|");
    if (parts.length !== 5) throw new Error(`parseRegistry: vadný řádek "${line.slice(0, 40)}"`);
    const [ic, name, county, krajIdxRaw, popRaw] = parts;
    const krajIndex = Number(krajIdxRaw);
    const population = Number(popRaw);
    if (!/^\d{8}$/.test(ic) || !Number.isInteger(krajIndex) || !KRAJE[krajIndex] || !Number.isFinite(population)) {
      throw new Error(`parseRegistry: vadný řádek "${line.slice(0, 40)}"`);
    }
    out.push({ ic, name, county, krajIndex, krajName: KRAJE[krajIndex].name, population });
  }
  return out;
}

let registryCache: Municipality[] | null = null;
let registryByIcCache: Map<string, Municipality> | null = null;

/** Plný rejstřík (seřazený generátorem: podle počtu obyvatel sestupně). */
export function getRegistry(): Municipality[] {
  registryCache ??= parseRegistry(REGISTRY_PACKED);
  return registryCache;
}

export function getMunicipality(ic: string): Municipality | null {
  if (registryByIcCache === null) {
    registryByIcCache = new Map(getRegistry().map((m) => [m.ic, m]));
  }
  return registryByIcCache.get(ic) ?? null;
}

/* ── Rozpočtové řady ──────────────────────────────────────────────────────── */

function cellToNumber(cell: string): number | null {
  if (cell === "") return null;
  const n = Number(cell);
  if (!Number.isFinite(n)) throw new Error(`budget snapshot: vadná buňka "${cell}"`);
  return n;
}

/** Rozbalí SNAPSHOTS_PACKED na mapu IČO → surové roční hodnoty (celé Kč). */
export function parseSnapshots(packed: string): Map<
  string,
  { debtCzk: number | null; expenditureCzk: number | null; capexCzk: number | null; saldoCzk: number | null; population: number | null }[]
> {
  const out = new Map<
    string,
    { debtCzk: number | null; expenditureCzk: number | null; capexCzk: number | null; saldoCzk: number | null; population: number | null }[]
  >();
  for (const line of packed.split("\n")) {
    if (line === "") continue;
    const parts = line.split("|");
    if (parts.length !== SNAPSHOT_YEARS.length + 1) throw new Error(`budget snapshot: vadný řádek "${line.slice(0, 30)}"`);
    const [ic, ...yearCells] = parts;
    out.set(
      ic,
      yearCells.map((cell) => {
        const cells = cell === "" ? ["", "", "", "", ""] : cell.split(";");
        if (cells.length !== 5) throw new Error(`budget snapshot: vadný rok v "${ic}"`);
        const [dluh, vydaje, kapex, saldo, obyv] = cells.map(cellToNumber);
        return { debtCzk: dluh, expenditureCzk: vydaje, capexCzk: kapex, saldoCzk: saldo, population: obyv };
      }),
    );
  }
  return out;
}

let seriesCache: Map<string, TownBudgetSeries> | null = null;

/** Odvozené řady všech obcí v záznamu: Kč/obyvatele a podíl investic po letech.
 *  Per-capita čísla dělí populací DANÉHO roku (MONITOR ji vykazuje s obdobím),
 *  ne dnešní — dluh na obyvatele 2021 je výrok o roce 2021. */
export function getBudgetSeries(): Map<string, TownBudgetSeries> {
  if (seriesCache === null) {
    seriesCache = new Map();
    for (const [ic, years] of parseSnapshots(SNAPSHOTS_PACKED)) {
      seriesCache.set(ic, {
        ic,
        years: SNAPSHOT_YEARS,
        debtPerCapita: years.map((y) => perCapita(y.debtCzk, y.population)),
        capexRatio: years.map((y) => capexRatioPct(y.capexCzk, y.expenditureCzk)),
        saldoPerCapita: years.map((y) => perCapita(y.saldoCzk, y.population)),
      });
    }
  }
  return seriesCache;
}

/** Poslední rok s alespoň jednou vykázanou metrikou; null = obec bez záznamu. */
export function latestMetrics(series: TownBudgetSeries | undefined): TownLatestMetrics | null {
  if (!series) return null;
  for (let i = series.years.length - 1; i >= 0; i--) {
    if (series.debtPerCapita[i] !== null || series.capexRatio[i] !== null || series.saldoPerCapita[i] !== null) {
      return {
        year: series.years[i],
        debtPerCapita: series.debtPerCapita[i],
        capexRatio: series.capexRatio[i],
        saldoPerCapita: series.saldoPerCapita[i],
      };
    }
  }
  return null;
}

/* ── Pokrytí (přiznává se na ploše, nikdy se nemaskuje) ───────────────────── */

export interface CoverageStats {
  /** Kolik obcí rejstřík zná (celá ČR). */
  registryTotal: number;
  /** Kolik z nich má napojenou rozpočtovou řadu. */
  covered: number;
}

export function coverageStats(): CoverageStats {
  const registry = getRegistry();
  const series = getBudgetSeries();
  let covered = 0;
  for (const m of registry) if (series.has(m.ic)) covered++;
  return { registryTotal: registry.length, covered };
}

/* ── Vyhledávání (search-first picker nad 6 254 obcemi) ───────────────────── */

/** Složí český text na malá písmena bez diakritiky — "Řevničov" → "revnicov". */
export function foldCzech(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Vyhledá obce podle názvu (bez diakritiky, bez ohledu na velikost písmen).
 * Pořadí: přesná shoda → prefix → podřetězec; uvnitř stupně podle počtu
 * obyvatel sestupně (vstup je tak už seřazen generátorem, sort je stabilní).
 * Prázdný dotaz vrací největší obce — výchozí stav pickeru.
 */
export function searchMunicipalities(all: readonly Municipality[], query: string, limit: number): Municipality[] {
  const q = foldCzech(query.trim());
  if (q === "") return all.slice(0, limit);
  const scored: { m: Municipality; score: number }[] = [];
  for (const m of all) {
    const name = foldCzech(m.name);
    let score: number;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else continue;
    scored.push({ m, score });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.m);
}
