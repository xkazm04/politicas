"use client";

/*
 * Pás provozu grafu (varianta Konzole) — telemetrie vedle přístroje.
 * Připnutý uzel v grafu ho profiltruje: nesouvisející řádky ztmavnou, ale
 * NEZMIZÍ. Zmizení by z filtru udělalo tvrzení („nic jiného se nestalo"),
 * ztmavnutí je jen zaostření.
 */

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { FeedEvent } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import FeedRow from "./FeedRow";

export default function GraphFeedPanel({
  events,
  nodesByEvent,
  pinned,
  pinnedLabel,
  onPick,
  onClear,
}: {
  events: FeedEvent[];
  /** event.id → uzly, které řádek v grafu rozsvítí. */
  nodesByEvent: Map<string, string[]>;
  pinned: string | null;
  pinnedLabel: string | null;
  onPick: (nodeId: string) => void;
  onClear: () => void;
}) {
  const tcom = useTranslations("common");
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();

  const matches = pinned
    ? events.filter((e) => (nodesByEvent.get(e.id) ?? []).includes(pinned))
    : events;

  return (
    <div className="flex h-full flex-col border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{tf("title")}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
          {tf("matchCount", { count: f.int(matches.length), total: f.int(events.length) })}
        </span>
      </div>

      {pinned && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-strong px-4 py-2">
          <span className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {tf("filteredTo", { label: pinnedLabel ?? pinned })}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
          >
            <X className="h-3.5 w-3.5" /> {tf("showAll")}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {matches.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-steel">
            {tf("empty")}
          </p>
        )}
        {events.map((e) => {
          const nodeIds = nodesByEvent.get(e.id) ?? [];
          return (
            <FeedRow
              key={e.id}
              event={e}
              nodeIds={nodeIds}
              dim={pinned !== null && !nodeIds.includes(pinned)}
              showGlobalMark={pinned !== null}
              onPick={onPick}
            />
          );
        })}
      </div>

      <div className="border-t-2 border-ink px-4 py-2.5">
        <SourceNote>{tcom("ingestion")}</SourceNote>
      </div>
    </div>
  );
}
