"use client";

/**
 * Graf entit — OZNAČENÝ VZOROVÝ mock, když peněžní vrstva grafu není k dispozici.
 * Chování beze změny; oddělený modul jen proto, aby se `lib/civic/data.ts` (27 KB)
 * nedostávalo do balíčku, který reálná cesta nikdy nespustí — `MoneyGraph` ho nahrává
 * přes `next/dynamic`, takže fallback dál funguje (i na serveru), ale platí za sebe.
 */

import { useMemo, useState } from "react";
import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { GRAPH_EDGES, GRAPH_NODES } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";

const px = (x: number) => x * 6.4;
const py = (y: number) => y * 4;

const NODE_FILL: Record<string, string> = {
  person: "fill-cobalt",
  company: "fill-ink",
  party: "fill-steel",
  money: "fill-signal",
};

export default function MockGraph() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const f = useFormat();
  const [hover, setHover] = useState<string | null>("mp");
  const connected = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    GRAPH_EDGES.forEach((e) => {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    });
    return s;
  }, [hover]);

  const node = GRAPH_NODES.find((n) => n.id === hover);

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-steel">
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-signal" />
          {t("graph.badge")}
        </span>
        <span className="hidden sm:inline">{t("graph.joinCaption")}</span>
      </div>
      <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label={t("graph.ariaLabel")}>
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={i * 46} y1={0} x2={i * 46} y2={400} className="stroke-hairline" strokeWidth={0.5} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={640} y2={i * 50} className="stroke-hairline" strokeWidth={0.5} />
        ))}
        {GRAPH_EDGES.map((e, i) => {
          const a = GRAPH_NODES.find((n) => n.id === e.from)!;
          const b = GRAPH_NODES.find((n) => n.id === e.to)!;
          const lit = hover !== null && connected.has(e.from) && connected.has(e.to) && (e.from === hover || e.to === hover);
          const mx = (px(a.x) + px(b.x)) / 2;
          const my = (py(a.y) + py(b.y)) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(b.x)}
                y2={py(b.y)}
                className={lit ? "stroke-signal" : "stroke-steel"}
                strokeOpacity={lit ? 1 : 0.45}
                strokeWidth={lit ? 2.5 : 1.25}
                strokeDasharray={e.trail ? undefined : "4 4"}
              />
              {lit && (
                <text x={mx} y={my - 8} textAnchor="middle" fontSize={11} fontFamily="var(--font-plex)" fontWeight={700} className="fill-signal uppercase">
                  {tc(`graphEdges.${i}`)}
                </text>
              )}
            </g>
          );
        })}
        {GRAPH_NODES.map((n) => {
          const lit = connected.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {n.kind === "money" ? (
                <rect x={-7.5} y={-7.5} width={15} height={15} className={lit ? NODE_FILL[n.kind] : "fill-hairline"} transform="rotate(45)" />
              ) : (
                <circle r={n.id === hover ? 10 : 7.5} className={lit ? NODE_FILL[n.kind] : "fill-hairline"} />
              )}
              <text
                y={-15}
                textAnchor="middle"
                fontSize={13.5}
                fontFamily="var(--font-plex)"
                fontWeight={700}
                className={lit ? "fill-ink" : "fill-steel"}
              >
                {tc(`graphNodes.${n.id}.label`)}
              </text>
              <text y={27} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-plex)" className="fill-steel uppercase">
                {tc(`graphNodes.${n.id}.sub`)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex min-h-[3.25rem] items-center justify-between gap-4 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {node ? (
          <span>
            <span className="font-bold text-signal">▸ {tc(`graphNodes.${node.id}.label`)}</span>{" "}
            <span className="text-steel">
              — {tc(`graphNodes.${node.id}.sub`)} ·{" "}
              {t("graph.edgesInRecord", {
                count: f.int(GRAPH_EDGES.filter((e) => e.from === node.id || e.to === node.id).length),
              })}
            </span>
          </span>
        ) : (
          <span className="text-steel">{t("graph.hoverHint")}</span>
        )}
        {/* The mock used to claim „všechny hrany datované + doložené" in the CONFIRMED
            colour — a made-up verdict on made-up edges, and the exact opposite of the
            doctrine the real graph beside it renders. A fallback says it is a fallback. */}
        <span className="hidden shrink-0 font-bold uppercase tracking-wider text-ochre sm:inline">
          {t("graph.sampleNotice")}
        </span>
      </div>
    </div>
  );
}
