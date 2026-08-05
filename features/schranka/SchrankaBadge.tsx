"use client";

/*
 * Odznak novinek u řádku „Schránka" v liště: počet záznamů u sledovaných
 * entit od poslední návštěvy. Nesvítí bez sledování, bez razítka návštěvy
 * ani při nule; když se novinky nepodaří načíst, mlčí (odznak je nápověda,
 * ne tvrzení — čestný stav chyby nese plocha /schranka).
 *
 * Číslo se mění bez akce čtenáře (dotaz doběhne, sledování se přidá, návštěva
 * ho zhasne), takže vnější obálka je `aria-live="polite"` a je v DOMu POŘÁD —
 * region, který se objeví až se změnou, odečítač obrazovky neohlásí.
 */

import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { useNewsCount } from "./useNews";

export default function SchrankaBadge() {
  const t = useTranslations("schranka");
  const f = useFormat();
  const count = useNewsCount();
  const empty = count === null || count === 0;
  return (
    <span aria-live="polite" aria-atomic="true" className="shrink-0">
      {!empty && (
        <span
          className="border border-signal-deep px-1.5 font-mono text-[11px] font-bold tabular-nums text-signal-deep"
          aria-label={t("badge.ariaLabel", { count: f.int(count) })}
        >
          {/* citation-ok: odznak je počet položek UI; citaci zdrojů nese plocha /schranka, kam řádek lišty vede */}
          {f.int(count)}
        </span>
      )}
    </span>
  );
}
