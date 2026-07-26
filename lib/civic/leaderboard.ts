// Plný žebříček 200 poslanců — deterministicky generovaný mock kolem pěti
// detailních poslanců vzorku (MPS). Invarianty (hlídané testy):
//   – přesně 200 řádků, skóre ostře klesá s pořadím,
//   – vzorek sedí na svých kotevních pořadích (1, 2, 3, 74, 193) se svým skóre,
//   – mandáty po stranách odpovídají PARTIES (72+34+33+23+20+14+4 = 200),
//   – composite(pillars) == score i u generovaných řádků.
// Žádné Math.random/Date — generace je čistá funkce (SSR == CSR).
// Jména dogenerovaných poslanců jsou ilustrativní (fiktivní).

import { MPS, PARTIES, PILLARS, type Pillar } from "./data";

export interface LeaderboardRow {
  id: string;
  rank: number;
  name: string;
  partyCode: string;
  party: string;
  partyColor: string;
  region: string;
  score: number;
  pillars: Record<Pillar["key"], number>;
  /** true = detailní poslanec vzorku — má spis na /poslanec/[id]. */
  sample: boolean;
}

// ── deterministické pomůcky ─────────────────────────────────────────────

/** LCG s pevným seedem — stabilní „náhoda" pro míchání stran a jmen. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FIRST_F = ["Jana", "Marie", "Hana", "Lenka", "Alena", "Kateřina", "Lucie", "Veronika", "Martina", "Zuzana", "Tereza", "Markéta"];
const FIRST_M = ["Jan", "Petr", "Pavel", "Jiří", "Josef", "Tomáš", "Jaroslav", "Milan", "David", "Michal", "Ondřej", "Radek"];
const SURNAMES = ["Novák", "Svoboda", "Novotný", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Pospíšil", "Marek", "Hájek", "Kolář", "Urban", "Sedláček", "Doležal", "Krejčí", "Šimek", "Vaněk", "Polák"];

const REGIONS = [
  "Praha",
  "Středočeský kraj",
  "Jihočeský kraj",
  "Plzeňský kraj",
  "Karlovarský kraj",
  "Ústecký kraj",
  "Liberecký kraj",
  "Královéhradecký kraj",
  "Pardubický kraj",
  "Vysočina",
  "Jihomoravský kraj",
  "Olomoucký kraj",
  "Zlínský kraj",
  "Moravskoslezský kraj",
];

function feminine(surname: string): string {
  if (surname.endsWith("ý")) return surname.slice(0, -1) + "á";
  if (surname.endsWith("í")) return surname;
  return surname + "ová";
}

// ── generace ────────────────────────────────────────────────────────────

// Kotvy vzorku: rank → MP. Pásma mezi kotvami se interpolují s okraji
// ±0,6 b., aby zaokrouhlení pilířů nemohlo přehodit pořadí přes kotvu.
const ANCHOR_BY_RANK = new Map(MPS.map((m) => [m.rank, m]));

/** Cílové skóre výplňového řádku podle pořadí (před derivací pilířů). */
function targetScore(rank: number): number {
  const bands: Array<[number, number, number, number]> = [
    // [odRanku, doRanku, skóreOd, skóreDo] — hranice s odstupem od kotev
    [4, 73, 77.6, 60.8],
    [75, 192, 59.4, 40.8],
    [194, 200, 39.4, 31.0],
  ];
  for (const [r0, r1, s0, s1] of bands) {
    if (rank >= r0 && rank <= r1) {
      if (r0 === r1) return s0;
      return s0 + ((rank - r0) / (r1 - r0)) * (s1 - s0);
    }
  }
  // Rank falls outside every band — the boundaries are a hand-maintained
  // second encoding of the anchor positions in MPS, so an anchor edited
  // without updating them in lockstep would otherwise throw here at MODULE
  // IMPORT TIME, crashing every page that uses this "never break the page"
  // fallback exactly when the real data path is already unavailable. Degrade
  // to the nearest band's edge value instead.
  let nearest = bands[0];
  let nearestDist = Infinity;
  for (const band of bands) {
    const [r0, r1] = band;
    const dist = rank < r0 ? r0 - rank : rank > r1 ? rank - r1 : 0;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = band;
    }
  }
  const [nr0, , ns0, ns1] = nearest;
  return rank <= nr0 ? ns0 : ns1;
}

// Vzory odchylek pilířů [dAktivita, dDocházka, dNezávislost]; čtvrtá se
// dopočítá tak, aby vážený součet odchylek byl 0 → composite zůstane.
const DELTA_PATTERNS: Array<[number, number, number]> = [
  [10, -8, -6],
  [-7, 9, 5],
  [4, -12, 8],
  [-9, 6, -3],
  [12, 4, -10],
  [-5, -9, 11],
  [7, 2, -14],
  [-11, 13, 2],
];

/**
 * Pilíře s PŘESNÝM váženým součtem == score (žádné zaokrouhlení hodnot —
 * celočíselné pilíře by posunuly kompozit a vyráběly remízy v pořadí;
 * UI je na celá čísla zaokrouhluje až při zobrazení).
 */
function pillarsFor(score: number, idx: number): Record<Pillar["key"], number> {
  const [d1, d2, d3] = DELTA_PATTERNS[idx % DELTA_PATTERNS.length];
  const d4 = -(0.25 * d1 + 0.2 * d2 + 0.25 * d3) / 0.3;
  return {
    activity: score + d1,
    attendance: score + d2,
    independence: score + d3,
    integrity: score + d4,
  };
}

/** Zamíchaný kartézský součin jmen × příjmení — unikátní jména bez kolizí. */
function namePool(firsts: string[], female: boolean, rand: () => number): string[] {
  const pool: string[] = [];
  for (const f of firsts) {
    for (const s of SURNAMES) {
      pool.push(`${f} ${female ? feminine(s) : s}`);
    }
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function buildLeaderboard(): LeaderboardRow[] {
  const rand = lcg(42);

  // Mandáty stran pro výplň: celkové mandáty minus poslanci vzorku.
  const partyByName = new Map(PARTIES.map((p) => [p.name, p] as const));
  const sampleParty = (name: string) =>
    PARTIES.find((p) => p.name === name || p.name.startsWith(name) || name.startsWith(p.name.split(" ")[0]))!;
  const fillerSeats = new Map(PARTIES.map((p) => [p.code, p.seats] as const));
  for (const mp of MPS) {
    const p = partyByName.get(mp.party) ?? sampleParty(mp.party);
    fillerSeats.set(p.code, (fillerSeats.get(p.code) ?? 0) - 1);
  }
  const codes: string[] = [];
  for (const [code, seats] of fillerSeats) codes.push(...Array<string>(seats).fill(code));
  // Fisher–Yates se seedem — strany rozprostřené přes celé pořadí.
  for (let i = codes.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [codes[i], codes[j]] = [codes[j], codes[i]];
  }

  const usedNames = new Set(MPS.map((m) => m.name));
  const femaleNames = namePool(FIRST_F, true, rand);
  const maleNames = namePool(FIRST_M, false, rand);
  let femaleIdx = 0;
  let maleIdx = 0;
  const rows: LeaderboardRow[] = [];
  let filler = 0;

  for (let rank = 1; rank <= 200; rank++) {
    const anchor = ANCHOR_BY_RANK.get(rank);
    if (anchor) {
      const p = partyByName.get(anchor.party) ?? sampleParty(anchor.party);
      rows.push({
        id: anchor.id,
        rank,
        name: anchor.name,
        partyCode: p.code,
        party: p.name,
        partyColor: p.color,
        region: anchor.region,
        score: anchor.score,
        pillars: anchor.pillars,
        sample: true,
      });
      continue;
    }

    const code = codes[filler];
    const party = PARTIES.find((p) => p.code === code)!;
    // Kvantizace na 0,1 — kroky pásem (≥0,16) po kvantizaci nikdy nesplynou,
    // takže pořadí je ostře klesající bez remíz.
    const score = Math.round(targetScore(rank) * 10) / 10;
    const pillars = pillarsFor(score, filler);

    // Deterministické fiktivní jméno z předmíchaného poolu (bez kolizí).
    const female = filler % 2 === 0;
    let name = "";
    do {
      name = female ? femaleNames[femaleIdx++] : maleNames[maleIdx++];
    } while (usedNames.has(name));
    usedNames.add(name);

    rows.push({
      id: `gen-${String(filler + 1).padStart(3, "0")}`,
      rank,
      name,
      partyCode: code,
      party: party.name,
      partyColor: party.color,
      region: REGIONS[(filler * 5) % REGIONS.length],
      score,
      pillars,
      sample: false,
    });
    filler++;
  }

  return rows;
}

export const LEADERBOARD: LeaderboardRow[] = buildLeaderboard();

/** Souhrn sněmovny počítaný z žebříčku — jediný zdroj pravdy pro agregáty. */
export const CHAMBER_SUMMARY = (() => {
  const scores = LEADERBOARD.map((r) => r.score);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  // Generic midpoint, not a hardcoded 200-row assumption — matches the same
  // formula already used correctly for the real-data path in
  // getLeaderboardData.ts, so a future change to LEADERBOARD's length can't
  // silently compute the wrong median via two magic array indices.
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sigma = Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length);
  return {
    avg: Math.round(avg * 10) / 10,
    median: Math.round(median * 10) / 10,
    sigma: Math.round(sigma * 10) / 10,
  };
})();

/** Histogram kompozitů po 5 bodech — pro rozložení sněmovny. */
export const SCORE_HISTOGRAM = (() => {
  const buckets: { from: number; label: string; count: number }[] = [];
  for (let from = 30; from < 90; from += 5) {
    buckets.push({ from, label: `${from}–${from + 4}`, count: 0 });
  }
  for (const r of LEADERBOARD) {
    const b = buckets.find((b) => r.score >= b.from && r.score < b.from + 5);
    if (b) b.count++;
  }
  return buckets;
})();

export { PILLARS };
