// Referendum o metodice — čistá odvození anonymního agregátu vah (moonshot 7B).
// Žádný fetch, žádný stav — jen deterministická matematika s testy
// (aggregate.test.ts), ve stejné disciplíně jako features/civicscore/lens.ts.
//
// KODEK ČOČKY JE JEDEN: decodeWeights/encodeWeights/effectiveWeights se
// importují z features/civicscore/lens.ts a NIKDY se tu nereimplementují.
// Jediné, co tu přibývá, je `serializeWeights` — úložná serializace, kterou
// encodeWeights záměrně neumí (zveřejněnou metodiku kóduje jako null = čistá
// adresa; úložiště ale hlas „souhlasím se zveřejněnou metodikou" nést MUSÍ).
// Test drží průchodnost: pro každý nezveřejněný vektor se serializeWeights
// rovná encodeWeights a decodeWeights(serializeWeights(w)) je identita.
//
// ── Zveřejněné pravidlo agregátu ─────────────────────────────────────────────
//  1. Každý odevzdaný vektor se přepočte na EFEKTIVNÍ váhy (součet 100,
//     desetiny — effectiveWeights z lens.ts), takže 10-10-10-10-10-10 a
//     20-20-20-20-20-20 jsou týž hlas. Vektor se součtem 0 se do agregátu
//     nepočítá (nenese žádnou čočku).
//  2. Medián se počítá PO SLOŽKÁCH nad efektivními vahami, zaokrouhlen na
//     desetiny. Mediány složek obecně NEDAJÍ součet 100 — surface to přiznává,
//     nic se nedopočítává.
//  3. K-ANONYMITA: medián existuje až od n ≥ K_ANONYMITY_FLOOR platných hlasů.
//     Pod prahem se vrací null a UI ukazuje jen počet — nikdy „medián z mála",
//     který by fakticky zveřejnil jednotlivé hlasy.
//  4. Agregát je SEBEVÝBĚR čtenářů politicas, ne reprezentativní průzkum —
//     každá plocha, která ho ukazuje, to říká (doktrína evidence-first).

import {
  decodeWeights,
  effectiveWeights,
  LENS_COMPONENT_ORDER,
  type WeightVector,
} from "@/features/civicscore/lens";

/** Práh k-anonymity: pod tímto počtem hlasů se žádný medián nezveřejňuje. */
export const K_ANONYMITY_FLOOR = 20;

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Úložná serializace vektoru — kanonický pomlčkový tvar v pořadí
 * LENS_COMPONENT_ORDER. Na rozdíl od `encodeWeights` serializuje i zveřejněnou
 * metodiku (encodeWeights ji záměrně kóduje jako null — čistá adresa; úložiště
 * hlas „publikované váhy jsou správné" potřebuje jako plnohodnotný řádek).
 */
export function serializeWeights(w: WeightVector): string {
  return LENS_COMPONENT_ORDER.map((k) => String(w[k])).join("-");
}

export interface WeightAggregate {
  /** Počet PLATNÝCH hlasů (dekódovatelné vektory s nenulovým součtem). */
  n: number;
  /**
   * Medián efektivních vah po složkách (desetiny), nebo null pod prahem
   * k-anonymity. Součet mediánů obecně není 100 — pravidlo č. 2 výše.
   */
  median: WeightVector | null;
}

/** Medián seřazené řady — sudé n průměruje prostřední dvojici (týž tvar jako
 *  summarizeScores v lens.ts, jen nad jednou složkou). */
function medianOf(sorted: readonly number[]): number {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/**
 * Jádro agregátu: uložené kanonické vektory → počet + složkový medián.
 * Vstupy, které kodek nepřijme, se PŘESKOČÍ a nepočítají do n (obranná
 * hloubka — repository je nikdy zapsat nemělo; tichá „oprava" by fabulovala
 * hlas). Vektor se součtem 0 se přeskočí také (pravidlo č. 1).
 */
export function deriveWeightAggregate(storedVectors: readonly string[]): WeightAggregate {
  const effective: WeightVector[] = [];
  for (const raw of storedVectors) {
    const decoded = decodeWeights(raw);
    if (decoded === null) continue;
    if (LENS_COMPONENT_ORDER.reduce((s, k) => s + decoded[k], 0) === 0) continue;
    effective.push(effectiveWeights(decoded));
  }
  const n = effective.length;
  if (n < K_ANONYMITY_FLOOR) return { n, median: null };
  const median = {} as WeightVector;
  for (const k of LENS_COMPONENT_ORDER) {
    const sorted = effective.map((e) => e[k]).sort((a, b) => a - b);
    median[k] = round1(medianOf(sorted));
  }
  return { n, median };
}
