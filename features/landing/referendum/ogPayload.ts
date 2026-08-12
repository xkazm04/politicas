// Referendum o metodice — čisté odvození „karty čočky" (moonshot 7B).
// Jeden zdroj pravdy pro tři plochy: OG obraz sdíleného odkazu
// (app/referendum/og), vestavný widget (app/embed/zebricek) i náhled na
// /referendum. Žádný fetch — vstupem je žebříček ze server-only loaderu,
// výstupem hotová data k sazbě. Testy: ogPayload.test.ts.
//
// KODEK ČOČKY JE JEDEN (features/civicscore/lens.ts, READ-ONLY): dekódování,
// normalizace i přepočet žebříčku jdou výhradně přes decodeWeights /
// effectiveWeights / reweigh. Neplatný vektor se NIKDY neopravuje — adresa je
// tvrzení (pravidlo kodeku) a karta pak poctivě říká „neplatné váhy".
// Zveřejněná metodika (i explicitně vypsaná v parametru) se ukazuje jako
// OFICIÁLNÍ index z grafu — autoritativní skóre, žádný přepočet.

import {
  decodeWeights,
  effectiveWeights,
  isPublishedWeights,
  LENS_COMPONENT_ORDER,
  PUBLISHED_WEIGHTS,
  reweigh,
  type WeightVector,
} from "@/features/civicscore/lens";
import type {
  ComponentKey,
  LeaderboardData,
  LeaderboardListEntry,
} from "@/features/civicscore/getLeaderboardData";
import type { ContributionProvenance } from "@/features/civicscore/provenance";
import { serializeWeights } from "./aggregate";

/** Co karta potřebuje ze žebříčku (podmnožina LeaderboardListData). */
export interface StandingsInput {
  entries: LeaderboardListEntry[];
  components: LeaderboardData["components"];
  /**
   * Komorový agregát `{pass, ref, computedAt}` — KDY byl žebříček spočítán.
   * Karta samotná ho nepoužívá (`deriveReferendumCard` z něj neodvozuje nic),
   * ale vestavný widget jím datuje svůj řádek „stav k": do 2026-08-12 tam stál
   * čas VYSAZENÍ widgetu, tedy `new Date()` route handleru — datum, které se
   * mění každou vteřinou, zatímco data pod ním jsou stará dávku. Proto je pole
   * volitelné: je to průvodní list ŽEBŘÍČKU, ne vstup výpočtu karty, a plocha,
   * která ho nemá, musí umět říct „datum přepočtu neznám" místo aby si ho
   * vymyslela. `LeaderboardListData` ho nese, takže loader ho předá sám.
   */
  provenance?: ContributionProvenance | null;
}

/** Jeden řádek top žebříčku na kartě. */
export interface CardRow {
  rank: number;
  tiedCount: number;
  name: string;
  clubAbbrev: string;
  /** Autoritativní skóre (official), nebo přepočet čočkou (lens). */
  score: number;
}

/** Otisk vah: šest složek s efektivní vahou (součet 100, desetiny). */
export type WeightFingerprint = Array<{ key: ComponentKey; eff: number }>;

export type ReferendumCard =
  /** Loader vrátil null (bez storu / prázdný graf) — karta to přizná. */
  | { kind: "nodata" }
  /** Parametr ?vahy= je přítomný, ale kodek ho nepřijme. Nic se neopravuje. */
  | { kind: "invalid" }
  /** Zveřejněná metodika — autoritativní index z grafu. */
  | {
      kind: "official";
      fingerprint: WeightFingerprint;
      top: CardRow[];
      count: number;
    }
  /** Čtenářova čočka — VŠECHNO na kartě pochází z přepočtu reweigh(). */
  | {
      kind: "lens";
      /** Kanonický vektor (serializeWeights) — do adres i titulků. */
      vector: string;
      fingerprint: WeightFingerprint;
      top: CardRow[];
      count: number;
    };

const toRow = (e: LeaderboardListEntry): CardRow => ({
  rank: e.rank,
  tiedCount: e.tiedCount,
  name: e.name,
  clubAbbrev: e.clubAbbrev,
  score: e.score,
});

function fingerprintOf(w: WeightVector): WeightFingerprint {
  const eff = effectiveWeights(w);
  return LENS_COMPONENT_ORDER.map((key) => ({ key, eff: eff[key] }));
}

/**
 * Jádro karty: žebříček + surový parametr `?vahy=` → co plocha vysází.
 * `topN` je počet řádků top žebříčku (OG karta 5, widget 10).
 */
export function deriveReferendumCard(
  data: StandingsInput | null,
  rawVahy: string | null | undefined,
  topN = 5,
): ReferendumCard {
  const raw = rawVahy ?? null;
  const weights = raw !== null && raw !== "" ? decodeWeights(raw) : null;
  if (raw !== null && raw !== "" && weights === null) return { kind: "invalid" };
  if (data === null) return { kind: "nodata" };

  const n = Math.max(1, Math.min(50, topN));
  if (weights === null || isPublishedWeights(weights)) {
    // Oficiální index: autoritativní skóre z grafu, žádný přepočet.
    return {
      kind: "official",
      fingerprint: fingerprintOf(PUBLISHED_WEIGHTS),
      top: data.entries.slice(0, n).map(toRow),
      count: data.entries.length,
    };
  }
  const view = reweigh(data.entries, data.components, weights);
  return {
    kind: "lens",
    vector: serializeWeights(weights),
    fingerprint: fingerprintOf(weights),
    top: view.entries.slice(0, n).map(toRow),
    count: view.entries.length,
  };
}
