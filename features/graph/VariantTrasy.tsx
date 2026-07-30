"use client";

/*
 * VARIANTA C — „Trasy" (kolo 3).
 *
 * Mentální model: GRAF JAKO ODPOVĚĎ, NE NÁBYTEK. Masa dat se ke čtenáři
 * nedostane tím, že ji vysypeme na plátno — ale tím, že z ní PŘEDEM
 * spočítáme otázky, kvůli kterým platforma existuje: kudy tečou peníze,
 * kdo přepisuje zákony, kdo daroval stranám, kde se potkává výbor s byznysem.
 *
 * Trasa je výřez grafu vysázený do SLOUPCŮ jako účetní kniha: role = sloupec
 * (výbor | poslanec | firma), pořadí = peníze. Žádná silová náhoda — argument
 * má mít pevnou sazbu. Každá trasa cituje své datasety a částky jsou
 * spočítané z hran (supplies váhy + props firem), nic není ilustrace.
 *
 * Tohle je varianta pro „co politici dělají dobře a špatně": vede čtenáře
 * rovnou k závěrům a graf mu dává možnost si každý krok rozkliknout a ověřit.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Route } from "lucide-react";
import { layeredLayout, type LayeredItem } from "@/lib/kg/layout";
import { compactCzk } from "@/features/money/moneyTypes";
import SourceNote from "@/features/shared/components/SourceNote";
import { useForensicMode } from "@/features/shared/forensic/ForensicProvider";
import { useFormat } from "@/lib/i18n/useFormat";
import CiteView from "./components/CiteView";
import { ForensicHoverCard } from "./components/ForensicOverlays";
import GraphStage, { type StageCaption } from "./components/GraphStage";
import { InspectorDrawer, LegendOverlay, StatChip } from "./components/StageOverlays";
import { hoverCardModel } from "./forensicView";
import { trailsAction } from "./graphActions";
import { useNodeSelection } from "./useNodeSelection";
import type { GraphViewState } from "./permalink";
import type { GraphSeed, Trail } from "./graphTypes";

export default function VariantTrasy({ seed }: { seed: GraphSeed | null }) {
  const t = useTranslations("graph");
  const tt = useTranslations("graph.trasy");
  const f = useFormat();
  const locale = useLocale();
  const [trails, setTrails] = useState<Trail[] | null | "loading">("loading");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const selection = useNodeSelection();
  void seed;

  // Forenzní režim: trasa je VYŽÁDANÝ důkaz, takže se nefiltruje (vynechaný
  // krok by byl lež) — režim tu přidává provenience na ploše a kartu najetí;
  // čekající kroky zůstávají čárkované a štítek je přizná (batch 7D).
  const forensic = useForensicMode();
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    void trailsAction().then((ts) => {
      setTrails(ts);
      if (ts && ts.length > 0) setActiveKey(ts[0].key);
    });
  }, []);

  const active = useMemo(
    () => (trails !== "loading" && trails ? (trails.find((x) => x.key === activeKey) ?? null) : null),
    [trails, activeKey],
  );

  // Citovatelný stav: vybraný uzel má přednost před trasou — čtenář ukazuje
  // na konkrétní tvrzení, ne na celý výřez.
  const citeState = useMemo<GraphViewState | null>(() => {
    if (selection.selectedId) return { kind: "uzel", variant: "trasy", node: selection.selectedId };
    if (active) return { kind: "trasa", variant: "trasy", trail: active.key };
    return null;
  }, [selection.selectedId, active]);

  const scene = useMemo(() => {
    if (!active) return null;
    const items: LayeredItem[] = active.nodes.map((n) => ({ id: n.id, column: n.column, order: n.order }));
    const { positions, world, columnX } = layeredLayout(items, {
      rowGap: 72,
      colGap: Math.max(440, 1500 / Math.max(active.columns.length, 1)),
    });
    const captions: StageCaption[] = active.columns.map((kind, i) => ({
      x: columnX[i] ?? 0,
      y: 44,
      text: t(`kinds.${kind}`),
    }));
    const nodes = active.nodes.map((n) => ({
      ...n,
      sub: n.moneyCzk !== undefined ? compactCzk(n.moneyCzk, locale) : undefined,
    }));
    return { nodes, positions, world, captions };
  }, [active, locale, t]);

  const hoverModel = useMemo(() => {
    if (!forensic || !hoverId || !scene || !active) return null;
    const n = scene.nodes.find((x) => x.id === hoverId);
    return n ? hoverCardModel(n, active.edges) : null;
  }, [forensic, hoverId, scene, active]);

  return (
    <div className="absolute inset-0">
      {scene && active ? (
        <GraphStage
          nodes={scene.nodes}
          edges={active.edges}
          positions={scene.positions}
          world={scene.world}
          selectedId={selection.selectedId}
          onSelect={selection.select}
          fitKey={active.key}
          relLabel={(rel) => t(`rels.${rel}`)}
          ariaLabel={t("canvasAria")}
          inlineProvenance={forensic}
          onHover={forensic ? setHoverId : undefined}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-steel">
            {trails === "loading" ? t("working") : tt("empty")}
          </p>
        </div>
      )}

      {/* Rejstřík tras — plovoucí karta vlevo; trasa je vstup, plátno důkaz. */}
      <div className="absolute bottom-16 left-3 top-3 z-20 flex w-[21rem] max-w-[85vw] flex-col border-2 border-ink bg-paper">
        <div className="flex items-center gap-2 border-b-2 border-ink px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest">
          <Route className="h-3.5 w-3.5 text-signal" />
          {tt("listLabel")}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {trails !== "loading" && trails?.map((trail) => {
            const on = trail.key === activeKey;
            return (
              <button
                key={trail.key}
                type="button"
                onClick={() => {
                  setActiveKey(trail.key);
                  selection.clear();
                }}
                aria-pressed={on}
                className={`block w-full border-b border-hairline px-3 py-3 text-left transition-colors ${
                  on ? "border-l-4 border-l-signal bg-paper-strong pl-2" : "hover:bg-paper-strong"
                }`}
              >
                <span className="block text-sm font-black uppercase leading-tight tracking-tight">
                  {tt(`trails.${trail.key}.title`)}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-steel">
                  {tt(`trails.${trail.key}.lead`)}
                </span>
                <span className="mt-1.5 flex items-baseline justify-between gap-2">
                  <SourceNote className="min-w-0 truncate !text-[10px]">
                    {tt(`trails.${trail.key}.source`)}
                  </SourceNote>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-cobalt">
                    {t("counts", { nodes: f.int(trail.nodes.length), edges: f.int(trail.edges.length) })}
                  </span>
                </span>
              </button>
            );
          })}
          {trails !== "loading" && (!trails || trails.length === 0) && (
            <p className="px-3 py-4 font-mono text-[11px] uppercase tracking-widest text-steel">{tt("empty")}</p>
          )}
        </div>
        {/* Trvalá citace — vybraný uzel bije trasu (čtenář ukazuje NA něj). */}
        {citeState && (
          <div className="border-t-2 border-ink">
            <CiteView state={citeState} />
          </div>
        )}
        <div className="border-t border-hairline px-3 py-2">
          <SourceNote>{tt("footnote")}</SourceNote>
        </div>
      </div>

      {active && (
        <StatChip>
          {t("counts", { nodes: f.int(active.nodes.length), edges: f.int(active.edges.length) })}
        </StatChip>
      )}
      <LegendOverlay footnote={tt("footnote")} />
      <InspectorDrawer selection={selection} />

      {/* Forenzní karta najetí — stavy kontroly bez klikání. */}
      {hoverModel && (
        <ForensicHoverCard
          model={hoverModel}
          relLabel={(rel) => t(`rels.${rel}`)}
          kindLabel={t(`kinds.${hoverModel.kind}`)}
        />
      )}
    </div>
  );
}
