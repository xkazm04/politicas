"use client";

/*
 * TEXTOVÁ PODOBA VÝŘEZU — obrázek jako seznam uzlů a jejich vazeb.
 *
 * ── Proč ────────────────────────────────────────────────────────────────────
 * Plátno velína je SVG. Do 2026-08-05 k němu neexistovala žádná textová
 * alternativa: kdo obrázek nevidí (odečítačka, tisk, vypnuté skripty, malá
 * obrazovka), měl k dispozici sedmnáct tlačítek bez kontextu a ani jednu větu
 * o tom, co s čím souvisí — přitom celý smysl toho obrázku JSOU vazby.
 *
 * ── Co to NENÍ ──────────────────────────────────────────────────────────────
 * Není to druhá derivace grafu. Bere `graph`, `rule` i `selected` z TÝCHŽ propů
 * jako plátno nad ní a vybírá TÝMŽ `onSelect` — jeden výběr, jedna sémantika
 * (../useGraphSelection.ts). Kdyby si seznam počítal cokoli sám, měla by
 * stránka dva obrázky jedné věci a jeden z nich by lhal.
 *
 * Popisky jdou přes JEDINÝ popiskový engine (../graphText.ts), takže se uzel
 * v seznamu jmenuje přesně tak jako na obrázku.
 *
 * Odkazy jsou tytéž, které nabízí stavový řádek plátna: spis entity (`href` na
 * uzlu) a — jen nad REÁLNÝM výřezem (`rule !== null`) a jen pro entitu, kterou
 * nějaký proud opravdu adresuje — deník entity (../entityLinks.ts). Nad
 * vzorkovým grafem by obojí byla fabrikace.
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { StateEdge, StateGraph } from "@/lib/civic/stateGraph";
import type { StateSliceRule } from "../stateSlice";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { denikEntityHref, sliceNodeEntityKey } from "../entityLinks";
import { useGraphText } from "../graphText";

export default function GraphNodeList({
  graph,
  rule,
  selected,
  onSelect,
}: {
  graph: StateGraph;
  /** null = vzorkový graf; pak se nenabízejí adresy do reálných proudů. */
  rule: StateSliceRule | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const tg = useTranslations("dashboard.graph");
  const f = useFormat();
  const text = useGraphText();

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  /** Vazby uzlu — hrana v obou směrech, protože vazba není jednosměrná věta. */
  const edgesOf = (id: string): { edge: StateEdge; otherId: string }[] =>
    graph.edges
      .filter((e) => e.from === id || e.to === id)
      .map((e) => ({ edge: e, otherId: e.from === id ? e.to : e.from }));

  return (
    <details className="border-t border-hairline">
      <summary className="cursor-pointer px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal">
        {tg("list.summary", { nodes: f.int(graph.nodes.length), edges: f.int(graph.edges.length) })}
      </summary>
      <div className="px-4 pb-3">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-steel">
          {tg("list.intro")}
        </p>
        <ol className="border-t border-hairline">
          {graph.nodes.map((n, i) => {
            const t = text.node(n);
            const links = edgesOf(n.id);
            const isSelected = selected === n.id;
            const entityKey = rule ? sliceNodeEntityKey(n.id) : null;
            return (
              <li
                key={n.id}
                className={`border-b border-hairline py-2.5 ${isSelected ? "bg-paper-strong" : ""}`}
                aria-current={isSelected ? "true" : undefined}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                    {tg("list.index", { index: f.int(i + 1) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    aria-pressed={isSelected}
                    className="text-left text-[15px] font-bold text-ink underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                  >
                    {t.label}
                  </button>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                    {t.kind}
                    {t.sub ? ` · ${t.sub}` : ""}
                  </span>
                  {n.href && (
                    <Link
                      href={n.href}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                    >
                      {t.kind} <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  {entityKey && (
                    <Link
                      href={denikEntityHref(entityKey)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                    >
                      {tg("denikEntity")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
                {links.length > 0 ? (
                  <ul className="mt-1 ml-4 list-disc marker:text-steel">
                    {links.map(({ edge, otherId }) => {
                      const other = byId.get(otherId);
                      return (
                        <li
                          key={`${edge.from}-${edge.to}-${edge.rel}`}
                          className="text-[13px] leading-relaxed text-steel-aa"
                        >
                          {text.edge(edge)} — {other ? text.node(other).label : otherId}
                          {!edge.verified && (
                            <span className="ml-1.5 font-mono text-[11px] uppercase tracking-wider text-signal">
                              {tg("pendingShort")}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 ml-4 font-mono text-[11px] uppercase tracking-wider text-steel">
                    {tg("noEdges")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <SourceNote className="mt-2">
          {rule ? tg("list.realSource") : tg("list.mockSource")}
        </SourceNote>
      </div>
    </details>
  );
}
