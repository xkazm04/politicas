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
 *
 * Který uzel to je, rozhoduje PRAVIDLO, ne pořadí v poli: připíná se PODMĚT
 * věty (`fact.subjectRef`, viz ../datedFacts.ts). Když podmět v tomhle výřezu
 * nakreslený není, řádek to řekne a zaměřovač nenabídne — dosazená náhrada by
 * připnula entitu, o které řádek není.
 */

import { useLocale, useTranslations } from "next-intl";
import { Crosshair, ScrollText, Stamp } from "lucide-react";
import Link from "next/link";
import { useFormat } from "@/lib/i18n/useFormat";
import { compactCzk } from "@/features/money/moneyTypes";
import type { DatedFact } from "../datedFacts";
import { denikFactHref, sliceNodeEntityKey } from "../entityLinks";
import { factExhibitId } from "../exhibit";

const TONE_DOT: Record<DatedFact["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
};

function FactRow({
  fact,
  dim = false,
  filterLabel,
  onPick,
}: {
  fact: DatedFact;
  dim?: boolean;
  /** Jméno aktivního filtru — do neviditelné poznámky u ztmavených řádků.
   *  Ztmavení je čistě vizuální signál; bez téhle věty odečítačka obrazovky
   *  o filtru vůbec neví a čte ztmavený řádek jako každý jiný. */
  filterLabel?: string | null;
  onPick?: (nodeId: string) => void;
}) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();
  const locale = useLocale();
  const pickable = onPick && fact.subjectRef !== null;

  // Deník TÉHOŽ subjektu. Velín ukazuje 12 faktů o ~17 entitách; deník je celý
  // proud té jedné entity a je to TÁŽ veřejná adresa, kterou odebírá schránka
  // (`?entita=`). Klíč se odvozuje pravidlem (../entityLinks.ts), a když ho
  // subjekt nemá — nebo řádek jeho uzel nekreslí — odkaz se prostě nenabídne.
  const denikKey = fact.subjectRef ? sliceNodeEntityKey(fact.subjectRef) : null;

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5 transition-opacity sm:grid-cols-[5.5rem_auto_1fr_auto] ${
        pickable ? "hover:bg-paper-strong" : ""
      } ${dim ? "opacity-40" : ""}`}
    >
      {dim && filterLabel && (
        <span className="sr-only">{tf("dimmedRow", { label: filterLabel })}</span>
      )}
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
        {/* Podmět řádku výřez nekreslí — řekne se to místo toho, aby zaměřovač
            mlčky připnul jinou entitu. */}
        {onPick && fact.subjectRef === null && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {tf("subjectOffSlice")}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 self-center">
        {pickable && (
          <button
            type="button"
            onClick={() => onPick(fact.subjectRef!)}
            title={tf("showInGraph")}
            // Pojmenovaný cíl, ne dvanáctkrát „ukázat v grafu": odečítačka jinak
            // přečte dvanáct nerozlišitelných tlačítek.
            aria-label={tf("showInGraphNamed", { subject: fact.subject })}
            className="border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        )}
        {denikKey && (
          <Link
            href={denikFactHref(denikKey, fact.date)}
            title={tf("denikLink")}
            aria-label={tf("denikLinkNamed", { subject: fact.subject })}
            className="border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
          >
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
        {/* Exponát: trvalá citovatelná adresa TOHOTO faktu (content-hash v URL,
            deterministické znovuodvození — viz ../exhibit.ts). */}
        <Link
          href={`/dashboard/exponat/${factExhibitId(fact)}`}
          title={tf("exhibitLink")}
          aria-label={tf("exhibitLinkNamed", { subject: fact.subject })}
          className="border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
        >
          <Stamp className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </span>
    </div>
  );
}

export default FactRow;
