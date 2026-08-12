"use client";

/**
 * Graf entit — OZNAČENÝ VZOROVÝ mock, když peněžní vrstva grafu není k dispozici.
 * Chování beze změny; oddělený modul jen proto, aby se `lib/civic/data.ts` (27 KB)
 * nedostávalo do balíčku, který reálná cesta nikdy nespustí — `MoneyGraph` ho nahrává
 * přes `next/dynamic`, takže fallback dál funguje (i na serveru), ale platí za sebe.
 *
 * ── KLÁVESNICE A ODEČÍTAČKA (2026-08-12) ────────────────────────────────────
 * Týž vzor jako reálný obrázek: `role="group"`, JEDEN tabstop (roving tabindex),
 * šipky po hranách přes IMPORTOVANÉ pravidlo (features/dashboard/graphTraversal.ts),
 * Home/End na první a poslední uzel v pořadí kreslení, viditelný kobaltový
 * kroužek fokusu. Vzor se opisovat nesmí a taky se neopisuje — obě plochy volají
 * tytéž funkce.
 *
 * ODKAZY TU NEJSOU, A JE TO PRAVIDLO, NE OPOMENUTÍ. Uzly vzorku stojí za
 * vymyšlené osoby a firmy („K. Hruška", „Silnice MSK a.s."), takže se adresa
 * spisu ODMÍTÁ PODLE TVARU ID — `moneyNodeHref` se volá stejně jako u reálného
 * grafu a pro každý vzorkový uzel vrací `null` (precedens
 * features/dashboard/entityLinks.ts: vymyšlená entita nesmí razit skutečnou
 * adresu). Patička to čtenáři říká větou, ne mlčením.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { GRAPH_EDGES, GRAPH_NODES } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import {
  firstNodeId,
  isArrowKey,
  lastNodeId,
  neighbourStep,
  rovingNodeId,
} from "@/features/dashboard/graphTraversal";
import {
  degreeOf,
  moneyNodeHref,
  traversalEdges,
  traversalNodes,
  type MoneyNodeKind,
} from "../graphNav";

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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rovingMemo, setRovingMemo] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement | null>());

  const navNodes = useMemo(() => traversalNodes(GRAPH_NODES), []);
  const navEdges = useMemo(() => traversalEdges(GRAPH_EDGES), []);
  const rovingId = rovingNodeId(rovingMemo, null, navNodes);

  const focusNode = useCallback((id: string | null) => {
    if (id === null) return;
    const el = nodeRefs.current.get(id);
    if (!el) return;
    setRovingMemo(id);
    el.focus();
  }, []);

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
      {/* role="group", ne role="img": listová role by uzly uvnitř sebe pro
          asistivní technologie zrušila (týž nález jako na reálném obrázku). */}
      <svg viewBox="0 0 640 400" className="w-full" role="group" aria-label={t("graph.ariaLabel")}>
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
        {GRAPH_NODES.map((n, i) => {
          const lit = connected.has(n.id);
          // Odmítnutí podle TVARU, ne podle větve: týž resolver, jaký sází
          // reálný graf — pro „mp" / „co1" / „k2" nemá co vrátit.
          const href = moneyNodeHref(n.id);
          const degree = degreeOf(n.id, navEdges);
          const label = [
            `${t(`graph.kind.${n.kind as MoneyNodeKind}`)}: ${tc(`graphNodes.${n.id}.label`)}`,
            tc(`graphNodes.${n.id}.sub`),
            t("graph.nodePosition", { index: f.int(i + 1), total: f.int(GRAPH_NODES.length) }),
            degree > 0 ? t("graph.edgesInRecord", { count: f.int(degree) }) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <g
              key={n.id}
              ref={(el) => {
                nodeRefs.current.set(n.id, el);
              }}
              transform={`translate(${px(n.x)} ${py(n.y)})`}
              // Bez adresy spisu není uzel odkazem ani tlačítkem: je to popsaný
              // obrázek. `href` je tu vždy `null` — viz hlavička souboru.
              role={href ? "link" : "img"}
              tabIndex={rovingId === n.id ? 0 : -1}
              aria-label={label}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => {
                setFocusedId(n.id);
                setRovingMemo(n.id);
                setHover(n.id);
              }}
              onBlur={() => setFocusedId(null)}
              onKeyDown={(ev) => {
                if (isArrowKey(ev.key)) {
                  const next = neighbourStep(n.id, ev.key, navNodes, navEdges);
                  if (next !== null) {
                    ev.preventDefault();
                    focusNode(next);
                  }
                  return;
                }
                if (ev.key === "Home") {
                  ev.preventDefault();
                  focusNode(firstNodeId(navNodes));
                } else if (ev.key === "End") {
                  ev.preventDefault();
                  focusNode(lastNodeId(navNodes));
                }
              }}
              style={{ cursor: "default" }}
            >
              {focusedId === n.id && (
                <circle r={20} className="fill-none stroke-cobalt" strokeWidth={2.5} strokeDasharray="4 3" />
              )}
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
      <p className="border-t border-hairline px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
        {t("graph.keyboardHint")}
      </p>
      <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-ink px-4 py-2.5 font-mono text-xs">
        {node ? (
          <span className="min-w-0">
            <span className="font-bold text-signal">▸ {tc(`graphNodes.${node.id}.label`)}</span>{" "}
            <span className="text-steel">
              — {tc(`graphNodes.${node.id}.sub`)} ·{" "}
              {t("graph.edgesInRecord", {
                // citation-ok: counts the edges THIS sample picture draws, not any graph; the frame's source note (`money.graphCaption`) is rendered by the parent, FollowTheMoneyPage, and the badge beside this line says the whole picture is sample data.
                count: f.int(GRAPH_EDGES.filter((e) => e.from === node.id || e.to === node.id).length),
              })}
            </span>
          </span>
        ) : (
          <span className="text-steel">{t("graph.hoverHint")}</span>
        )}
        {/* The mock used to claim „všechny hrany datované + doložené" in the CONFIRMED
            colour — a made-up verdict on made-up edges, and the exact opposite of the
            doctrine the real graph beside it renders. A fallback says it is a fallback —
            a teď i to, proč z něj nevede žádný odkaz do spisu. */}
        <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-steel">{t("graph.sampleNoCaseFiles")}</span>
          <span className="hidden font-bold uppercase tracking-wider text-ochre sm:inline">
            {t("graph.sampleNotice")}
          </span>
        </span>
      </div>
    </div>
  );
}
