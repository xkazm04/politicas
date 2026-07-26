"use client";

/*
 * VARIANTA A — „Mapa × Trasy" (kolo 4: fúze mapy s trasami).
 *
 * Mentální model: MAPA MĚSTA S VYZNAČENOU TRASOU. Celý graf zůstává vidět
 * jako krajina (silový layout důkazní vrstvy, smlouvy jako halo kolem
 * dodavatelů, sémantický zoom vynořuje jména). Trasa z varianty C tu není
 * samostatná stránka, ale ČOČKA: vyber „Peníze kolem poslanců" a mapa
 * ztlumí všechno ostatní, rozsvítí uzly a hrany trasy, přiletí na jejich
 * výřez a u firem ukáže částky. Kontext celku přitom nezmizí — vidíš, KDE
 * v krajině grafu trasa leží a co s ní sousedí. Vypnout čočku = zpátky
 * celá masa.
 *
 * Co drží z měření (graph-explorer-scale.md): co_votes_with se nekreslí,
 * velikost uzlu = důkazní stupeň, spoje firma→smlouva až od přiblížení.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Route } from "lucide-react";
import { compactCzk } from "@/features/money/moneyTypes";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import GraphStage, { edgeKey, type StageLens } from "./components/GraphStage";
import NodeSearch from "./components/NodeSearch";
import { InspectorDrawer, LegendOverlay, StatChip, TopLeft } from "./components/StageOverlays";
import { mapAction, trailsAction } from "./graphActions";
import { useNodeSelection } from "./useNodeSelection";
import type { GraphEdge, GraphNode, GraphSeed, MapData, Trail } from "./graphTypes";

export default function VariantMapa({ seed }: { seed: GraphSeed | null }) {
  // Mapa nabízí vstup hledáním a trasami; nabídnuté uzly ze seedu nepotřebuje.
  void seed;
  const t = useTranslations("graph");
  const tm = useTranslations("graph.mapa");
  const tt = useTranslations("graph.trasy");
  const f = useFormat();
  const locale = useLocale();
  const [data, setData] = useState<MapData | null | "loading">("loading");
  const [trails, setTrails] = useState<Trail[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const selection = useNodeSelection();

  useEffect(() => {
    // setState až v async callbacích; dvojí StrictMode fetch odstíní serverová cache.
    void mapAction().then((d) => setData(d));
    void trailsAction().then((ts) => setTrails(ts ?? []));
  }, []);

  const activeTrail = useMemo(() => trails.find((x) => x.key === activeKey) ?? null, [trails, activeKey]);

  // Čočka: uzly + hrany trasy. Hrany trasy pocházejí ze stejného grafu jako
  // hrany mapy, takže klíč src|rel|dst sedne 1:1.
  const lens = useMemo<StageLens | null>(() => {
    if (!activeTrail) return null;
    return {
      nodes: new Set(activeTrail.nodes.map((n) => n.id)),
      edges: new Set(activeTrail.edges.map(edgeKey)),
    };
  }, [activeTrail]);

  const moneyById = useMemo(() => {
    if (!activeTrail) return null;
    return new Map(
      activeTrail.nodes.filter((n) => n.moneyCzk !== undefined).map((n) => [n.id, n.moneyCzk as number]),
    );
  }, [activeTrail]);

  const { nodes, edges, positions } = useMemo(() => {
    if (data === "loading" || data === null)
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[], positions: new Map() };
    const nodes = data.nodes.map((n) => ({
      ...n,
      // Důkazní stupeň → velikost: kdo má hodně doložených vazeb, je vidět
      // zdálky. Smlouvy jsou drobné vždycky.
      size: n.kind === "contract" ? 2.6 : Math.min(24, 5 + Math.sqrt(n.degree) * 1.9),
      // Částky trasy jako druhý řádek popisku — jen pod aktivní čočkou.
      sub: moneyById?.has(n.id) ? compactCzk(moneyById.get(n.id)!, locale) : undefined,
    }));
    const edges = data.edges.map((e) => (e.rel === "supplies" ? { ...e, minK: 0.85 } : e));
    return { nodes, edges, positions: new Map(data.nodes.map((n) => [n.id, { x: n.x, y: n.y }])) };
  }, [data, moneyById, locale]);

  // Výřez trasy: obdélník přes její uzly na mapě — jeviště na něj přiletí.
  const fitBounds = useMemo(() => {
    if (!lens || data === "loading" || data === null) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of data.nodes) {
      if (!lens.nodes.has(n.id)) continue;
      if (n.x < x0) x0 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.x > x1) x1 = n.x;
      if (n.y > y1) y1 = n.y;
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }, [lens, data]);

  if (data === "loading") {
    return (
      <CenterNote>
        <p className="font-mono text-xs uppercase tracking-widest text-steel">{tm("building")}</p>
      </CenterNote>
    );
  }
  if (data === null) {
    return (
      <CenterNote>
        <p className="text-base leading-relaxed text-steel">{tm("unavailable")}</p>
      </CenterNote>
    );
  }

  return (
    <div className="absolute inset-0">
      <GraphStage
        nodes={nodes}
        edges={edges}
        positions={positions}
        world={data.world}
        selectedId={selection.selectedId}
        onSelect={selection.select}
        fitKey={activeTrail ? `mapa:${activeTrail.key}` : "mapa"}
        focusId={focusId}
        fitBounds={fitBounds}
        lens={lens}
        relLabel={(rel) => t(`rels.${rel}`)}
        ariaLabel={t("canvasAria")}
      />

      <TopLeft>
        <NodeSearch
          placeholder={t("search.placeholder")}
          onPick={(hit) => {
            selection.select(hit.id);
            setFocusId(hit.id);
          }}
        />

        {/* Trasy jako čočky nad mapou — jádro fúze A×C. */}
        {trails.length > 0 && (
          <div className="border-2 border-ink bg-paper">
            <div className="flex items-center gap-2 border-b-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest">
              <Route className="h-3.5 w-3.5 text-signal" />
              {tm("lensLabel")}
            </div>
            <div className="max-h-[38vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setActiveKey(null)}
                aria-pressed={activeKey === null}
                className={`block w-full border-b border-hairline px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  activeKey === null ? "bg-paper-strong font-bold" : "text-steel hover:bg-paper-strong"
                }`}
              >
                {tm("lensOff")}
              </button>
              {trails.map((trail) => {
                const on = trail.key === activeKey;
                return (
                  <button
                    key={trail.key}
                    type="button"
                    onClick={() => {
                      setActiveKey(on ? null : trail.key);
                      selection.clear();
                    }}
                    aria-pressed={on}
                    className={`block w-full border-b border-hairline px-3 py-2 text-left transition-colors ${
                      on ? "border-l-4 border-l-signal bg-paper-strong pl-2" : "hover:bg-paper-strong"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-black uppercase tracking-tight">
                        {tt(`trails.${trail.key}.title`)}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-cobalt">
                        {t("counts", { nodes: f.int(trail.nodes.length), edges: f.int(trail.edges.length) })}
                      </span>
                    </span>
                    {on && (
                      <>
                        <span className="mt-1 block text-[13px] leading-snug text-steel">
                          {tt(`trails.${trail.key}.lead`)}
                        </span>
                        <SourceNote className="mt-1 !text-[10px]">{tt(`trails.${trail.key}.source`)}</SourceNote>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <SourceNote className="border-2 border-ink bg-paper px-3 py-1.5">{tm("zoomHint")}</SourceNote>
      </TopLeft>

      <StatChip>
        {activeTrail
          ? t("counts", { nodes: f.int(activeTrail.nodes.length), edges: f.int(activeTrail.edges.length) })
          : tm("stat", { nodes: f.int(nodes.length), edges: f.int(edges.length) })}
      </StatChip>
      <LegendOverlay footnote={activeTrail ? tt("footnote") : tm("footnote")} />
      <InspectorDrawer selection={selection} />
    </div>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center px-6 text-center">{children}</div>;
}
