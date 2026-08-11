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
 *
 * ── ZÁPIS DO ADRESY JE UDÁLOST, NE KROK POSUVNÍKU (2026-08-11) ──────────────
 * `setAll` volal `replaceState` bezpodmínečně a panel vah ho volal na KAŽDÝ
 * krok posuvníku — jeden tah myší je 35–100 kroků. WebKit na to má tvrdý strop
 * (SecurityError nad ~100 voláními replaceState za 30 s), takže dost dlouhý tah
 * shodil zápis adresy úplně: čtenář by pak sdílel odkaz BEZ své čočky, aniž by
 * cokoli řeklo, že se něco nepovedlo.
 *
 * Rozdělení je proto výslovné:
 *  - `setWeight` mění jen REACT STAV (žebříček se přepočítává živě, každý krok);
 *  - `commit()` zapíše adresu na KONCI interakce (pointerup / keyup / blur);
 *  - `setAll` (preset, reset) zapisuje hned — jedno kliknutí je jeden zápis;
 *  - `shareHref()` si adresu SÁM dopočítá a zároveň ji zapíše, takže
 *    zkopírovaný odkaz a řádek prohlížeče se nemohou rozejít ani uprostřed tahu.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentKey } from "./getLeaderboardData";
import {
  decodeWeights,
  encodeWeights,
  isPublishedWeights,
  LENS_PARAM,
  PUBLISHED_WEIGHTS,
  type WeightVector,
} from "./lens";

/**
 * Adresa nesoucí daný vektor vah — ČISTÁ funkce (adresa dovnitř, adresa ven),
 * jediné místo, kde se čočka do adresy skládá.
 *
 * Vrací OBOJÍ tvar záměrně: `path` jde do `history.replaceState` (relativní,
 * jak to tahle aplikace dělá všude) a `href` do schránky (absolutní, jinak by
 * odkaz nešlo poslat). Kdyby si je počítala dvě různá místa, mohl by se
 * zkopírovaný odkaz rozejít s tím, co má čtenář v řádku prohlížeče — a přesně
 * to je stav, kdy někdo sdílí cizí metodiku a neví o tom.
 *
 * Zveřejněné váhy parametr ODSTRAŇUJÍ (čistá adresa = oficiální index).
 */
export function lensAddress(currentHref: string, w: WeightVector): { href: string; path: string } {
  const url = new URL(currentHref);
  const encoded = encodeWeights(w);
  if (encoded === null) url.searchParams.delete(LENS_PARAM);
  else url.searchParams.set(LENS_PARAM, encoded);
  return { href: url.toString(), path: `${url.pathname}${url.search}${url.hash}` };
}

export interface LensWeightsState {
  /** Aktuální váhy. Při prvním renderu VŽDY zveřejněná metodika (viz hlavička). */
  weights: WeightVector;
  /** True ⇔ váhy = zveřejněná metodika (oficiální index, žádná čočka). */
  isDefault: boolean;
  /** Nastavit jednu složku (0–100, zaokrouhlí a ořízne). Mění JEN stav —
   *  adresu zapíše až `commit()` na konci interakce. */
  setWeight: (key: ComponentKey, value: number) => void;
  /** Nastavit celý vektor (preset) — jedno gesto, jeden zápis do adresy. */
  setAll: (w: WeightVector) => void;
  /** Zapsat aktuální váhy do adresy. Volá se na KONCI interakce (konec tahu,
   *  puštění klávesy, opuštění posuvníku); opakované volání je neškodné. */
  commit: () => void;
  /** Absolutní adresa s aktuální čočkou — a zároveň ji zapíše do historie,
   *  aby se zkopírovaný odkaz a řádek prohlížeče shodovaly. */
  shareHref: () => string;
  /** Návrat ke zveřejněné metodice. */
  reset: () => void;
}

export function useLensWeights(): LensWeightsState {
  const [weights, setWeights] = useState<WeightVector>(PUBLISHED_WEIGHTS);
  // Poslední známý vektor MIMO render: `commit()` i `shareHref()` běží z
  // event handlerů, které by jinak viděly stav toho renderu, ve kterém vznikly
  // (u posuvníku klidně o desítky kroků starší). Ref se plní jen v jednom
  // zapisovači níž — nikdy během renderu.
  const latest = useRef<WeightVector>(PUBLISHED_WEIGHTS);

  const apply = useCallback((next: WeightVector) => {
    latest.current = next;
    setWeights(next);
  }, []);

  const writeUrl = useCallback((w: WeightVector) => {
    const { path } = lensAddress(window.location.href, w);
    window.history.replaceState(window.history.state, "", path);
  }, []);

  // URL → stav. Po připojení a při každé skutečné navigaci v historii.
  useEffect(() => {
    const read = () => {
      const raw = new URL(window.location.href).searchParams.get(LENS_PARAM);
      const decoded = raw !== null ? decodeWeights(raw) : null;
      const next = decoded ?? PUBLISHED_WEIGHTS;
      latest.current = next;
      setWeights(next);
      // Neplatná i zveřejněná hodnota se z adresy vyhodí (lensAddress to udělá
      // sama tím, že zveřejněné váhy kóduje jako „žádný parametr").
      if (raw !== null && (decoded === null || isPublishedWeights(decoded))) {
        const { path } = lensAddress(window.location.href, next);
        window.history.replaceState(window.history.state, "", path);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  // Stav → URL. Záměrně BEZ funkční varianty setState: zápis do historie je
  // vedlejší efekt a updater musí zůstat čistý (StrictMode ho volá dvakrát).
  const setAll = useCallback(
    (next: WeightVector) => {
      writeUrl(next);
      apply(next);
    },
    [apply, writeUrl],
  );

  const setWeight = useCallback(
    (key: ComponentKey, value: number) => {
      const v = Math.max(0, Math.min(100, Math.round(value)));
      // Jen stav: adresa se dopíše na konci tahu (viz hlavička).
      apply({ ...latest.current, [key]: v });
    },
    [apply],
  );

  const commit = useCallback(() => writeUrl(latest.current), [writeUrl]);

  const shareHref = useCallback(() => {
    const { href, path } = lensAddress(window.location.href, latest.current);
    window.history.replaceState(window.history.state, "", path);
    return href;
  }, []);

  const reset = useCallback(() => setAll({ ...PUBLISHED_WEIGHTS }), [setAll]);

  return {
    weights,
    isDefault: isPublishedWeights(weights),
    setWeight,
    setAll,
    commit,
    shareHref,
    reset,
  };
}
