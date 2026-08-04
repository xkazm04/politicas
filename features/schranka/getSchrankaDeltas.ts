/*
 * Server-only sestavení delt schránky — JEDNO místo, ze kterého čtou VŠECHNY
 * odběrové adresy: /schranka/novinky.json (plocha + odznak lišty) i feedy
 * /schranka/feed.xml a /schranka/feed.json.
 *
 * Kdyby si každá adresa četla sama, feed by dřív nebo později hlásil jiné
 * novinky než plocha — a odběr, který tvrdí něco jiného než stránka, je horší
 * než žádný. Čtení jsou tytéž memoizované loadery jako /denik a /dukazy plus
 * indexovaný odečet provenance (getRecomputeFact); odvození je čisté
 * (deriveDeltas).
 *
 * null = záznam je nečitelný (deník nedostupný) → volající odpoví 503,
 * nikdy prázdným seznamem (precedens /denik/feed.json).
 */

import "server-only";
import { deriveDenikEntries } from "@/features/denik/deriveDenik";
import { getDenikData } from "@/features/denik/getDenikData";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { deriveDeltas, DELTA_ENTRIES_CAP, type EntityDelta } from "./deriveDeltas";
import { getRecomputeFact } from "./getRecomputeFact";
import type { NovinkyCoverage } from "./novinky";

export interface SchrankaDeltas {
  deltas: EntityDelta[];
  coverage: NovinkyCoverage;
  /** `YYYY-MM-DD` serveru — den sestavení (z loaderu deníku). */
  builtOn: string;
}

export async function getSchrankaDeltas(
  keys: readonly string[],
  since: string,
): Promise<SchrankaDeltas | null> {
  const [denik, dukazy, recompute] = await Promise.all([
    getDenikData(),
    getDukazyData(),
    getRecomputeFact(),
  ]);
  if (!denik) return null;

  const { entries } = deriveDenikEntries({
    contracts: denik.contracts,
    roles: denik.roles,
    bills: denik.bills,
    reviews: denik.reviews,
    changes: denik.changes,
    today: denik.builtOn,
  });

  return {
    deltas: deriveDeltas({
      entries,
      forensic: dukazy?.entries ?? [],
      recompute,
      keys,
      since,
      cap: DELTA_ENTRIES_CAP,
    }),
    coverage: { ...denik.coverage, dukazy: dukazy !== null, recompute: recompute !== null },
    builtOn: denik.builtOn,
  };
}
