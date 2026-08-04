"use client";

/*
 * Plátno přehledového grafu (varianta Konzole). Sloupcová sazba: osoby na
 * svislé ose vlevo, z nich vpravo nahoru peněžní pruh, vpravo dolů pruh
 * legislativy.
 *
 * ── DVA STAVY, JEDNA SÉMANTIKA (viz ../useGraphSelection.ts) ────────────────
 *   VÝBĚR přichází zvenčí (`selected`), je v URL a profiltruje pás provozu.
 *     Drží ho signální kroužek u uzlu a stavový řádek ho pojmenuje.
 *   NÁHLED (`hover`) je LOKÁLNÍ stav tohohle plátna. Rozsvítí stopu uzlu a nic
 *     víc — nefiltruje, nepřepisuje výběr a stránka se o něm nedozví. Když
 *     zároveň něco vybraného je, stavový řádek pojmenuje OBOJÍ a označí, co je
 *     co, takže obrázek a seznam nikdy nepopisují jiný výběr mlčky.
 * Tím, že náhled nevystoupí nad plátno, nepřekresluje najetí myší grafy ani
 * řádky provozu (velin-hover-cost-freshness).
 *
 * Bez ambientní animace: přechody jsou gated hoverem, jedna vstupní prolnutí
 * dělá rodič. recharts se tu nepoužívá, takže neplatí past resize loopu.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, Crosshair, X } from "lucide-react";
import { degreeOf, neighbourhood, type StateGraph, type StateNodeKind } from "@/lib/civic/stateGraph";
import type { StateSliceRule } from "../stateSlice";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import FollowButton from "@/features/schranka/FollowButton";
import GraphGlyph from "./GraphGlyph";
import GraphLegend from "./GraphLegend";
import { denikEntityHref, sliceNodeEntityKey } from "../entityLinks";
import { partyChip, trunc, useGraphText } from "../graphText";

const VB_W = 1000;
const VB_H = 640;
const px = (x: number) => x * 10;
const py = (y: number) => y * 6.4;

export default function StateGraphCanvas({
  graph,
  rule,
  selected,
  onSelect,
}: {
  graph: StateGraph;
  /** Pravidlo výběru reálného výřezu; null = kreslí se vzorkový graf. Tvar
   *  `graph` se tím nemění — je to popiska obrázku, ne jiný renderer. */
  rule?: StateSliceRule | null;
  /** Vybraný uzel — jediný stav, který plátno sdílí se zbytkem plochy. */
  selected: string | null;
  /** Vybrat uzel (`null` = zrušit výběr). Týž uzel podruhé výběr zruší. */
  onSelect: (id: string | null) => void;
}) {
  const tg = useTranslations("dashboard.graph");
  const f = useFormat();
  const text = useGraphText();

  // Náhled a klávesový fokus — obojí lokální. Fokus se drží zvlášť od výběru,
  // protože indikátor fokusu MUSÍ ukazovat, kde je klávesnice, ne co je vybráno.
  const [hover, setHover] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const kinds = useMemo(
    () => [...new Set(graph.nodes.map((n) => n.kind))] as StateNodeKind[],
    [graph],
  );

  // Rozsvícená stopa: náhled má přednost před výběrem (prst je na obrázku),
  // ale výběr si nechává svůj kroužek, takže se pod náhledem neztratí.
  const traced = hover ?? selected;
  const lit = useMemo(
    () => (traced ? neighbourhood(traced, graph.edges) : null),
    [traced, graph],
  );

  const selectedNode = selected ? byId.get(selected) : undefined;
  const selectedText = selectedNode ? text.node(selectedNode) : null;
  // Veřejný klíč vybrané entity (deník + schránka), nebo null. Pravidlo bydlí
  // v ../entityLinks.ts, takže o něm platí test, ne jen naděje.
  const followKey = selected ? sliceNodeEntityKey(selected) : null;
  const selectedDegree = useMemo(
    () => (selected ? degreeOf(selected, graph.edges) : 0),
    [selected, graph],
  );
  const hoverNode = hover && hover !== selected ? byId.get(hover) : undefined;
  const hoverText = hoverNode ? text.node(hoverNode) : null;

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-steel">
        <span className="flex items-center gap-2 font-bold text-ink">
          <Crosshair className="h-3.5 w-3.5 text-signal" />
          {tg("badge")}
        </span>
        {/* Počet uzlů a hran je taky číslo — a bez citace vypadal jako údaj
            o znalostním grafu, přestože počítá jen to, co plátno kreslí. */}
        <span className="hidden shrink-0 items-baseline gap-2 md:inline-flex">
          <span>
            {tg("countLabel", { nodes: f.int(graph.nodes.length), edges: f.int(graph.edges.length) })}
          </span>
          <SourceNote className="normal-case tracking-wider">{tg("countSource")}</SourceNote>
        </span>
      </div>

      <div className="w-full overflow-hidden bg-paper" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
        {/* role="group", ne role="img": `img` je LISTOVÁ role — prvky uvnitř ní
            asistivní technologie nezpřístupní, takže sedmnáct tlačítek v ní
            fakticky neexistovalo. Escape ruší výběr z klávesnice. */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-full w-full"
          role="group"
          aria-label={tg("ariaLabel")}
          onMouseLeave={() => setHover(null)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape" && selected) onSelect(null);
          }}
        >
          {/* Prázdná plocha ruší výběr — dosud to uměl jen opakovaný klik na
              týž uzel, což nikdo neuhodne. Klávesová cesta k témuž je Escape
              výš a tlačítko „zrušit výběr" ve stavovém řádku níž, takže tenhle
              obdélník není jediná cesta a nemusí být fokusovatelný. */}
          <rect
            x={0}
            y={0}
            width={VB_W}
            height={VB_H}
            className="fill-transparent"
            onClick={() => onSelect(null)}
          />
          {GRID}

          {/* Pruhy plátna — kam se která polovina grafu dívá. */}
          <text
            x={VB_W - 8}
            y={26}
            textAnchor="end"
            fontSize={13}
            fontFamily="var(--font-plex)"
            fontWeight={700}
            letterSpacing="0.18em"
            className="fill-steel uppercase"
          >
            {tg("bandMoney")}
          </text>
          <text
            x={VB_W - 8}
            y={388}
            textAnchor="end"
            fontSize={13}
            fontFamily="var(--font-plex)"
            fontWeight={700}
            letterSpacing="0.18em"
            className="fill-steel uppercase"
          >
            {tg("bandLaw")}
          </text>

          {graph.edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const on = lit !== null && lit.has(e.from) && lit.has(e.to);
            return (
              <g key={`${e.from}-${e.to}-${e.rel}`}>
                <line
                  x1={px(a.x)}
                  y1={py(a.y)}
                  x2={px(b.x)}
                  y2={py(b.y)}
                  className={`transition-[stroke,stroke-width] duration-150 ${on ? "stroke-signal" : "stroke-steel"}`}
                  strokeOpacity={on ? 1 : lit ? 0.18 : 0.4}
                  strokeWidth={on ? 2.5 : 1.25}
                  strokeDasharray={e.verified ? undefined : "5 5"}
                />
                {on && (
                  <text
                    x={(px(a.x) + px(b.x)) / 2}
                    y={(py(a.y) + py(b.y)) / 2 - 7}
                    textAnchor="middle"
                    fontSize={12}
                    fontFamily="var(--font-plex)"
                    fontWeight={700}
                    className="fill-signal uppercase"
                  >
                    {trunc(text.edge(e), 24)}
                  </text>
                )}
              </g>
            );
          })}

          {graph.nodes.map((n) => {
            const on = lit === null || lit.has(n.id);
            const t = text.node(n);
            // Reálný uzel nese barvu klubu z dat; vzorkový si ji dohledá ve vzorku.
            const chip = n.kind === "person" ? (n.partyColor ?? partyChip(n.mpId)) : undefined;
            return (
              <g
                key={n.id}
                transform={`translate(${px(n.x)} ${py(n.y)})`}
                role="button"
                tabIndex={0}
                aria-label={`${t.kind}: ${t.label}`}
                aria-pressed={selected === n.id}
                onMouseEnter={() => setHover(n.id)}
                onFocus={() => {
                  setFocusedId(n.id);
                  setHover(n.id);
                }}
                onBlur={() => {
                  setFocusedId(null);
                  setHover(null);
                }}
                onClick={(ev) => {
                  // Bez toho by klik na uzel probublal na podkladový obdélník
                  // a výběr by se zrušil ve stejném okamžiku, kdy vznikl.
                  ev.stopPropagation();
                  onSelect(n.id);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onSelect(n.id);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <circle r={22} className="fill-transparent" />
                <GraphGlyph
                  kind={n.kind}
                  lit={on}
                  selected={selected === n.id}
                  focused={focusedId === n.id}
                />
                <text
                  y={-20}
                  textAnchor="middle"
                  fontSize={14}
                  fontFamily="var(--font-plex)"
                  fontWeight={700}
                  className={on ? "fill-ink" : "fill-steel"}
                >
                  {trunc(t.label, 22)}
                </text>
                <text
                  y={28}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-plex)"
                  className="fill-steel uppercase"
                >
                  {/* 34, ne 26: do podtitulu se u reálného výřezu vejde IČO
                      A stav „čeká na kontrolu" — a ten se ořezat nesmí, jinak
                      by neověřená vazba vypadala na obrázku jako fakt. */}
                  {trunc(t.sub, 34)}
                </text>
                {chip && <rect x={-3} y={34} width={6} height={6} fill={chip} />}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stavový řádek — identita VYBRANÉHO uzlu, jeho stupeň a cesta dovnitř.
          Náhled se přidává za něj a je označený jako náhled, aby se výběr a
          „co je zrovna pod myší" nedaly splést. */}
      <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {/* Živá oblast nese JEN výběr: náhled by při tažení myší po plátně
            odčítačku zahltil. Proto je náhledová část aria-hidden. */}
        <span className="min-w-0" role="status" aria-live="polite">
          {selectedNode && selectedText ? (
            <>
              <span className="text-steel">{tg("selectedLabel")} </span>
              <span className="font-bold text-signal">▸ {selectedText.label}</span>{" "}
              <span className="text-steel">
                — {selectedText.kind}
                {selectedText.sub ? ` · ${trunc(selectedText.sub, 44)}` : ""} ·{" "}
                {selectedDegree > 0
                  ? tg("edgesInRecord", { count: f.int(selectedDegree) })
                  : tg("noEdges")}
              </span>
            </>
          ) : (
            <span className="text-steel">{tg("hint")}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-4">
          {hoverText && (
            <span className="hidden text-steel sm:inline" aria-hidden>
              {tg("previewLabel")} {trunc(hoverText.label, 28)}
            </span>
          )}
          {selectedNode?.href && (
            <Link
              href={selectedNode.href}
              className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {selectedText?.kind} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {/* Deník a sledování TÉHOŽ uzlu. Nabízí se JEN nad reálným výřezem
              (`rule !== null`) a jen pro entitu, kterou nějaký proud opravdu
              adresuje — nad vzorkovým grafem by odkaz i odběr byly fabrikace
              (viz ../entityLinks.ts). */}
          {rule && followKey && (
            <>
              <Link
                href={denikEntityHref(followKey)}
                className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {tg("denikEntity")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <FollowButton
                entityKey={followKey}
                label={selectedText?.label ?? followKey}
                subject={selectedText?.label ?? followKey}
                compact
                iconOnly
              />
            </>
          )}
          {selected && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <X className="h-3.5 w-3.5" /> {tg("clearSelection")}
            </button>
          )}
        </span>
      </div>

      <div className="border-t border-hairline px-4 py-3">
        <GraphLegend kinds={kinds} />
        {/* Pravidlo výběru se vypisuje POD obrázkem, ne v dokumentaci: výřez,
            který neřekne, proč jsou v něm zrovna tihle lidé, je tvrzení. */}
        {rule ? (
          <>
            <SourceNote className="mt-2">{tg("realSource")}</SourceNote>
            <SourceNote className="mt-1">
              {tg("realRule", {
                seeds: f.int(rule.seeds),
                dual: f.int(rule.dualBandTotal),
                chamber: f.int(rule.chamberTotal),
                donors: f.int(rule.donorCompanies),
              })}
            </SourceNote>
            <SourceNote tone="signal" className="mt-1">
              {tg("realGate", { pending: f.int(rule.pendingTies), ties: f.int(rule.tiesDrawn) })}
            </SourceNote>
            <SourceNote className="mt-1">
              {rule.stewardOnlySeeds > 0
                ? tg("realAttributionWithSteward", { count: f.int(rule.stewardOnlySeeds) })
                : tg("realAttribution")}
            </SourceNote>
          </>
        ) : (
          <SourceNote className="mt-2">{tg("source")}</SourceNote>
        )}
      </div>
    </div>
  );
}

/** Rastr je statický — vytvořit ho jednou v modulu stojí míň než 38 `<line>`
 *  při každém překreslení plátna (velin-hover-cost-freshness). */
const GRID = (
  <g aria-hidden>
    {Array.from({ length: VB_W / 50 + 1 }, (_, i) => (
      <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={VB_H} className="stroke-hairline" strokeWidth={0.5} />
    ))}
    {Array.from({ length: VB_H / 40 + 1 }, (_, i) => (
      <line key={`h${i}`} x1={0} y1={i * 40} x2={VB_W} y2={i * 40} className="stroke-hairline" strokeWidth={0.5} />
    ))}
  </g>
);
