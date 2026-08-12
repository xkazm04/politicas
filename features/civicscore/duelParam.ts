// SOUBOJ V ADRESE — `?souboj=6150-6881`.
//
// Do 2026-08-12 byl souboj holý `useState` uvnitř CivicScorePage: dvojice se
// nedala sdílet, nepřežila obnovení stránky ani tlačítko zpět, a klik na „vs"
// u 150. řádku měnil panel o čtyři obrazovky výš, aniž by to čtenář poznal.
//
// Kodek je ČISTÝ a drží se přesně té disciplíny, kterou pro `?vahy=` zavedl
// ./lens.ts (a pro `?uzel=` Velín):
//
//  1. VÝCHOZÍ STAV SE DO ADRESY NEPÍŠE. Souboj se sám osazuje první dvojicí
//     zveřejněného žebříčku; čistá adresa tedy JE ta dvojice a `?souboj=`
//     s ní by tvrdil výběr, který čtenář neudělal.
//  2. NEPLATNÁ HODNOTA SE NEOPRAVUJE. Překlep, tři čísla, jedno jméno, číslo
//     mimo sněmovnu → `null`, a volající ji z adresy VYHODÍ. Adresa je
//     tvrzení; tiše „nejbližší platná" dvojice by tvrdila cizí souboj.
//  3. POŘADÍ SE NORMALIZUJE. Souboj A vs B je týž souboj jako B vs A, takže
//     `6881-6150` i `6150-6881` musí dát JEDNU adresu — jinak by dva čtenáři
//     sdíleli dva odkazy na jednu stránku a nešlo by je porovnat.
//
// Adresu skládá JEDNO místo (`duelAddress`) — cizí parametry (`?vahy=`
// čočky!) i fragment zůstávají nedotčené, protože se pracuje nad `URL`,
// nikdy nad ručně slepeným řetězcem.

/** Query parametr nesoucí souboj. Česky, jako `?vahy=` a `?uzel=`. */
export const DUEL_PARAM = "souboj";

/** Oddělovač dvou mandátních čísel v hodnotě parametru. */
const SEP = "-";

/** Mandátní číslo psp.cz: kladné celé číslo, dnes 3–4 číslice (346 … 7034).
 *  Strop je záměrně volný (7 číslic) — brána je „tvar", ne dnešní rozsah. */
const ID_RE = /^\d{1,7}$/;

/** Dvojice v kanonickém pořadí (vzestupně) — souboj je symetrický. */
export function normalizeDuelPair(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Hodnota z adresy → dvojice mandátních čísel, nebo `null` pro cokoli
 * neplatného. Nikdy nevrací jednoprvkový výběr: souboj jsou dva, a rozdělaný
 * výběr je gesto, ne adresa.
 */
export function decodeDuel(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(SEP);
  if (parts.length !== 2) return null;
  if (!parts.every((p) => ID_RE.test(p))) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  // Nula není mandátní číslo a poslanec sám se sebou nesoupeří.
  if (a <= 0 || b <= 0 || a === b) return null;
  return normalizeDuelPair(a, b);
}

/**
 * Výběr → hodnota parametru, nebo `null` = „parametr do adresy nepatří".
 *
 * `null` má tři důvody a všechny jsou záměr:
 *  · výběr není úplný (0 nebo 1 poslanec) — souboj ještě není,
 *  · výběr JE výchozí dvojice žebříčku — čistá adresa je ta kanonická,
 *  · dvojice je nesmyslná (tentýž poslanec dvakrát).
 */
export function encodeDuel(
  selection: readonly number[],
  defaultPair: readonly number[],
): string | null {
  if (selection.length !== 2) return null;
  const [a, b] = normalizeDuelPair(selection[0], selection[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) return null;
  if (defaultPair.length === 2) {
    const [da, db] = normalizeDuelPair(defaultPair[0], defaultPair[1]);
    if (a === da && b === db) return null;
  }
  return `${a}${SEP}${b}`;
}

/**
 * Adresa nesoucí daný souboj — ČISTÁ funkce (adresa dovnitř, adresa ven),
 * jediné místo, kde se souboj do adresy skládá.
 *
 * Vrací OBOJÍ tvar ze stejného důvodu jako `lensAddress`: `path` jde do
 * `history.replaceState`, `href` do schránky. Kdyby si je počítala dvě různá
 * místa, mohl by se zkopírovaný odkaz rozejít s řádkem prohlížeče.
 *
 * Čočka (`?vahy=`), cizí parametry i fragment se NESAHAJÍ — mění se právě
 * jeden klíč.
 */
export function duelAddress(
  currentHref: string,
  selection: readonly number[],
  defaultPair: readonly number[],
): { href: string; path: string } {
  const url = new URL(currentHref);
  const encoded = encodeDuel(selection, defaultPair);
  if (encoded === null) url.searchParams.delete(DUEL_PARAM);
  else url.searchParams.set(DUEL_PARAM, encoded);
  return { href: url.toString(), path: `${url.pathname}${url.search}${url.hash}` };
}

/**
 * Přepnutí jednoho poslance ve výběru — TÁŽ logika, jakou stránka měla
 * inline: třetí výběr vyřadí staršího, opětovný klik odebere.
 * Čistá funkce, aby ji šlo připnout testem (a aby ji hook nemusel psát znovu).
 */
export function toggleDuelSelection(selection: readonly number[], pspId: number): number[] {
  return selection.includes(pspId) ? selection.filter((x) => x !== pspId) : [...selection.slice(-1), pspId];
}
