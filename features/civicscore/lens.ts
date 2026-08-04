// Otevřený index (moonshot 1A) — čistá odvození čtenářské „čočky" nad šesti
// zveřejněnými složkami indexu přispění. Žádný fetch, žádný stav — jen
// deterministická matematika s testy (lens.test.ts), ve stejné disciplíně
// jako duel.ts.
//
// ── Zveřejněné pravidlo čočky ────────────────────────────────────────────────
//  1. Z každé složky se vezme PUBLIKOVANÁ míra naplnění: body složky děleno
//     zveřejněnou vahou (0–1). Body jsou publikované na desetiny, takže míra
//     nese právě tuhle přesnost a nic víc — čočka se počítá z toho, co čtenář
//     na stránce skutečně vidí.
//  2. Čtenářovy váhy (0–100 na složku, posuvníky) se přepočtou na součet 100
//     a zaokrouhlí na desetiny → EFEKTIVNÍ váhy. Index tak zůstává 0–100 a
//     dvě čočky lišící se jen měřítkem (10-10-… vs 20-20-…) jsou táž čočka.
//  3. Vlastní index poslance = Σ (míra × efektivní váha), zaokrouhleno na
//     desetiny; pořadí = competition ranking (1, 2, 2, 4) — totéž pravidlo
//     jako oficiální žebříček. Řazení uvnitř shody nese jen česká abeceda
//     a nic neznamená (tabulka to říká).
//
// KRITICKÁ HRANICE: vlastní index se NIKDY nemíchá s autoritativním
// contribution_score z grafu. Při výchozích vahách se čočka vůbec nepočítá
// a stránka ukazuje skóre z grafu; jakmile se váhy liší, VŠECHNO (skóre,
// pořadí, histogram, souboj) pochází z tohoto přepočtu a nese to označení
// „váš index". Součet zaokrouhlených bodů složek se od zaokrouhleného
// kompozitu může lišit až o ~0,3 b. — stejná třída zaokrouhlovací poznámky,
// jakou přiznává oficiální rozpad (getLeaderboardData.ts).

import { CONTRIBUTION_WEIGHTS } from "@/lib/analysis/contribution";
import { COMPONENT_DEFS } from "./componentDefs";
import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "./getLeaderboardData";

/** Čtenářův vektor vah — 0–100 bodů (celé číslo) na každou ze šesti složek. */
export type WeightVector = Record<ComponentKey, number>;

/** Pořadí složek v URL kódování i v UI = pořadí zveřejněných vah. Od 2026-08-04
 *  se ODVOZUJE z COMPONENT_DEFS (features/civicscore/componentDefs.ts) — dřív tu
 *  stálo šest zopakovaných klíčů s poznámkou, že přes `server-only` je nelze
 *  importovat; definice mezitím z loaderu odešly, takže druhá kopie zanikla. */
export const LENS_COMPONENT_ORDER: readonly ComponentKey[] = COMPONENT_DEFS.map((c) => c.key);

/** Zveřejněná metodika (25-20-20-15-10-10) — jediný zdroj: lib/analysis/contribution.ts. */
export const PUBLISHED_WEIGHTS: WeightVector = { ...CONTRIBUTION_WEIGHTS };

/**
 * Zveřejněné váhy jako čitelný řetězec „25-20-20-15-10-10" — v pořadí
 * LENS_COMPONENT_ORDER, tedy přesně tak, jak je kóduje `?vahy=`.
 *
 * Existuje proto, že tenhle řetězec stál do 2026-08-04 jako LITERÁL na čtyřech
 * vykreslovaných místech (/zebricek, /referendum, panel vah, OG obraz) i v obou
 * katalozích zpráv — na stránce, která čtenáře zve index převážit. Změna váhy
 * ve vzorci by je nechala tvrdit staré číslo; teď je nechá přetéct.
 */
export const PUBLISHED_WEIGHTS_LABEL: string = LENS_COMPONENT_ORDER.map(
  (k) => PUBLISHED_WEIGHTS[k],
).join("-");

/** Query parametr nesoucí čočku. Česky, jako `?uzel=` ve Velíně. */
export const LENS_PARAM = "vahy";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export function isPublishedWeights(w: WeightVector): boolean {
  return LENS_COMPONENT_ORDER.every((k) => w[k] === PUBLISHED_WEIGHTS[k]);
}

/**
 * Vektor vah → URL hodnota `?vahy=30-10-20-15-10-15` (pořadí LENS_COMPONENT_ORDER).
 * Zveřejněná metodika → `null` (adresa bez parametru; čistá adresa = oficiální index,
 * a odkaz s vlastní čočkou nese svou metodiku přímo v sobě).
 */
export function encodeWeights(w: WeightVector): string | null {
  if (isPublishedWeights(w)) return null;
  return LENS_COMPONENT_ORDER.map((k) => String(w[k])).join("-");
}

/**
 * URL hodnota → vektor vah, nebo `null` pro cokoli neplatného (špatný počet
 * složek, ne-celé číslo, mimo 0–100). Neplatná čočka se NIKDY „opravuje" na
 * nejbližší platnou — adresa je tvrzení a tichá oprava by tvrdila cizí čočku.
 */
export function decodeWeights(raw: string | null | undefined): WeightVector | null {
  if (!raw) return null;
  const parts = raw.split("-");
  if (parts.length !== LENS_COMPONENT_ORDER.length) return null;
  const out = {} as WeightVector;
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return null;
    const v = Number(parts[i]);
    if (v > 100) return null;
    out[LENS_COMPONENT_ORDER[i]] = v;
  }
  return out;
}

/** Posuvníky → efektivní váhy: přepočteno na součet 100, zaokrouhleno na
 *  desetiny. Součet 0 (vše na nule) → všechny efektivní váhy 0 — index pak
 *  vyjde 0,0 pro všechny a UI to přizná, nic se nedopočítává. */
export function effectiveWeights(w: WeightVector): WeightVector {
  const total = LENS_COMPONENT_ORDER.reduce((s, k) => s + w[k], 0);
  const out = {} as WeightVector;
  for (const k of LENS_COMPONENT_ORDER) out[k] = total > 0 ? round1((w[k] * 100) / total) : 0;
  return out;
}

/** Výsledek přepočtu — týž tvar, jaký sekce žebříčku čtou z loaderu, takže
 *  histogram, souboj i tabulka běží nad čočkou beze změny logiky. */
export interface LensView {
  entries: LeaderboardListEntry[];
  components: LeaderboardData["components"]; // labels/sources zveřejněné, weight = efektivní
  summary: LeaderboardData["summary"];
  histogram: LeaderboardData["histogram"];
  /** Surový součet posuvníků před normalizací — pro přiznání přepočtu v UI. */
  totalRaw: number;
}

/** Průměr / medián / σ nad skóre — zrcadlí výpočet loaderu (getLeaderboardData). */
export function summarizeScores(scores: readonly number[]): LensView["summary"] {
  const n = scores.length;
  if (n === 0) return { avg: 0, median: 0, sigma: 0, count: 0 };
  const avg = scores.reduce((s, v) => s + v, 0) / n;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const sigma = Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / n);
  return { avg: round1(avg), median: round1(median), sigma: round1(sigma), count: n };
}

/** Histogram po 5bodových pásmech [od, od+5) — totéž pravidlo (včetně horní
 *  meze OSTŘE nad maximem) jako v loaderu, aby čočka a oficiální rozložení
 *  mluvily týmž jazykem pásem. */
export function histogramOf(scores: readonly number[]): LensView["histogram"] {
  if (scores.length === 0) return [];
  const lo = Math.floor(Math.min(...scores) / 5) * 5;
  const hi = Math.floor(Math.max(...scores) / 5) * 5 + 5;
  const bands: LensView["histogram"] = [];
  for (let from = lo; from < hi; from += 5) bands.push({ from, label: `${from}–${from + 5}`, count: 0 });
  for (const s of scores) {
    const b = bands.find((h) => s >= h.from && s < h.from + 5) ?? bands[bands.length - 1];
    if (b) b.count++;
  }
  return bands;
}

/**
 * Jádro čočky: přepočítá celý žebříček pod čtenářovými vahami.
 * Vrací NOVÉ položky (score, components, rank, tiedCount přepsané čočkou) —
 * vstup se nemutuje a identita/odznaky (jméno, klub, dosier…) se nesou beze změny.
 */
export function reweigh(
  entries: readonly LeaderboardListEntry[],
  components: LeaderboardData["components"],
  weights: WeightVector,
): LensView {
  const eff = effectiveWeights(weights);
  const publishedByKey = new Map(components.map((c) => [c.key, c.weight]));

  const rows = entries.map((e) => {
    let score = 0;
    const points = {} as Record<ComponentKey, number>;
    for (const k of LENS_COMPONENT_ORDER) {
      const pub = publishedByKey.get(k) ?? PUBLISHED_WEIGHTS[k];
      // clamp01 drží invariant „body ≤ váha", na němž stojí každý pruh.
      const rate = pub > 0 ? clamp01(e.components[k] / pub) : 0;
      points[k] = round1(rate * eff[k]);
      score += rate * eff[k];
    }
    return { ...e, score: round1(score), components: points };
  });

  // Řazení: skóre sestupně, uvnitř shody česká abeceda (bez významu — viz tieNote).
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "cs"));

  // Competition ranking (1, 2, 2, 4) — totéž pravidlo jako oficiální žebříček.
  const tiedCountByScore = new Map<number, number>();
  for (const r of rows) tiedCountByScore.set(r.score, (tiedCountByScore.get(r.score) ?? 0) + 1);
  let rank = 0;
  let placed = 0;
  let prevScore = Number.NaN;
  const ranked = rows.map((r) => {
    placed++;
    if (r.score !== prevScore) {
      rank = placed;
      prevScore = r.score;
    }
    return { ...r, rank, tiedCount: tiedCountByScore.get(r.score) ?? 1 };
  });

  const scores = ranked.map((r) => r.score);
  return {
    entries: ranked,
    components: components.map((c) => ({ ...c, weight: eff[c.key] })),
    summary: summarizeScores(scores),
    histogram: histogramOf(scores),
    totalRaw: LENS_COMPONENT_ORDER.reduce((s, k) => s + weights[k], 0),
  };
}

/** Pojmenovaná ukázková čočka. REDAKČNÍ příklady interakce — záměrně NEJSOU
 *  připsané žádné skutečné organizaci (to by byla fabulace autority);
 *  UI je tak i popisuje. */
export interface LensPreset {
  id: string;
  label: string;
  /** Jednou větou, co čočka zdůrazňuje. */
  note: string;
  weights: WeightVector;
}

export const LENS_PRESETS: readonly LensPreset[] = [
  {
    id: "dochazka",
    label: "Docházka především",
    note: "být tam a hlasovat — účast a docházka nesou tři čtvrtiny indexu",
    weights: { participation: 40, committee: 5, legislative: 10, speech: 5, attendance: 35, leadership: 5 },
  },
  {
    id: "zakonodarce",
    label: "Zákonodárce",
    note: "psát zákony — legislativní výstup a práce ve výborech rozhodují",
    weights: { participation: 10, committee: 25, legislative: 40, speech: 10, attendance: 10, leadership: 5 },
  },
  {
    id: "hlas-salu",
    label: "Hlas sálu",
    note: "mluvit a ptát se — vystoupení v sále váží polovinu indexu",
    weights: { participation: 10, committee: 10, legislative: 15, speech: 50, attendance: 10, leadership: 5 },
  },
];
