/*
 * ČLENSKÉ OKNO — čistý predikát „drží člověk tento sedák k okamžiku asOf?".
 *
 * Konec okna má tři poctivé významy a čtvrtý nepoctivý:
 *  • `null`               — psp.cz export: okno běží (otevřený konec)
 *  • čitelné datum <= asOf — okno skončilo
 *  • nečitelný konec       — neznámý konec, NE otevřený
 *  • konec po asOf         — členství se zapisuje zpětně, takže budoucí konec je
 *    zástupná hodnota (korpus nese rok 2925); stejné pravidlo jako
 *    `plausibleDay` ve spisu (careerSpine.ts)
 *  • konec před začátkem   — nemožné okno
 * Neznámý a nemožný konec nikdy neprojdou predikátem „teď drží"; řádek zůstává,
 * jen se přizná (`unreadable`), nikdy se neopraví.
 */

export type SeatWindowState = "open" | "closed" | "unknown" | "impossible";

export interface SeatWindow {
  state: SeatWindowState;
  /** Jen `open` je „drží teď". */
  current: boolean;
  /** Konec nelze přečíst jako věrohodný (unknown | impossible). */
  unreadable: boolean;
}

export function seatWindow(fromAt: string | null, toAt: string | null, asOfMs: number): SeatWindow {
  const done = (state: SeatWindowState): SeatWindow => ({
    state,
    current: state === "open",
    unreadable: state === "unknown" || state === "impossible",
  });
  if (!toAt) return done("open");
  const toMs = Date.parse(toAt);
  if (!Number.isFinite(toMs) || toMs > asOfMs) return done("unknown");
  const fromMs = fromAt ? Date.parse(fromAt) : NaN;
  if (Number.isFinite(fromMs) && toMs < fromMs) return done("impossible");
  return done("closed");
}
