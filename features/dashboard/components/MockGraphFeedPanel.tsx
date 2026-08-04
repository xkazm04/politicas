"use client";

/*
 * VZORKOVÝ pás provozu — OZNAČENÝ fallback, když znalostní graf není k
 * dispozici. Reálná kniha datovaných faktů se sází v ./GraphFeedPanel.tsx.
 *
 * Vlastní modul má dva důvody a oba jsou měřitelné: jeho renderer (`FeedRow`)
 * i jeho pravidlo relevance (`../feedRelevance.ts`) se do balíku dostanou až
 * když je potřeba, a mapy `event.id → uzly` se počítají jen tehdy, když se
 * vzorek opravdu kreslí. Dřív obojí jelo i na šťastné cestě, kde se z nich
 * nevykreslil ani jeden pixel.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { EVENTS } from "@/lib/civic/data";
import { nodesForRefs, type StateGraph } from "@/lib/civic/stateGraph";
import SourceNote from "@/features/shared/components/SourceNote";
import FeedPanelShell from "./FeedPanelShell";
import FeedRow from "./FeedRow";
import { primaryNodeForEvent } from "../feedRelevance";

export default function MockGraphFeedPanel({
  graph,
  selected,
  selectedLabel,
  onPick,
  onClear,
}: {
  /** Vzorkový graf, který plátno zrovna kreslí — filtr i zaměřovač se počítají
   *  proti němu, takže řádek nikdy nesvítí uzel mimo obrázek. */
  graph: StateGraph;
  selected: string | null;
  selectedLabel: string | null;
  onPick: (nodeId: string) => void;
  onClear: () => void;
}) {
  const tf = useTranslations("dashboard.feed");

  // event.id → uzly, které řádek rozsvítí. Počítá se jednou; počet i řádky pak
  // čtou tutéž mapu, takže se filtr nemůže rozejít s obrázkem.
  const nodesByEvent = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, nodesForRefs(e.refs, graph)])),
    [graph],
  );
  // event.id → uzel, o KTERÉM řádek je (pravidlo relevance, ne pořadí v poli).
  const primaryByEvent = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, primaryNodeForEvent(e, graph)])),
    [graph],
  );

  const matchCount = selected
    ? EVENTS.filter((e) => (nodesByEvent.get(e.id) ?? []).includes(selected)).length
    : EVENTS.length;
  const filterLabel = selected ? (selectedLabel ?? selected) : null;

  return (
    <FeedPanelShell
      matchCount={matchCount}
      total={EVENTS.length}
      selected={selected}
      filterLabel={filterLabel}
      onClear={onClear}
      footer={<SourceNote>{tf("mockSource")}</SourceNote>}
    >
      {!selected && EVENTS.length === 0 && (
        <p className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-steel">
          {tf("empty")}
        </p>
      )}
      {EVENTS.map((e) => {
        const nodeIds = nodesByEvent.get(e.id) ?? [];
        // Agregátní řádky bez uzlů (např. čtvrtletní přepočet) jsou označené
        // jako „vždy relevantní" a nesmí ztmavnout stejně jako řádek, který
        // filtru opravdu nevyhovuje; `nodeIds.length > 0` je vyřazuje.
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
    </FeedPanelShell>
  );
}
