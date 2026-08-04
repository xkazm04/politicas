"use client";

/*
 * Pás provozu grafu (varianta Konzole) — telemetrie vedle přístroje.
 * VYBRANÝ uzel v grafu ho profiltruje: nesouvisející řádky ztmavnou, ale
 * NEZMIZÍ. Zmizení by z filtru udělalo tvrzení („nic jiného se nestalo"),
 * ztmavnutí je jen zaostření.
 *
 * Panel čte VÝBĚR, ne náhled — hover nad uzlem seznamem nehýbe (viz
 * ../useGraphSelection.ts). Ztmavení je vizuální signál, takže ho ztmavený
 * řádek doprovodí i neviditelnou větou pro odečítačku, a banner filtru je
 * živá oblast: změna výběru se ohlásí, ne jen překreslí.
 */

import { useTranslations } from "next-intl";
import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import type { FeedEvent } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import FeedRow from "./FeedRow";
import FactRow from "./FactRow";
import type { DatedFactLedger } from "../datedFacts";

export default function GraphFeedPanel({
  events,
  nodesByEvent,
  primaryByEvent,
  ledger,
  selected,
  selectedLabel,
  onPick,
  onClear,
}: {
  events: FeedEvent[];
  /** event.id → uzly, které řádek v grafu rozsvítí. */
  nodesByEvent: Map<string, string[]>;
  /** event.id → uzel, který zaměřovač připne (podmět řádku), nebo null. */
  primaryByEvent: Map<string, string | null>;
  /** Kniha REÁLNÝCH datovaných faktů. Když je, vzorkový provoz se nekreslí —
   *  mock zůstává jen jako označený fallback, když graf není k dispozici. */
  ledger?: DatedFactLedger | null;
  /** Vybraný uzel — týž stav, jaký drží plátno a URL. */
  selected: string | null;
  selectedLabel: string | null;
  onPick: (nodeId: string) => void;
  onClear: () => void;
}) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();

  const facts = ledger?.facts ?? null;
  const total = facts ? facts.length : events.length;
  const matchCount = facts
    ? selected
      ? facts.filter((x) => x.refs.includes(selected)).length
      : facts.length
    : selected
      ? events.filter((e) => (nodesByEvent.get(e.id) ?? []).includes(selected)).length
      : events.length;

  const matches = selected
    ? events.filter((e) => (nodesByEvent.get(e.id) ?? []).includes(selected))
    : events;
  const filterLabel = selected ? (selectedLabel ?? selected) : null;

  return (
    <div className="flex h-full flex-col border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{tf("title")}</span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
            {tf("matchCount", { count: f.int(matchCount), total: f.int(total) })}
          </span>
          {/* Panel je OKNO — 12 faktů o entitách jednoho výřezu. Celý datovaný
              proud republiky vede deník; bez tohohle odkazu se z okna stal
              slepý konec. Vzorkový provoz odkaz nedostane: vedl by z vymyšlených
              událostí na reálnou stránku. */}
          {ledger && (
            <Link
              href="/denik"
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
            >
              {tf("denikAll")} <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </span>
      </div>

      {/* Živá oblast: sdělením není jen jméno filtru, ale hlavně KOLIK řádků mu
          vyhovuje — bez toho by nevidoucí čtenář filtr zapnul naslepo. */}
      {selected && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-strong px-4 py-2"
        >
          <span className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {tf("filteredTo", { label: filterLabel ?? "" })}{" "}
            <span className="sr-only">
              {tf("matchCount", { count: f.int(matchCount), total: f.int(total) })}
            </span>
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
        {/* Only the genuinely-no-data case (no selection, no events at all) gets
            the standalone empty message — "fading, never disappearing" means a
            selected node with zero matching events still renders the full
            dimmed list below, never both the "no matches" banner AND every
            row at once (a real, reachable case: some graph nodes, like a vote
            with no backing feed event, have no matches by design). */}
        {/* Reálná kniha: prázdný stav je legitimní odpověď — v okně prostě není
            žádný datovaný fakt o entitách výřezu. Neplní se vzorkem. */}
        {facts && facts.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-steel">
            {tf("emptyReal")}
          </p>
        )}
        {facts?.map((fact) => (
          <FactRow
            key={fact.id}
            fact={fact}
            dim={selected !== null && !fact.refs.includes(selected)}
            filterLabel={filterLabel}
            onPick={onPick}
          />
        ))}
        {!facts && !selected && matches.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-steel">
            {tf("empty")}
          </p>
        )}
        {!facts && events.map((e) => {
          const nodeIds = nodesByEvent.get(e.id) ?? [];
          // Global rows (no node refs at all — aggregate events like a
          // quarterly recompute) are tagged "always relevant" via
          // showGlobalMark and must never be dimmed identically to a
          // genuinely filtered-out row; nodeIds.length > 0 carves them out.
          const dim = selected !== null && nodeIds.length > 0 && !nodeIds.includes(selected);
          return (
            <FeedRow
              key={e.id}
              event={e}
              nodeIds={nodeIds}
              primaryNodeId={primaryByEvent.get(e.id) ?? null}
              dim={dim}
              showGlobalMark={selected !== null}
              filterLabel={filterLabel}
              onPick={onPick}
            />
          );
        })}
      </div>

      <div className="border-t-2 border-ink px-4 py-2.5">
        {ledger ? (
          <>
            <SourceNote>{tf("realSource", { rows: f.int(ledger.considered) })}</SourceNote>
            <SourceNote className="mt-1">{tf("denikNote")}</SourceNote>
            {/* Nemožné datum se nikdy neopravuje ani mlčky nezahazuje — kniha
                přizná, kolik faktů kvůli němu vypadlo (vada ingesce, ne fakt). */}
            {ledger.droppedImplausible > 0 && (
              <SourceNote tone="signal" className="mt-1">
                {tf("droppedImplausible", { count: f.int(ledger.droppedImplausible) })}
              </SourceNote>
            )}
          </>
        ) : (
          <SourceNote>{tf("mockSource")}</SourceNote>
        )}
      </div>
    </div>
  );
}
