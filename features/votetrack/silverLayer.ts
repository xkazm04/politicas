/*
 * TŘETÍ STAV ODVOZENÉ VRSTVY — „nikdy nespočítáno" není výpadek.
 *
 * Tematické štítky nad hlasováními (`vote_tag`) jsou naše VLASTNÍ odvozená
 * vrstva: nevznikají u zdroje, počítá je klasifikátor nad názvy hlasování.
 * Na živém store je jich dnes NULA — ne proto, že by se nepodařilo něco
 * přečíst, ale proto, že se ta vrstva zatím nikdy nespočítala.
 *
 * Do 2026-08-12 obojí končilo jedním `null`, takže /kompas hlásil „data
 * nedostupná" (věta o výpadku, který se nekonal) a /hlasovani sekci témat
 * mlčky schovávalo. „Nepočítáno" a „nedostupné" jsou dvě různá tvrzení o
 * datech — přesně ten rozdíl, kvůli kterému /penize/strety rozlišuje
 * „nečteno" od nuly.
 *
 * Tři stavy, tři věty:
 *   null                       výpadek — store není nebo se z něj nedá číst
 *   { state: "never-computed" }  čtení PROBĚHLO a vrstva je prázdná
 *   { state: "ready", data }     vrstva je spočítaná
 *
 * Ten prostřední stav smí vzniknout JEN po úspěšném čtení. Loader si proto
 * napřed sáhne pro store (`getStore()` — memoizovaný handle, žádný dotaz
 * navíc) a teprve pak čte štítky; kdyby stavěl na prázdném poli, které
 * `readVoteTags()` vrací i bez store, vypadal by výpadek jako nespočítaná
 * vrstva.
 *
 * Čistý modul (žádný server-only import), aby ho směla použít i klientská
 * plocha, která ten stav vykresluje.
 */

export type SilverLayerRead<T> =
  | { state: "ready"; data: T }
  | { state: "never-computed" };

/** Jediná instance prostředního stavu — nese žádná data, protože žádná nejsou. */
export const SILVER_NEVER_COMPUTED = { state: "never-computed" } as const;

/** Spočítaná vrstva. */
export function silverReady<T>(data: T): SilverLayerRead<T> {
  return { state: "ready", data };
}
