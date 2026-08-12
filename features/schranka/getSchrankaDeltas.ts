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
import { getDenikData, type DenikLimits } from "@/features/denik/getDenikData";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import {
  daysBefore,
  deriveDeltas,
  DELTA_ENTRIES_CAP,
  FIRST_VISIT_DAYS,
  type EntityDelta,
} from "./deriveDeltas";
import { getRecomputeFact } from "./getRecomputeFact";
import type { NovinkyCoverage } from "./novinky";

export interface SchrankaDeltas {
  deltas: EntityDelta[];
  /** Práh, který se SKUTEČNĚ použil — volající ho cituje (feed i odpověď). */
  since: string;
  coverage: NovinkyCoverage;
  /** Meze ČTENÍ, ze kterého tyhle delty vznikly — doslova `DenikLimits`
   *  loaderu deníku, nic přepočítaného. `coverage` říká, jestli šla vrstva
   *  přečíst; tohle, jestli se přečetla celá. Do 2026-08-12 se sem nepředávalo
   *  nic, takže useknutý odečet zkrátil čtenáři deltu beze slova — na ploše,
   *  která hned vedle přiznává i jeden zahozený řádek odpovědi. */
  limits: DenikLimits;
  /** `YYYY-MM-DD` serveru — den sestavení (z loaderu deníku). */
  builtOn: string;
}

/**
 * `since === null` = volající práh nemá (čtečka feedu žádné razítko návštěvy
 * nenese) → okno první návštěvy nad dnem sestavení, tedy táž shovívavost jako
 * na ploše. Den se bere z LOADERU, ne z hodin route handleru: dvě různá „dnes"
 * v jedné odpovědi jsou přesně ten druh nesouladu, který nikdo nevystopuje.
 */
export async function getSchrankaDeltas(
  keys: readonly string[],
  sinceOrNull: string | null,
): Promise<SchrankaDeltas | null> {
  const [denik, dukazy, recompute] = await Promise.all([
    getDenikData(),
    getDukazyData(),
    getRecomputeFact(),
  ]);
  if (!denik) return null;

  const since = sinceOrNull ?? daysBefore(denik.builtOn, FIRST_VISIT_DAYS - 1);

  const { entries } = deriveDenikEntries({
    contracts: denik.contracts,
    roles: denik.roles,
    bills: denik.bills,
    reviews: denik.reviews,
    changes: denik.changes,
    today: denik.builtOn,
  });

  return {
    since,
    deltas: deriveDeltas({
      entries,
      forensic: dukazy?.entries ?? [],
      recompute,
      keys,
      since,
      cap: DELTA_ENTRIES_CAP,
    }),
    coverage: { ...denik.coverage, dukazy: dukazy !== null, recompute: recompute !== null },
    limits: denik.limits,
    builtOn: denik.builtOn,
  };
}
