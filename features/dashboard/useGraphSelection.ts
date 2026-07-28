"use client";

/*
 * VÝBĚR UZLU VE VELÍNU — jedna sdílená sémantika pro graf i pás provozu.
 *
 * ── Sémantika (vypisuje se i na ploše, viz `dashboard.graph.selectedLabel`) ──
 *   VÝBĚR (`selected`) je stav plochy: profiltruje pás provozu, drží ho
 *     kroužek u uzlu, je v URL a dá se poslat odkazem.
 *   NÁHLED (hover) je jen podržený prst nad obrázkem: rozsvítí stopu uzlu,
 *     NIC nefiltruje a nepřepisuje výběr. Žije uvnitř plátna (viz
 *     StateGraphCanvas), takže se o něm zbytek stránky nedozví.
 * Díky tomu nemůže nastat stav, kdy obrázek a seznam popisují jiný výběr —
 * výběr je jen jeden a obojí ho čte ze stejného místa.
 *
 * ── Proč se URL čte až po připojení ─────────────────────────────────────────
 * `useSearchParams()` by z /dashboard udělalo dynamickou stránku (nebo by si
 * vyžádalo Suspense hranici) a hlavně by první render na serveru a na klientu
 * NEMUSEL být týž — a rozjetá hydratace je v tomhle repu draze zaplacená
 * lekce (viz Hemicycle.tsx, CLAUDE.md „Known gotchas"). Počáteční stav je
 * proto vždy `null` na obou stranách a URL se čte až v efektu po připojení.
 * Sdílený odkaz tak výběr obnoví o snímek později, ale bez rizika mismatche.
 *
 * Zápis jde přes `history.replaceState`, ne `router.push`: výběr uzlu není
 * navigace. `pushState` by ze zpětného tlačítka udělal deník klikání a
 * `router.replace` by kvůli jednomu kroužku znovu vyžádal serverovou stránku.
 */

import { useCallback, useEffect, useState } from "react";

/** Query parametr nesoucí výběr. Česky, jako zbytek plochy. */
export const SELECTION_PARAM = "uzel";

export interface GraphSelection {
  /** Vybraný uzel, nebo null. Při prvním renderu VŽDY null (viz hlavička). */
  selected: string | null;
  /** Vybrat uzel; `null` výběr zruší. Týž uzel podruhé = zrušení (toggle). */
  select: (id: string | null) => void;
  /** Zrušit výběr — pojmenovaná varianta pro tlačítko „zrušit výběr". */
  clear: () => void;
}

/**
 * @param validIds Id uzlů, které výřez skutečně kreslí. Hodnota z URL, která
 *   mezi nimi není (zastaralý odkaz, překlep, jiný výřez), se ignoruje —
 *   fantomový filtr „0 z 12 záznamů" bez viditelného uzlu je horší než nic.
 */
export function useGraphSelection(validIds: ReadonlySet<string>): GraphSelection {
  const [selected, setSelected] = useState<string | null>(null);

  // URL → stav. Běží po připojení a pak při každé skutečné navigaci v historii.
  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(SELECTION_PARAM);
      const valid = raw !== null && validIds.has(raw);
      setSelected(valid ? raw : null);
      // Neplatná hodnota se z adresy VYHODÍ. Adresa je taky tvrzení: „?uzel=X"
      // u stránky, kde nic vybraného není, je nepravdivý údaj — a uživatel by
      // takový odkaz poslal dál v domnění, že něco ukazuje.
      if (raw !== null && !valid) {
        url.searchParams.delete(SELECTION_PARAM);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [validIds]);

  // Stav → URL. Bez parametru, když není co vybírat: čistá adresa je taky
  // sdělení („nic není vybráno"), a `?uzel=` bez hodnoty je jen šum.
  // Záměrně BEZ funkční varianty setState: zápis do historie je vedlejší efekt
  // a updater musí zůstat čistý (StrictMode ho volá dvakrát).
  const select = useCallback(
    (id: string | null) => {
      const next = id !== null && validIds.has(id) ? id : null;
      const value = selected === next ? null : next;
      if (value === selected) return;
      const url = new URL(window.location.href);
      if (value === null) url.searchParams.delete(SELECTION_PARAM);
      else url.searchParams.set(SELECTION_PARAM, value);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      setSelected(value);
    },
    [selected, validIds],
  );

  const clear = useCallback(() => select(null), [select]);

  return { selected, select, clear };
}
