"use client";

/*
 * Řádek vzorkového provozu grafu — datum, tón, věta, citace. Žije jen jako
 * OZNAČENÝ FALLBACK, když znalostní graf není k dispozici; reálná kniha
 * datovaných faktů se sází v FactRow.tsx.
 *
 * Zaměřovač vpravo připne uzel, o KTERÉM ŘÁDEK JE — podle pravidla vázaného na
 * druh události (../feedRelevance.ts), ne podle pořadí v poli. Když ten uzel
 * výřez nekreslí, řádek to řekne a zaměřovač nenabídne.
 */

import { useTranslations } from "next-intl";
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
  primaryNodeId,
  dim = false,
  showGlobalMark = false,
  filterLabel,
  onPick,
}: {
  event: FeedEvent;
  /** Uzly, které řádek v grafu rozsvítí (prázdné = agregátní přepočet). */
  nodeIds: string[];
  /** Uzel, který zaměřovač připne — podmět řádku podle pravidla relevance.
   *  `null` = podmět v tomhle výřezu nakreslený není. */
  primaryNodeId: string | null;
  dim?: boolean;
  /** Označit řádky bez uzlu — smysl to má jen při aktivním filtru. */
  showGlobalMark?: boolean;
  /** Jméno aktivního filtru — do neviditelné poznámky u ztmavených řádků. */
  filterLabel?: string | null;
  onPick?: (nodeId: string) => void;
}) {
  const tc = useTranslations("content");
  const tf = useTranslations("dashboard.feed");
  // event.mpId identifies an ILLUSTRATIVE (invented) MP, not a real
  // /poslanec/<pspId> — this feed is a mock activity stream (see
  // dashboard.mockBadge above the graph), so mpId is never rendered as a
  // link; a link would 404, the exact "5 dead links" defect this file used
  // to reproduce for the activity feed. Only the crosshair (jump to the mock
  // graph node) is genuinely actionable.
  const pickable = Boolean(onPick) && primaryNodeId !== null;

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
        {tc(`events.${event.id}.ts`)}
      </span>
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[event.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        {tc(`events.${event.id}.text`)}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{tc(`events.${event.id}.source`)}]
        </span>
        {showGlobalMark && nodeIds.length === 0 && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {tf("globalRow")}
          </span>
        )}
        {/* Řádek MÁ uzly, ale ten, o kterém je, mezi nimi není — místo tichého
            připnutí něčeho jiného se to napíše. */}
        {onPick && nodeIds.length > 0 && primaryNodeId === null && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {tf("subjectOffSlice")}
          </span>
        )}
      </span>
      {pickable && (
        <button
          type="button"
          onClick={() => onPick!(primaryNodeId!)}
          title={tf("showInGraph")}
          aria-label={tf("showInGraphNamed", { subject: tc(`events.${event.id}.text`) })}
          className="shrink-0 self-center border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal focus-visible:border-cobalt focus-visible:text-cobalt"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
