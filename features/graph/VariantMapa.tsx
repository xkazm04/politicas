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
 * SPOJ DVA BODY (batch 1, 2026-07-30): kurátorské trasy přestaly být stropem.
 * Čtenář vybere dva libovolné uzly a server spočítá nejkratší doložené cesty
 * (features/graph/trailPath.ts — pravidlo řazení se tiskne na výsledku).
 * Cesta se rozsvěcí krok za krokem toutéž čočkou, kterou používají trasy;
 * prefers-reduced-motion dostane statické zvýraznění bez sekvence. Kroky
 * jsou v panelu sázené jako účetní kniha a klik na řádek otevírá inspektor
 * s provenience — generovaná odpověď je stejně dohledatelná jako kurátorská.
 *
 * Co drží z měření (graph-explorer-scale.md): co_votes_with se nekreslí,
 * velikost uzlu = důkazní stupeň, spoje firma→smlouva až od přiblížení.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Route } from "lucide-react";
import { compactCzk } from "@/features/money/moneyTypes";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import GraphStage, { edgeKey, type StageLens } from "./components/GraphStage";
import NodeSearch from "./components/NodeSearch";
import TrailFinder from "./components/TrailFinder";
import { InspectorDrawer, LegendOverlay, StatChip, TopLeft } from "./components/StageOverlays";
import { mapAction, pathAction, trailsAction } from "./graphActions";
import { HUB_DEGREE, MAX_COST } from "./trailPath";
import { useNodeSelection } from "./useNodeSelection";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { GraphEdge, GraphNode, GraphSeed, MapData, PathQueryResult, SearchHit, Trail } from "./graphTypes";

/** Odpověď pro případ, kdy akce spadne dřív, než loader stihne odpovědět. */
const PATH_UNAVAILABLE: PathQueryResult = {
  status: "unavailable",
  from: null,
  to: null,
  paths: [],
  totalFound: 0,
  capped: false,
  maxCost: MAX_COST,
  hubDegree: HUB_DEGREE,
};

/** Interval rozsvěcení kroků cesty (bez reduced-motion). */
const REVEAL_STEP_MS = 380;

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
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Spoj dva body — stav dotazu ─────────────────────────────────────────
  const [pathFrom, setPathFrom] = useState<SearchHit | null>(null);
  const [pathTo, setPathTo] = useState<SearchHit | null>(null);
  const [pathResult, setPathResult] = useState<PathQueryResult | null | "loading">(null);
  const [pathIdx, setPathIdx] = useState(0);
  const pathReqRef = useRef(0);

  useEffect(() => {
    // setState až v async callbacích; dvojí StrictMode fetch odstíní serverová cache.
    void mapAction().then((d) => setData(d));
    void trailsAction().then((ts) => setTrails(ts ?? []));
  }, []);

  // Dotaz běží Z OBSLUHY UDÁLOSTI, ne z efektu (doktrína useNodeSelection);
  // počítadlo hlídá závod odpovědí při rychlém přepínání koncových bodů.
  const runPath = (from: SearchHit | null, to: SearchHit | null) => {
    setPathFrom(from);
    setPathTo(to);
    setPathIdx(0);
    const req = ++pathReqRef.current;
    if (!from || !to) {
      setPathResult(null);
      return;
    }
    setActiveKey(null); // čočka patří cestě — kurátorská trasa zhasne
    selection.clear();
    setPathResult("loading");
    void pathAction(from.id, to.id).then((r) => {
      if (pathReqRef.current !== req) return;
      setPathResult(r ?? PATH_UNAVAILABLE);
    });
  };

  const pathMode = pathFrom !== null || pathTo !== null;
  const activePath = useMemo(
    () =>
      pathResult !== null && pathResult !== "loading" && pathResult.status === "ok"
        ? (pathResult.paths[pathIdx] ?? pathResult.paths[0] ?? null)
        : null,
    [pathResult, pathIdx],
  );

  // ── Rozsvěcení kroků: klíč cesty resetuje čítač, interval ho zvedá. ─────
  const pathKey = activePath ? `${pathIdx}:${activePath.nodeIds.join(">")}` : "none";
  const [reveal, setReveal] = useState({ key: "none", n: 0 });
  if (reveal.key !== pathKey) {
    // Reset odvozeného stavu při změně cesty — vzor „state adjustment during
    // render", žádný setState v těle efektu.
    setReveal({ key: pathKey, n: 0 });
  }
  useEffect(() => {
    // reduced-motion: žádná sekvence — statické zvýraznění řeší revealedHops.
    if (!activePath || prefersReducedMotion) return;
    const total = activePath.hops;
    const iv = setInterval(() => {
      setReveal((r) => (r.key !== pathKey || r.n >= total ? r : { ...r, n: r.n + 1 }));
    }, REVEAL_STEP_MS);
    return () => clearInterval(iv);
  }, [pathKey, activePath, prefersReducedMotion]);
  const revealedHops = activePath ? (prefersReducedMotion ? activePath.hops : Math.min(reveal.n, activePath.hops)) : 0;

  const activeTrail = useMemo(() => trails.find((x) => x.key === activeKey) ?? null, [trails, activeKey]);

  // Čočka: rozsvícený úsek cesty (roste s revealedHops), jinak uzly + hrany
  // kurátorské trasy. Hrany obou pocházejí ze stejného grafu jako hrany mapy,
  // takže klíč src|rel|dst sedne 1:1.
  const lens = useMemo<StageLens | null>(() => {
    if (activePath) {
      return {
        nodes: new Set(activePath.nodeIds.slice(0, revealedHops + 1)),
        edges: new Set(activePath.edges.slice(0, revealedHops).map(edgeKey)),
      };
    }
    if (!activeTrail) return null;
    return {
      nodes: new Set(activeTrail.nodes.map((n) => n.id)),
      edges: new Set(activeTrail.edges.map(edgeKey)),
    };
  }, [activePath, revealedHops, activeTrail]);

  const moneyById = useMemo(() => {
    if (!activeTrail) return null;
    return new Map(
      activeTrail.nodes.filter((n) => n.moneyCzk !== undefined).map((n) => [n.id, n.moneyCzk as number]),
    );
  }, [activeTrail]);

  // Koncové body cesty nesou trvalý kroužek — čtenář vidí, CO spojil.
  const pathEnds = useMemo(() => {
    if (!activePath || activePath.nodeIds.length === 0) return null;
    return new Set([activePath.nodeIds[0], activePath.nodeIds[activePath.nodeIds.length - 1]]);
  }, [activePath]);

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
      mark: pathEnds?.has(n.id) || undefined,
    }));
    const edges = data.edges.map((e) => (e.rel === "supplies" ? { ...e, minK: 0.85 } : e));
    return { nodes, edges, positions: new Map(data.nodes.map((n) => [n.id, { x: n.x, y: n.y }])) };
  }, [data, moneyById, locale, pathEnds]);

  // Rám kamery: CELÁ cesta (ne jen rozsvícený úsek — kamera nesmí cukat),
  // jinak výřez kurátorské trasy.
  const frameIds = useMemo<ReadonlySet<string> | null>(() => {
    if (activePath) return new Set(activePath.nodeIds);
    if (activeTrail) return new Set(activeTrail.nodes.map((n) => n.id));
    return null;
  }, [activePath, activeTrail]);

  const fitBounds = useMemo(() => {
    if (!frameIds || data === "loading" || data === null) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of data.nodes) {
      if (!frameIds.has(n.id)) continue;
      if (n.x < x0) x0 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.x > x1) x1 = n.x;
      if (n.y > y1) y1 = n.y;
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }, [frameIds, data]);

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
        fitKey={activePath ? `mapa:path:${pathKey}` : activeTrail ? `mapa:${activeTrail.key}` : "mapa"}
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

        {/* Spoj dva body — libovolná dvojice uzlů, cesta jako čočka. */}
        <TrailFinder
          from={pathFrom}
          to={pathTo}
          result={pathResult}
          activeIdx={pathIdx}
          revealed={revealedHops}
          onPickFrom={(hit) => {
            if (hit.id === pathTo?.id) return; // stejný uzel dvakrát není otázka
            runPath(hit, pathTo);
          }}
          onPickTo={(hit) => {
            if (hit.id === pathFrom?.id) return;
            runPath(pathFrom, hit);
          }}
          onClearFrom={() => runPath(null, pathTo)}
          onClearTo={() => runPath(pathFrom, null)}
          onReset={() => runPath(null, null)}
          onPickPath={setPathIdx}
          onHopFocus={(id) => {
            selection.select(id);
            setFocusId(id);
          }}
        />

        {/* Trasy jako čočky nad mapou — jádro fúze A×C. Když čtenář spojuje
            vlastní dva body, kurátorský rejstřík ustoupí panelu cesty. */}
        {!pathMode && trails.length > 0 && (
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
        {!pathMode && (
          <SourceNote className="border-2 border-ink bg-paper px-3 py-1.5">{tm("zoomHint")}</SourceNote>
        )}
      </TopLeft>

      <StatChip>
        {activePath
          ? t("counts", { nodes: f.int(activePath.nodeIds.length), edges: f.int(activePath.hops) })
          : activeTrail
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
