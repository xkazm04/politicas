"use client";

/*
 * Plátno přehledového grafu (varianta Konzole). Sloupcová sazba: osoby na
 * svislé ose vlevo, z nich vpravo nahoru peněžní pruh, vpravo dolů pruh
 * legislativy. Najetí rozsvítí bezprostřední okolí uzlu; kliknutí ho připne a
 * profiltruje vedlejší pás provozu — graf a provoz jsou dvě čtení jednoho
 * datasetu, ne dva widgety.
 *
 * Bez ambientní animace: přechody jsou gated hoverem, jedna vstupní prolnutí
 * dělá rodič. recharts se tu nepoužívá, takže neplatí past resize loopu.
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, Crosshair } from "lucide-react";
import { degreeOf, neighbourhood, type StateGraph } from "@/lib/civic/stateGraph";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import GraphGlyph from "./GraphGlyph";
import GraphLegend from "./GraphLegend";
import { partyChip, trunc, useGraphText } from "../graphText";

const VB_W = 1000;
const VB_H = 640;
const px = (x: number) => x * 10;
const py = (y: number) => y * 6.4;

export default function StateGraphCanvas({
  graph,
  hover,
  pinned,
  onHover,
  onPin,
}: {
  graph: StateGraph;
  hover: string | null;
  pinned: string | null;
  onHover: (id: string | null) => void;
  onPin: (id: string | null) => void;
}) {
  const tg = useTranslations("dashboard.graph");
  const f = useFormat();
  const text = useGraphText();

  const active = hover ?? pinned;
  const lit = active ? neighbourhood(active, graph.edges) : null;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const activeNode = active ? byId.get(active) : undefined;
  const activeText = activeNode ? text.node(activeNode) : null;
  const activeDegree = active ? degreeOf(active, graph.edges) : 0;

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
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-full w-full"
          role="img"
          aria-label={tg("ariaLabel")}
          onMouseLeave={() => onHover(null)}
        >
          {Array.from({ length: VB_W / 50 + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={VB_H} className="stroke-hairline" strokeWidth={0.5} />
          ))}
          {Array.from({ length: VB_H / 40 + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={VB_W} y2={i * 40} className="stroke-hairline" strokeWidth={0.5} />
          ))}

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
            const chip = n.kind === "person" ? partyChip(n.mpId) : undefined;
            return (
              <g
                key={n.id}
                transform={`translate(${px(n.x)} ${py(n.y)})`}
                role="button"
                tabIndex={0}
                aria-label={`${t.kind}: ${t.label}`}
                aria-pressed={pinned === n.id}
                onMouseEnter={() => onHover(n.id)}
                onFocus={() => onHover(n.id)}
                onBlur={() => onHover(null)}
                onClick={() => onPin(pinned === n.id ? null : n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onPin(pinned === n.id ? null : n.id);
                  }
                }}
                style={{ cursor: "pointer" }}
                className="outline-none"
              >
                <circle r={22} className="fill-transparent" />
                <GraphGlyph kind={n.kind} lit={on} focused={pinned === n.id} />
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
                  {trunc(t.sub, 26)}
                </text>
                {chip && <rect x={-3} y={34} width={6} height={6} fill={chip} />}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stavový řádek — identita vybraného uzlu, jeho stupeň a cesta dovnitř. */}
      <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {activeNode && activeText ? (
          <span className="min-w-0">
            <span className="font-bold text-signal">▸ {activeText.label}</span>{" "}
            <span className="text-steel">
              — {activeText.kind}
              {activeText.sub ? ` · ${trunc(activeText.sub, 44)}` : ""} ·{" "}
              {activeDegree > 0
                ? tg("edgesInRecord", { count: f.int(activeDegree) })
                : tg("noEdges")}
            </span>
          </span>
        ) : (
          <span className="text-steel">{tg("hint")}</span>
        )}
        {activeNode?.href && (
          <Link
            href={activeNode.href}
            className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {activeText?.kind} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="border-t border-hairline px-4 py-3">
        <GraphLegend />
        <SourceNote className="mt-2">{tg("source")}</SourceNote>
      </div>
    </div>
  );
}
