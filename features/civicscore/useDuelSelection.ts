"use client";

/*
 * SOUBOJ V ADRESE — stav výběru dvou poslanců (?souboj=6150-6881).
 *
 * Táž disciplína jako ./useLensWeights.ts (čočka) a features/dashboard/
 * useGraphSelection.ts (výběr uzlu ve Velíně); tady jen shrnutí, plné
 * zdůvodnění je v hlavičce useLensWeights:
 *
 *  - ADRESA SE ČTE AŽ PO PŘIPOJENÍ. `useSearchParams()` by stránku
 *    zdynamičtělo a první render na serveru a klientu by se mohl lišit
 *    (rozjetá hydratace je v tomhle repu draze zaplacená lekce). První render
 *    je proto VŽDY výchozí dvojice žebříčku; sdílený souboj naskočí o snímek
 *    později.
 *  - ZÁPIS PŘES `history.replaceState`, ne router: vybrat poslance do souboje
 *    není navigace a tlačítko zpět nemá být deníkem kliknutí. JEDNO KLIKNUTÍ
 *    = JEDEN ZÁPIS (na rozdíl od posuvníků čočky tu není gesto, které by se
 *    dalo dávkovat — a WebKitový strop ~100 replaceState / 30 s je tím pádem
 *    mimo dosah).
 *  - NEPLATNÁ HODNOTA SE Z ADRESY VYHODÍ. Překlep, tři čísla, i mandátní
 *    číslo, které dnešní sněmovna nenese, → výchozí dvojice a adresa se
 *    uklidí. Adresa je tvrzení; `?souboj=nesmysl` u stránky ukazující první
 *    dva poslance by lhala. Nikdy se „neopravuje" na nejbližší platnou —
 *    precedens `?uzel=` ve Velíně.
 *
 * `address` je poslední složená RELATIVNÍ adresa (null před připojením).
 * Existuje proto, aby tlačítko „kopírovat odkaz" a řádek prohlížeče nemohly
 * ukazovat dvě různé věci: obojí vzniká z jednoho `duelAddress()`. Přepočítává
 * se po KAŽDÉM renderu (a zapisuje jen při skutečné změně), protože adresu
 * mění i čočka — `?vahy=` se zapisuje odjinud a `?souboj=` o tom musí vědět.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DUEL_PARAM, decodeDuel, duelAddress, toggleDuelSelection } from "./duelParam";

export interface DuelSelectionState {
  /** Aktuální výběr (0–2 mandátní čísla), v pořadí výběru. */
  duel: number[];
  /** Přepnout poslance ve výběru — třetí výběr vyřadí staršího. */
  toggle: (pspId: number) => void;
  /** Relativní adresa nesoucí aktuální souboj; `null` před připojením
   *  (na serveru žádná adresa prohlížeče není a hádat ji by znamenalo
   *  vyrobit odkaz, který se po hydrataci změní). */
  address: string | null;
}

export function useDuelSelection({
  defaultPair,
  chamberIds,
}: {
  /** Dvojice, kterou žebříček ukazuje sám od sebe (první dva zveřejněného
   *  pořadí). Rovná se jí výběr ⇒ parametr se do adresy nepíše. */
  defaultPair: readonly number[];
  /** Mandátní čísla, která sněmovna dnes nese — proti nim se hodnota z adresy
   *  ověřuje. Prázdné pole = žebříček není načtený, a pak se NEOVĚŘUJE nic:
   *  nedostupný store není důkaz, že poslanec neexistuje. */
  chamberIds: readonly number[];
}): DuelSelectionState {
  const [duel, setDuel] = useState<number[]>(() => [...defaultPair]);
  // Adresa se POČÍTÁ, nedrží. Držená by se rozešla s řádkem prohlížeče
  // pokaždé, když adresu zapíše někdo jiný — a to se tu děje: `?vahy=` píše
  // useLensWeights, který o souboji neví.
  //
  // `addressKnown` není „mounted": je to okamžik, kdy tenhle hook adresu
  // POPRVÉ PŘEČETL (viz efekt níž). Do té chvíle vrací `null`, takže první
  // klientský render je shodný se serverovým a hydratace se nerozjede.
  const [addressKnown, setAddressKnown] = useState(false);

  // Poslední známý stav MIMO render: `toggle` běží z event handleru, který by
  // jinak viděl stav svého renderu. Plní se jen v jednom zapisovači níž.
  const latest = useRef<number[]>([...defaultPair]);
  const defaultRef = useRef<readonly number[]>(defaultPair);
  const knownRef = useRef<Set<number>>(new Set(chamberIds));

  // Refy se srovnají DŘÍV, než se čte adresa (efekty běží v pořadí deklarace).
  useEffect(() => {
    defaultRef.current = defaultPair;
    knownRef.current = new Set(chamberIds);
  }, [defaultPair, chamberIds]);

  const writeUrl = useCallback((next: readonly number[]) => {
    const { path } = duelAddress(window.location.href, next, defaultRef.current);
    window.history.replaceState(window.history.state, "", path);
  }, []);

  // Adresa → stav. Po připojení a při každé skutečné navigaci v historii.
  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(DUEL_PARAM);
      const decoded = decodeDuel(raw);
      const known = knownRef.current;
      // Dvojice mimo dnešní sněmovnu je pro tuhle stránku neplatná stejně jako
      // překlep — ale jen tehdy, když sněmovnu vůbec známe.
      const resolvable =
        decoded !== null && (known.size === 0 || (known.has(decoded[0]) && known.has(decoded[1])));
      const next = resolvable ? [...decoded] : [...defaultRef.current];
      latest.current = next;
      setDuel(next);
      setAddressKnown(true);
      // Neplatnou i výchozí hodnotu z adresy vymeteme (`duelAddress` to udělá
      // sama tím, že výchozí dvojici kóduje jako „žádný parametr").
      const { path } = duelAddress(window.location.href, next, defaultRef.current);
      if (path !== `${url.pathname}${url.search}${url.hash}`) {
        window.history.replaceState(window.history.state, "", path);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const toggle = useCallback(
    (pspId: number) => {
      // Záměrně BEZ funkční varianty setState: zápis do historie je vedlejší
      // efekt a updater musí zůstat čistý (StrictMode ho volá dvakrát).
      const next = toggleDuelSelection(latest.current, pspId);
      latest.current = next;
      setDuel(next);
      writeUrl(next);
    },
    [writeUrl],
  );

  // Skládá se ze STEJNÉ funkce jako zápis do historie, takže zkopírovaný
  // odkaz a řádek prohlížeče nemohou ukazovat dvě různé věci — a protože se
  // počítá při renderu, nese i čočku, kterou mezitím zapsal jiný hook.
  const address = addressKnown ? duelAddress(window.location.href, duel, defaultPair).path : null;

  return { duel, toggle, address };
}
