"use client";

/*
 * Řádek provozu grafu — datum, tón, věta, citace. Sdílený oběma variantami,
 * aby „co se změnilo" znělo na obou plochách stejně.
 *
 * Text vede do spisu poslance (produkt), zaměřovač vpravo připne příslušný
 * uzel v grafu (kontext) — dvě různé akce, dva různé cíle, žádný z nich
 * schovaný pod klikem na celý řádek.
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Crosshair } from "lucide-react";
import type { FeedEvent } from "@/lib/civic/data";

const TONE_DOT: Record<FeedEvent["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
};

export default function FeedRow({
  event,
  nodeIds,
  dim = false,
  showGlobalMark = false,
  onPick,
}: {
  event: FeedEvent;
  /** Uzly, které řádek v grafu rozsvítí (prázdné = agregátní přepočet). */
  nodeIds: string[];
  dim?: boolean;
  /** Označit řádky bez uzlu — smysl to má jen při aktivním filtru. */
  showGlobalMark?: boolean;
  onPick?: (nodeId: string) => void;
}) {
  const tc = useTranslations("content");
  const tf = useTranslations("dashboard.feed");
  // A row with no mpId link and no crosshair (an aggregate event like a
  // quarterly recompute) does nothing on click — the hover highlight must not
  // claim otherwise, per this file's own "no action hidden under a full-row
  // click" doctrine, which cuts both ways: no false "this is clickable" signal
  // on rows that aren't.
  const isInteractive = Boolean(event.mpId) || (Boolean(onPick) && nodeIds.length > 0);

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5 transition-opacity sm:grid-cols-[5.5rem_auto_1fr_auto] ${
        isInteractive ? "hover:bg-paper-strong" : ""
      } ${dim ? "opacity-40" : ""}`}
    >
      <span className="col-span-3 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
        {tc(`events.${event.id}.ts`)}
      </span>
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[event.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        {event.mpId ? (
          <Link
            href={`/poslanec/${event.mpId}`}
            className="font-medium underline-offset-2 hover:text-signal hover:underline"
          >
            {tc(`events.${event.id}.text`)}
          </Link>
        ) : (
          tc(`events.${event.id}.text`)
        )}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{tc(`events.${event.id}.source`)}]
        </span>
        {showGlobalMark && nodeIds.length === 0 && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {tf("globalRow")}
          </span>
        )}
      </span>
      {onPick && nodeIds.length > 0 && (
        <button
          type="button"
          onClick={() => onPick(nodeIds[0])}
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
