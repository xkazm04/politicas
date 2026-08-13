// Můj kraj (moonshot 5E) — čistá odvození volební karty kraje nad žebříčkem
// Otevřeného indexu. Žádný fetch, žádný stav — deterministická matematika
// s testy (kraj.test.ts), ve stejné disciplíně jako lens.ts a duel.ts.
//
// ── Zveřejněné pravidlo karty ───────────────────────────────────────────────
//  1. Kraj poslance nese mandát PSP10 (registr psp.cz, volební-kraj organ) —
//     tentýž údaj, který žebříček už zobrazuje ve sloupci „kraj".
//  2. Karta je VÝŘEZ žebříčku: řadí se týmž pravidlem (skóre sestupně, uvnitř
//     shody česká abeceda bez významu) a krajské pořadí je competition ranking
//     (1, 2, 2, 4) počítaný jen nad poslanci kraje. Celostátní příčka se nese
//     beze změny — karta obě pořadí přiznává vedle sebe.
//  3. Mandát bez kraje v registru jde do poctivého koše „kraj neuveden" —
//     nikdy se nedopočítává ani tiše nevynechává.
//  4. Čtenářova čočka (?vahy=…) prochází kartou STEJNĚ jako žebříčkem: krajský
//     výřez se počítá nad výstupem reweigh(), nikdy se nemíchá s oficiálním
//     indexem, a vytištěná karta nese vektor vah přímo v citaci i v hlavičce.

import type { PosterCitationInput } from "@/features/shared/poster/citation";
import type { LeaderboardListEntry } from "./getLeaderboardData";
import { encodeWeights, isPublishedWeights, PUBLISHED_WEIGHTS_LABEL, type WeightVector } from "./lens";

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Poctivý koš pro mandáty bez kraje v registru. */
export const KRAJ_NEUVEDEN_SLUG = "neuveden";
export const KRAJ_NEUVEDEN_LABEL = "Kraj neuveden";

/**
 * Popisek kraje → URL slug: bez diakritiky, malými písmeny, mezery pomlčkou,
 * generická přípona „ kraj" se vypouští („Jihomoravský kraj" → `jihomoravsky`,
 * „Praha" → `praha`, „Vysočina" → `vysocina`). Deterministické a prosté —
 * adresa /kraj/[kraj] je trvalý odkaz, který jde napsat z hlavy.
 */
export function krajSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+kraj\s*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Jeden kraj v rozcestníku — popisek, slug a počet poslanců. */
export interface KrajInfo {
  slug: string;
  label: string;
  count: number;
  /** True jen pro koš „kraj neuveden". */
  unassigned: boolean;
}

/**
 * Kraje přítomné v žebříčku, česká abeceda; koš „kraj neuveden" (existuje-li)
 * VŽDY poslední — je to přiznaná mezera registru, ne čtrnáctý kraj.
 */
export function listKraje(entries: readonly LeaderboardListEntry[]): KrajInfo[] {
  const byLabel = new Map<string, number>();
  let unassigned = 0;
  for (const e of entries) {
    if (e.region === null) unassigned++;
    else byLabel.set(e.region, (byLabel.get(e.region) ?? 0) + 1);
  }
  const out: KrajInfo[] = [...byLabel.entries()]
    .map(([label, count]) => ({ slug: krajSlug(label), label, count, unassigned: false }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"));
  if (unassigned > 0)
    out.push({ slug: KRAJ_NEUVEDEN_SLUG, label: KRAJ_NEUVEDEN_LABEL, count: unassigned, unassigned: true });
  return out;
}

/** Řádek karty: položka žebříčku + krajské competition pořadí. */
export interface KrajSlateRow extends LeaderboardListEntry {
  krajRank: number;
  /** Kolik poslanců KRAJE sdílí přesně toto skóre (1 = jedinečné). */
  krajTiedCount: number;
}

export interface KrajSlate {
  slug: string;
  label: string;
  unassigned: boolean;
  rows: KrajSlateRow[];
  /** Velikost celé sněmovny — jmenovatel celostátní příčky („č. 12 z 207"). */
  totalMps: number;
  /** Průměr indexu poslanců kraje (na desetiny) — vedle celosněmovního průměru. */
  avgScore: number;
}

/**
 * Výřez žebříčku pro jeden kraj. `entries` MUSÍ přijít už seřazené a
 * oprávkované (oficiální loader, nebo výstup reweigh() pod čtenářovou čočkou)
 * — funkce pořadí NEPŘEPOČÍTÁVÁ, jen filtruje a čísluje krajskou příčku týmž
 * competition pravidlem. Neznámý slug / kraj bez poslanců → null (poctivá 404).
 */
export function krajSlate(entries: readonly LeaderboardListEntry[], slug: string): KrajSlate | null {
  const rows = entries.filter((e) =>
    slug === KRAJ_NEUVEDEN_SLUG ? e.region === null : e.region !== null && krajSlug(e.region) === slug,
  );
  if (rows.length === 0) return null;

  const tiedByScore = new Map<number, number>();
  for (const r of rows) tiedByScore.set(r.score, (tiedByScore.get(r.score) ?? 0) + 1);
  let rank = 0;
  let placed = 0;
  let prevScore = Number.NaN;
  const ranked: KrajSlateRow[] = rows.map((r) => {
    placed++;
    if (r.score !== prevScore) {
      rank = placed;
      prevScore = r.score;
    }
    return { ...r, krajRank: rank, krajTiedCount: tiedByScore.get(r.score) ?? 1 };
  });

  const unassigned = slug === KRAJ_NEUVEDEN_SLUG;
  return {
    slug,
    label: unassigned ? KRAJ_NEUVEDEN_LABEL : (rows[0].region as string),
    unassigned,
    rows: ranked,
    totalMps: entries.length,
    avgScore: round1(rows.reduce((s, r) => s + r.score, 0) / rows.length),
  };
}

/** Zdrojový řádek citace — týž jako arch žebříčku (demo/LeaderboardPoster). */
export const KRAJ_SOURCE_LABEL =
  "psp.cz — hlasování, tisky, stenozáznamy, členství (deterministický znalostní graf)";

/**
 * Vstup archivní citace volební karty — jediné místo, kde se skládá; karta ho
 * podá buildPosterCitation() (kanonický tvar patičky, batch 1D). Pod čtenářovou
 * čočkou řádek metodiky PŘIZNÁVÁ vektor vah — vytištěná karta s cizí čočkou
 * nesmí jít vydávat za zveřejněný index.
 *
 * Vektor zveřejněných vah se NEPÍŠE (2026-08-12). Do teď tu stál literál
 * „25/20/20/15/10/10" — na jediné ploše, kterou po vytištění nikdo neopraví,
 * a na stránce, jejíž celý smysl je, že ty váhy jde převážit. Stráž v
 * messages.test.ts ho neviděla dvakrát naráz: hlídala jen katalogy a jen tvar
 * s pomlčkou. Zdrojem je `PUBLISHED_WEIGHTS_LABEL`, odvozený z
 * CONTRIBUTION_WEIGHTS — změna vzorce teď arch přeteče, ne nechá lhát.
 */
export function krajCitationInput(args: {
  liveUrl: string;
  /**
   * Den, KE KTERÉMU ČÍSLA PLATÍ — `contribution_provenance.computedAt` komory,
   * ne okamžik tisku. `null` = komora se na jednom dni neshodne a arch datum
   * neuvádí; nikdy se nenahrazuje dneškem (viz PosterCitationInput.retrievedAt).
   */
  retrievedAt: string | null;
  provenancePass: number | null;
  /** Rozpor mezi linií formule v datech a v kódu (formulaMismatchOrNull); null = shoda. */
  formulaMismatch?: { storedRef: string; declaredRef: string } | null;
  weights: WeightVector;
}): PosterCitationInput {
  const custom = !isPublishedWeights(args.weights);
  return {
    sourceLabel: KRAJ_SOURCE_LABEL,
    sourceUrl: args.liveUrl,
    retrievedAt: args.retrievedAt,
    methodology: custom
      ? `VLASTNÍ ČOČKA ČTENÁŘE — váhy ${encodeWeights(args.weights)} (přepočet šesti zveřejněných složek; nejde o zveřejněnou metodiku)`
      : `index přispění 0–100, šest složek s publikovanou vahou ${PUBLISHED_WEIGHTS_LABEL}`,
    provenancePass: args.provenancePass,
    formulaMismatch: args.formulaMismatch ?? null,
  };
}
