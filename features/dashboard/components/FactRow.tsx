"use client";

/*
 * Řádek knihy datovaných faktů — datum, tón, věta, částka, citace.
 *
 * Věta se SÁZÍ ze šablony, nepíše se: fakt je typovaný (druh + entity + datum +
 * částka) a i18n kolem něj složí souvětí. Proto v řádku nemůže být tvrzení,
 * které graf nenese — a proto je řádek přeložitelný, aniž by se text duplikoval
 * do dat. Částka jde ze serveru jako číslo a formátuje se až tady.
 *
 * Zaměřovač vpravo připne uzel v grafu; textová část nikam nevede, protože
 * cílem faktu je entita, kterou uživatel vybere v grafu — ne pátý různý odkaz.
 */

import { useLocale, useTranslations } from "next-intl";
import { Crosshair } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import { compactCzk } from "@/features/money/moneyTypes";
import type { DatedFact } from "../datedFacts";

const TONE_DOT: Record<DatedFact["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
};

export default function FactRow({
  fact,
  dim = false,
  onPick,
}: {
  fact: DatedFact;
  dim?: boolean;
  onPick?: (nodeId: string) => void;
}) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();
  const locale = useLocale();

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5 transition-opacity sm:grid-cols-[5.5rem_auto_1fr_auto] ${
        onPick ? "hover:bg-paper-strong" : ""
      } ${dim ? "opacity-40" : ""}`}
    >
      <span className="col-span-3 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
        {f.date(fact.date)}
      </span>
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[fact.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        {tf(`fact.${fact.kind}`, { subject: fact.subject, detail: fact.detail ?? "" })}
        {fact.czk !== undefined && (
          <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {compactCzk(fact.czk, locale)}
          </span>
        )}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{fact.source}]
        </span>
        {/* Vazba, na které fakt stojí, ještě neprošla lidskou kontrolou — řekne
            to řádek sám, ne až metodika pod panelem. */}
        {fact.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {tf("factPending")}
          </span>
        )}
      </span>
      {onPick && fact.refs.length > 0 && (
        <button
          type="button"
          onClick={() => onPick(fact.refs[0])}
          title={tf("showInGraph")}
          aria-label={tf("showInGraph")}
          className="shrink-0 self-center border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
