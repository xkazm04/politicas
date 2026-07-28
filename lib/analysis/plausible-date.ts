/**
 * Je tohle datum vůbec datum?
 *
 * Korpus smluv z registru smluv nese podpisy v letech 0002, 0016, 0018, 0024,
 * 1970, 2027, 2029 i 3062 (naměřeno 19 z 97 887 smluv dosažitelných přes
 * `linked_to` vazby, 2026-07-28). Takový záznam není datovaný fakt: buď je
 * překlep v primárním zdroji, nebo chyba parsování při ingestu. Produkt, jehož
 * značkou je „každé číslo cituje svůj zdroj", nesmí ani jedno z toho vykreslit
 * jako datum podpisu — a nesmí ho ani OPRAVIT, protože opravou by si datum
 * vymyslel.
 *
 * Jediné čestné chování: datum potlačit, řádek ponechat (smlouva existuje a
 * částku nese) a mezeru přiznat čtenáři. Tenhle modul je ten test, sdílený, aby
 * hranice byla v celé aplikaci jedna a stejná.
 *
 * Stejnou hranici uplatňuje kniha datovaných faktů na `/dashboard`
 * (`features/dashboard/datedFacts.ts`), tam ovšem s tvrdším důsledkem: fakt bez
 * možného data z chronologie vypadává úplně, protože bez data by v ní neměl kam
 * stát. Spis poslance smlouvu neřadí podle data, takže ji smí ukázat bez něj.
 */

/** Dolní hranice: vznik České republiky. Rejstříkové role sahají do 90. let,
 *  registr smluv začíná 2016 — pod 1993 už nejde o datum, ale o vadu dat. */
export const PLAUSIBLE_FROM = "1993-01-01";

/**
 * `true` když `iso` je `YYYY-MM-DD` (případně s časovou částí) v rozsahu
 * <PLAUSIBLE_FROM, `todayIso`>. Porovnává se lexikograficky — ISO datum to
 * dovoluje a nevzniká tím žádná časová zóna navíc.
 *
 * `todayIso` se předává, ne čte z hodin: stránky jsou staticky generované a
 * `Date.now()` uvnitř renderu by rozešel SSR s CSR. Volající má jeden okamžik
 * na celou stránku a ten si i vytiskne.
 */
export function isPlausibleIsoDate(iso: string | null | undefined, todayIso: string): boolean {
  if (typeof iso !== "string" || iso.length < 10) return false;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day >= PLAUSIBLE_FROM && day <= todayIso;
}

/** Datum, které smí být vykresleno, jinak `null` — nikdy opravená hodnota. */
export function plausibleIsoDateOrNull(iso: string | null | undefined, todayIso: string): string | null {
  return isPlausibleIsoDate(iso, todayIso) ? (iso as string).slice(0, 10) : null;
}
