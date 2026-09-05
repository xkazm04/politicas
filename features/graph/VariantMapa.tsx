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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Route } from "lucide-react";
import { compactCzk } from "@/features/money/moneyTypes";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { useForensicMode } from "@/features/shared/forensic/ForensicProvider";
import CiteView from "./components/CiteView";
import { ForensicHoverCard, ForensicStrip } from "./components/ForensicOverlays";
import GraphStage, { edgeKey, type StageLens } from "./components/GraphStage";
import { forensicEdges, hoverCardModel } from "./forensicView";
import NodeSearch from "./components/NodeSearch";
import TrailFinder from "./components/TrailFinder";
import { InspectorDrawer, LegendOverlay, StatChip, TopLeft } from "./components/StageOverlays";
import { mapAction, neighbourhoodAction, pathAction, trailsAction } from "./graphActions";
import { HUB_DEGREE, MAX_COST, PATH_RULE_REF } from "./trailPath";
import { EMPTY_GRAPH_PROVENANCE } from "@/lib/kg/graphProvenance";
import { useNodeSelection } from "./useNodeSelection";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { GraphViewState } from "./permalink";
import type {
  GraphEdge,
  GraphNode,
  GraphSeed,
  MapData,
  Neighbourhood,
  PathQueryResult,
  SearchHit,
  Trail,
} from "./graphTypes";

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
  // Nulou se tu netvrdí „žádné zamítnuté hrany nejsou" — tenhle tvar znamená
  // „hledání vůbec neproběhlo" (status: "unavailable"), a plocha sází výpadek,
  // ne počty.
  excludedRejected: 0,
  ruleRef: PATH_RULE_REF,
  provenance: EMPTY_GRAPH_PROVENANCE,
};

/** Interval rozsvěcení kroků cesty (bez reduced-motion). */
const REVEAL_STEP_MS = 380;

/**
 * ROZPOČET UZLŮ PŘEKRYVU — dokreslené okolí nesmí přerůst mapu.
 *
 * Zadavatel s tisíci hranami `procures` by z plátna udělal skvrnu a skvrna
 * neodpovídá na žádnou otázku. Rozpočet je otištěný a co se přes něj nevešlo,
 * se PŘIZNÁVÁ (StageOverlays), nikdy nemizí mlčky.
 */
const OVERLAY_NODE_BUDGET = 400;

/** Kolik kotev se smí dotáhnout automaticky kvůli jedné spočítané cestě. */
const AUTO_ANCHOR_BUDGET = 6;

const round2 = (v: number) => Math.round(v * 100) / 100;

export default function VariantMapa({
  seed,
  okoli = null,
}: {
  seed: GraphSeed | null;
  /** Uzel z `/graf?okoli=<id>` — okolí se dokreslí hned po otevření. */
  okoli?: string | null;
}) {
  // Mapa nabízí vstup hledáním a trasami; nabídnuté uzly ze seedu nepotřebuje.
  void seed;
  const t = useTranslations("graph");
  const tm = useTranslations("graph.mapa");
  const tt = useTranslations("graph.trasy");
  const f = useFormat();
  const locale = useLocale();
  const [data, setData] = useState<MapData | null | "loading">("loading");
  // null = trasy se nepřečetly (sklad neběží) — panel to řekne, místo aby zmizel.
  const [trails, setTrails] = useState<Trail[] | null>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const selection = useNodeSelection();
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Forenzní režim (?rezim=forenzni): výchozí pohled jen na ověřené hrany,
  // provenience na ploše, stavy kontroly bez klikání (batch 7D). ──────────
  const forensic = useForensicMode();
  const [showPending, setShowPending] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // ── Spoj dva body — stav dotazu ─────────────────────────────────────────
  const [pathFrom, setPathFrom] = useState<SearchHit | null>(null);
  const [pathTo, setPathTo] = useState<SearchHit | null>(null);
  const [pathResult, setPathResult] = useState<PathQueryResult | null | "loading">(null);
  const [pathIdx, setPathIdx] = useState(0);
  const pathReqRef = useRef(0);

  // ── Překryv okolí — vrstva, kterou mapa masy ZÁMĚRNĚ nekreslí ───────────
  //
  // 48 647 zakázek a 12 467 zakázkových firem je v indexu i v sousedství cest,
  // ale ne v `MapData`. Spočítaná cesta přes ně vést MŮŽE — a jeviště pak
  // rozsvítilo uzel, pro který nemá pozici, a jeho hrany mlčky zahodilo
  // (`if (!a || !b) continue`). Účetní kniha vypsala všechny kroky, plátno
  // nakreslilo podmnožinu a nikde nestálo kolik chybí. Tohle je ta chybějící
  // půlka: okolí se dotáhne na vyžádání a NEDOKRESLENÉ se spočítá.
  const [overlay, setOverlay] = useState<Neighbourhood[]>([]);
  const askedRef = useRef<Set<string>>(new Set());

  /** Dotáhni okolí kotvy (jednou za kotvu, i při dvojím StrictMode průchodu). */
  const expand = useCallback((id: string) => {
    if (askedRef.current.has(id)) return;
    askedRef.current.add(id);
    void neighbourhoodAction(id, null).then((nb) => {
      if (nb === null || nb.anchor === null) return;
      setOverlay((prev) => (prev.some((x) => x.anchor?.id === nb.anchor?.id) ? prev : [...prev, nb]));
    });
  }, []);

  useEffect(() => {
    // setState až v async callbacích; dvojí StrictMode fetch odstíní serverová cache.
    void mapAction().then((d) => setData(d));
    void trailsAction().then((ts) => setTrails(ts));
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

  const activeTrail = useMemo(() => trails?.find((x) => x.key === activeKey) ?? null, [trails, activeKey]);

  // Citovatelný stav pohledu — priorita kopíruje čočku: spočítaná cesta bije
  // kurátorskou trasu, ta bije pouhý výběr uzlu. Nic citovatelného = žádná
  // afordance (citace prázdného plátna není tvrzení).
  const citeState = useMemo<GraphViewState | null>(() => {
    if (activePath && pathFrom && pathTo) {
      return { kind: "cesta", variant: "mapa", from: pathFrom.id, to: pathTo.id, path: pathIdx };
    }
    if (activeTrail) return { kind: "trasa", variant: "mapa", trail: activeTrail.key };
    if (selection.selectedId) return { kind: "uzel", variant: "mapa", node: selection.selectedId };
    return null;
  }, [activePath, pathFrom, pathTo, pathIdx, activeTrail, selection.selectedId]);

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

  /*
   * PŘEKRYV: pozice, uzly a hrany dokresleného okolí.
   *
   * Kotvou překryvu je uzel, který pozici NA MAPĚ má — okolí se kolem ní
   * posadí přičtením relativních souřadnic (loader je spočítal na prstenci a
   * ZAOKROUHLIL na 2 desetinná místa; zaokrouhluje se i součet, aby se server
   * a klient nerozešly na float driftu). Jedna úroveň schválně: okolí okolí by
   * záviselo na pořadí a rozpočet uzlů by přestal být rozpočtem.
   */
  const overlayLayer = useMemo(() => {
    const pos = new Map(positions);
    const extra: GraphNode[] = [];
    let budgetDropped = 0;
    for (const nb of overlay) {
      const anchorId = nb.anchor?.id;
      const at = anchorId ? pos.get(anchorId) : undefined;
      if (!at) continue; // kotva sama není na mapě — o úroveň dál se nejde
      for (const n of nb.nodes) {
        if (pos.has(n.id)) continue; // uzel mapy si drží svou pozici
        if (extra.length >= OVERLAY_NODE_BUDGET) {
          budgetDropped++;
          continue;
        }
        pos.set(n.id, { x: round2(at.x + n.x), y: round2(at.y + n.y) });
        extra.push({
          id: n.id,
          kind: n.kind,
          label: n.label,
          degree: n.degree,
          size: Math.min(18, 4 + Math.sqrt(n.degree) * 1.6),
        });
      }
    }
    // Hrana se kreslí, jen když MÁ oba konce umístěné — hrana do prázdna je
    // ta samá tichá lež, jen z druhé strany.
    const extraEdges: GraphEdge[] = [];
    const seen = new Set<string>();
    for (const nb of overlay) {
      for (const e of nb.edges) {
        const key = edgeKey(e);
        if (seen.has(key)) continue;
        if (!pos.has(e.src) || !pos.has(e.dst)) continue;
        seen.add(key);
        extraEdges.push(e);
      }
    }
    return { positions: pos, nodes: extra, edges: extraEdges, budgetDropped };
  }, [overlay, positions]);

  /*
   * KOLIK KROKŮ VYŽÁDANÉ ODPOVĚDI PLÁTNO NEUMÍ NAKRESLIT.
   *
   * Tohle je to číslo, které do 2026-09-04 neexistovalo: účetní kniha vypsala
   * tři kroky, jeviště nakreslilo jeden a rozdíl nikde nestál. Počítá se PO
   * překryvu — dokreslené kroky už chybějící nejsou.
   */
  const offMapNodes = useMemo(() => {
    if (!activePath) return [] as string[];
    return activePath.nodeIds.filter((id) => !overlayLayer.positions.has(id));
  }, [activePath, overlayLayer]);

  /*
   * Dotažení okolí PRO CESTU: uzel mimo mapu dostane pozici z okolí svého
   * SOUSEDA na cestě, který na mapě je. Kotev se dotahuje jen několik
   * (AUTO_ANCHOR_BUDGET) — cesta má nejvýš pár kroků a stovky dotazů by z
   * jednoho kliknutí udělaly bouři.
   */
  useEffect(() => {
    if (!activePath) return;
    const placed = positions;
    let asked = 0;
    for (const [i, id] of activePath.nodeIds.entries()) {
      if (placed.has(id)) continue;
      for (const nb of [activePath.nodeIds[i - 1], activePath.nodeIds[i + 1]]) {
        if (nb && placed.has(nb) && asked < AUTO_ANCHOR_BUDGET) {
          asked++;
          expand(nb);
        }
      }
    }
  }, [activePath, positions, expand]);

  /** Vstup z jiné plochy: `/graf?okoli=<id>` dokreslí okolí hned. */
  useEffect(() => {
    if (okoli) expand(okoli);
  }, [okoli, expand]);

  // Hrany vyžádané čočky se ve forenzním filtru drží vždy — vyžádaná
  // odpověď s vynechanými kroky by byla lež (forensicView.ts).
  const lensKeep = useMemo(() => {
    const keep = new Set<string>();
    if (activePath) for (const e of activePath.edges) keep.add(edgeKey(e));
    if (activeTrail) for (const e of activeTrail.edges) keep.add(edgeKey(e));
    return keep;
  }, [activePath, activeTrail]);

  const forensicFilter = useMemo(
    () => (forensic ? forensicEdges(edges, lensKeep) : null),
    [forensic, edges, lensKeep],
  );
  const stageEdges = forensicFilter && !showPending ? forensicFilter.edges : edges;

  // Mapa + dokreslené okolí jdou na jeviště jako JEDEN seznam: překryv není
  // druhá geometrie, jen další uzly v témže světě (týž toWorld/toScreen).
  const stageNodes = useMemo(
    () => (overlayLayer.nodes.length === 0 ? nodes : [...nodes, ...overlayLayer.nodes]),
    [nodes, overlayLayer],
  );
  const overlayStageEdges = useMemo(
    () =>
      forensic && !showPending ? forensicEdges(overlayLayer.edges, lensKeep).edges : overlayLayer.edges,
    [forensic, showPending, overlayLayer, lensKeep],
  );
  const stageAllEdges = useMemo(
    () => (overlayStageEdges.length === 0 ? stageEdges : [...stageEdges, ...overlayStageEdges]),
    [stageEdges, overlayStageEdges],
  );

  // Karta najetí čte NEfiltrovaný seznam — říká pravdu o stavu záznamu,
  // ne o tom, co je zrovna vidět.
  const hoverModel = useMemo(() => {
    if (!forensic || !hoverId) return null;
    const n = nodes.find((x) => x.id === hoverId);
    return n ? hoverCardModel(n, edges) : null;
  }, [forensic, hoverId, nodes, edges]);

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
        nodes={stageNodes}
        edges={stageAllEdges}
        positions={overlayLayer.positions}
        world={data.world}
        selectedId={selection.selectedId}
        onSelect={selection.select}
        fitKey={activePath ? `mapa:path:${pathKey}` : activeTrail ? `mapa:${activeTrail.key}` : "mapa"}
        focusId={focusId}
        fitBounds={fitBounds}
        lens={lens}
        relLabel={(rel) => t(`rels.${rel}`)}
        ariaLabel={t("canvasAria")}
        inlineProvenance={forensic}
        onHover={forensic ? setHoverId : undefined}
      />

      <TopLeft>
        {forensicFilter && (
          <ForensicStrip
            hiddenPending={forensicFilter.hiddenPending}
            keptPending={forensicFilter.keptPending}
            hiddenRejected={forensicFilter.hiddenRejected}
            keptRejected={forensicFilter.keptRejected}
            showPending={showPending}
            onTogglePending={() => setShowPending((v) => !v)}
          />
        )}
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

        {/* Trvalá citace pohledu — spočítaná cesta, trasa i uzel jsou citace. */}
        {citeState && <CiteView state={citeState} />}

        {/* Trasy jako čočky nad mapou — jádro fúze A×C. Když čtenář spojuje
            vlastní dva body, kurátorský rejstřík ustoupí panelu cesty. */}
        {!pathMode && trails === null && (
          <div className="border-2 border-signal bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-signal">
            {tt("unavailable")}
          </div>
        )}
        {!pathMode && trails !== null && trails.length > 0 && (
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
                        <SourceNote className="mt-1">{tt(`trails.${trail.key}.source`)}</SourceNote>
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

      {/*
        NEDOKRESLENÉ SE PŘIZNÁVÁ. „Vyžádaná odpověď s vynechanými kroky je lež"
        platila v účetní knize a neplatila na plátně — tohle je ta věta, která
        chyběla. Rozpočet uzlů překryvu si přiznává svůj vlastní řez zvlášť.
      */}
      {(offMapNodes.length > 0 || overlayLayer.budgetDropped > 0) && (
        <div className="absolute bottom-3 left-3 z-20 max-w-[24rem] border-2 border-signal bg-paper px-3 py-2">
          {offMapNodes.length > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-signal">
              {tm("offMap", { n: f.int(offMapNodes.length) })}
            </p>
          )}
          {overlayLayer.budgetDropped > 0 && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
              {tm("overlayBudget", {
                n: f.int(overlayLayer.budgetDropped),
                budget: f.int(OVERLAY_NODE_BUDGET),
              })}
            </p>
          )}
          <SourceNote className="mt-1 normal-case">{tm("offMapSource")}</SourceNote>
        </div>
      )}

      <StatChip>
        {activePath
          ? t("counts", { nodes: f.int(activePath.nodeIds.length), edges: f.int(activePath.hops) })
          : activeTrail
            ? t("counts", { nodes: f.int(activeTrail.nodes.length), edges: f.int(activeTrail.edges.length) })
            : tm("stat", { nodes: f.int(nodes.length), edges: f.int(edges.length) })}
      </StatChip>
      <LegendOverlay footnote={activeTrail ? tt("footnote") : tm("footnote")} />
      <InspectorDrawer
        selection={selection}
        onExpand={expand}
        expandLabel={tm("expandLabel")}
      />

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

function CenterNote({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center px-6 text-center">{children}</div>;
}
