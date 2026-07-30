/*
 * FORENZNÍ REŽIM — kodek adresy (batch 7D).
 *
 * Druhý objektiv aplikace: rentgenová řeč archivovaného směru „Rentgen"
 * (features/labs/rentgen) jako zapnutelná čočka nad živými plochami.
 * Režim se nese VÝHRADNĚ v adrese (`?rezim=forenzni`) — je sdílitelný
 * odkazem a nemá žádnou perzistenci: zavřít kartu = režim zmizel.
 *
 * Čistý modul bez DOM i Reactu (doktrína permalink.ts): kodek se testuje
 * na řetězcích. ADRESA JE TVRZENÍ — platná je jen přesná hodnota
 * `forenzni`; cokoli jiného (velká písmena, jiná slova) režim NEzapíná,
 * neopravujeme, odmítáme.
 */

/** Jméno parametru v adrese. */
export const FORENSIC_PARAM = "rezim";

/** Jediná platná hodnota parametru. */
export const FORENSIC_VALUE = "forenzni";

/** Kořenový datový atribut — nastavuje ho ForensicProvider, čte na něj
 *  podmíněná forenzní vrstva tokenů v app/globals.css. Selektor vrstvy je
 *  záměrně `[data-rezim="forenzni"]` (kterýkoli prvek, ne jen <html>), aby
 *  sonda plátna (features/graph/stagePalette.ts) mohla tokeny přečíst
 *  z vlastního prvku bez závislosti na pořadí efektů. */
export const FORENSIC_ATTR = "data-rezim";

/** Minimální rozhraní, které kodek potřebuje — sedí na URLSearchParams
 *  i na next/navigation ReadonlyURLSearchParams. */
export interface ParamsLike {
  get(name: string): string | null;
}

/** Je v parametrech zapnutý forenzní režim? Přísná shoda hodnoty. */
export function isForensic(params: ParamsLike | null | undefined): boolean {
  return params?.get(FORENSIC_PARAM) === FORENSIC_VALUE;
}

/**
 * Adresa téže stránky se zapnutým/vypnutým režimem. Ostatní parametry
 * (např. `?vahy=` čoček jiných ploch) zůstávají nedotčené — režim je
 * ortogonální ke stavu, který adresa už nese.
 */
export function withForensic(pathname: string, search: string | URLSearchParams, on: boolean): string {
  const params = new URLSearchParams(search);
  if (on) params.set(FORENSIC_PARAM, FORENSIC_VALUE);
  else params.delete(FORENSIC_PARAM);
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}
