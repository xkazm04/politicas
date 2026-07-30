"use client";

/*
 * ČTENÁŘOVA ČOČKA V URL — stav vah otevřeného indexu (?vahy=30-10-20-15-10-15).
 *
 * Stejná disciplína jako features/dashboard/useGraphSelection.ts (tamtéž je
 * plné zdůvodnění, tady jen shrnutí):
 *  - URL se čte až PO připojení: `useSearchParams()` by stránku zdynamičtělo
 *    a první render na serveru a klientu by se mohl lišit (rozjetá hydratace
 *    je v tomhle repu draze zaplacená lekce). První render je proto vždy
 *    zveřejněná metodika; sdílená čočka naskočí o snímek později.
 *  - Zápis přes `history.replaceState`, ne router: posunutí posuvníku není
 *    navigace a zpětné tlačítko nemá být deník tahů.
 *  - Neplatná hodnota (překlep, cizí formát) se z adresy VYHODÍ — adresa je
 *    tvrzení a `?vahy=nesmysl` u stránky s oficiálním indexem by lhala.
 *    Hodnota rovná zveřejněné metodice se vyhodí také: čistá adresa JE
 *    oficiální index.
 */

import { useCallback, useEffect, useState } from "react";
import type { ComponentKey } from "./getLeaderboardData";
import {
  decodeWeights,
  encodeWeights,
  isPublishedWeights,
  LENS_PARAM,
  PUBLISHED_WEIGHTS,
  type WeightVector,
} from "./lens";

export interface LensWeightsState {
  /** Aktuální váhy. Při prvním renderu VŽDY zveřejněná metodika (viz hlavička). */
  weights: WeightVector;
  /** True ⇔ váhy = zveřejněná metodika (oficiální index, žádná čočka). */
  isDefault: boolean;
  /** Nastavit jednu složku (0–100, zaokrouhlí a ořízne). */
  setWeight: (key: ComponentKey, value: number) => void;
  /** Nastavit celý vektor (preset). */
  setAll: (w: WeightVector) => void;
  /** Návrat ke zveřejněné metodice. */
  reset: () => void;
}

export function useLensWeights(): LensWeightsState {
  const [weights, setWeights] = useState<WeightVector>(PUBLISHED_WEIGHTS);

  // URL → stav. Po připojení a při každé skutečné navigaci v historii.
  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(LENS_PARAM);
      const decoded = raw !== null ? decodeWeights(raw) : null;
      setWeights(decoded ?? PUBLISHED_WEIGHTS);
      if (raw !== null && (decoded === null || isPublishedWeights(decoded))) {
        url.searchParams.delete(LENS_PARAM);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  // Stav → URL. Záměrně BEZ funkční varianty setState: zápis do historie je
  // vedlejší efekt a updater musí zůstat čistý (StrictMode ho volá dvakrát).
  const setAll = useCallback((next: WeightVector) => {
    const url = new URL(window.location.href);
    const encoded = encodeWeights(next);
    if (encoded === null) url.searchParams.delete(LENS_PARAM);
    else url.searchParams.set(LENS_PARAM, encoded);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setWeights(next);
  }, []);

  const setWeight = useCallback(
    (key: ComponentKey, value: number) => {
      const v = Math.max(0, Math.min(100, Math.round(value)));
      setAll({ ...weights, [key]: v });
    },
    [setAll, weights],
  );

  const reset = useCallback(() => setAll({ ...PUBLISHED_WEIGHTS }), [setAll]);

  return { weights, isDefault: isPublishedWeights(weights), setWeight, setAll, reset };
}
