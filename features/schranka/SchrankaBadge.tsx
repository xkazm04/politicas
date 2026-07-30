"use client";

/*
 * Odznak novinek u řádku „Schránka" v liště: počet záznamů u sledovaných
 * entit od poslední návštěvy. Nesvítí bez sledování, bez razítka návštěvy
 * ani při nule; když se novinky nepodaří načíst, mlčí (odznak je nápověda,
 * ne tvrzení — čestný stav chyby nese plocha /schranka).
 */

import { czechInt } from "@/lib/format";
import { useNewsCount } from "./useNews";

export default function SchrankaBadge() {
  const count = useNewsCount();
  if (count === null || count === 0) return null;
  return (
    <span
      className="shrink-0 border border-signal-deep px-1.5 font-mono text-[11px] font-bold tabular-nums text-signal-deep"
      aria-label={`nové záznamy u sledovaných entit: ${czechInt(count)}`}
    >
      {/* citation-ok: odznak je počet položek UI; citaci zdrojů nese plocha /schranka, kam řádek lišty vede */}
      {czechInt(count)}
    </span>
  );
}
