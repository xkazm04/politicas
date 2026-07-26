"use client";

/*
 * Velín republiky — přehledová plocha aplikace. Vítěz 2. kola prototypu
 * (2026-07-26, dřív varianta „Konzole"), konsolidováno.
 *
 * Mentální model: PŘÍSTROJOVÝ PANEL. Graf státu je hlavní přístroj a hned
 * vedle něj běží pás provozu jako jeho telemetrie z TÉHOŽ datasetu: uzel
 * v grafu profiltruje provoz, zaměřovač v provozu připne uzel v grafu.
 * Žebříček je pod tím jako odečet — účetní kniha sněmovny; její řádky vedou
 * do spisů, velín je rozcestník, spis je produkt.
 *
 * Pohled je celosněmovní a evidence-first: nejdřív „co se v grafu stalo",
 * teprve pak „kdo je kde v pořadí". Levou navigaci kreslí layout
 * (features/shell) — tahle plocha si vlastní chrome nedělá.
 */

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHAMBER_STATS, CHAMBER_TREND, EVENTS, MPS, PILLARS, TREND_QUARTERS } from "@/lib/civic/data";
import { buildStateGraph, nodesForRefs } from "@/lib/civic/stateGraph";
import { useFormat } from "@/lib/i18n/useFormat";
import RankDelta from "@/features/shared/components/RankDelta";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, PILLAR_BG, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";
import GraphFeedPanel from "./components/GraphFeedPanel";
import StateGraphCanvas from "./components/StateGraphCanvas";
import { useGraphText } from "./graphText";

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const text = useGraphText();

  const graph = useMemo(() => buildStateGraph(), []);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  // event.id → uzly, které řádek rozsvítí. Počítá se jednou; provoz i graf
  // pak čtou tutéž mapu, takže se filtr nemůže rozejít s obrázkem.
  const nodesByEvent = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, nodesForRefs(e.refs, graph)])),
    [graph],
  );

  const pinnedNode = pinned ? graph.nodes.find((n) => n.id === pinned) : undefined;
  const pinnedLabel = pinnedNode ? text.node(pinnedNode).label : null;

  const chamberTrendData = useMemo(
    () => CHAMBER_TREND.map((v, i) => ({ q: TREND_QUARTERS[i], avg: v })),
    [],
  );

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">
            politicas / {t("headerTag")}
          </span>
          <SourceNote className="hidden sm:block">
            {t("headerNote", { date: f.date("2026-07-14") })}
          </SourceNote>
        </div>
      </header>

      <div className="px-6 pb-16">
        <div className="py-8">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            {t("title")}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-steel">{t("lead")}</p>
        </div>

        {/* Odečty sněmovny — pás nad přístrojem, ne samostatná sekce. */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 xl:grid-cols-4">
          {CHAMBER_STATS.map((s) => (
            <div key={s.key} className="bg-paper px-5 py-4">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {tc(`chamberStats.${s.key}.label`)}
              </p>
              <p className="mt-1.5 text-3xl font-black tabular-nums tracking-tight">
                {tc(`chamberStats.${s.key}.value`)}
              </p>
              <p className="mt-1 text-sm text-steel">{tc(`chamberStats.${s.key}.sub`)}</p>
              <SourceNote className="mt-2">
                {tcom("sourcePrefix")} {tc(`chamberStats.${s.key}.source`)}
              </SourceNote>
            </div>
          ))}
        </div>

        {/* ── /01 Graf + provoz ─────────────────────────────────── */}
        <section id="graf" className="mt-12">
          <SectionHeading
            index={1}
            title={t("graph.title")}
            aside={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <SourceNote>{t("graph.caption")}</SourceNote>
                {/* Velín ukazuje výřez; celý graf se prochází na vlastní ploše. */}
                <Link
                  href="/graf"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                >
                  {t("graph.openPlayground")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            }
          />
          <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <StateGraphCanvas
                graph={graph}
                hover={hover}
                pinned={pinned}
                onHover={setHover}
                onPin={setPinned}
              />
              <SourceNote className="mt-2">{t("graph.sliceNote")}</SourceNote>
            </div>
            <div id="provoz" className="min-w-0 xl:col-span-5">
              <GraphFeedPanel
                events={EVENTS}
                nodesByEvent={nodesByEvent}
                pinned={pinned}
                pinnedLabel={pinnedLabel}
                onPick={(id) => setPinned(id)}
                onClear={() => setPinned(null)}
              />
            </div>
          </div>
        </section>

        {/* ── /02 Žebříček ──────────────────────────────────────── */}
        <section id="zebricek" className="mt-14 border-t-4 border-ink pt-8">
          <SectionHeading
            index={2}
            title={t("rankingSectionTitle")}
            aside={
              <Link
                href="/zebricek"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {t("allMpsLink")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-6 grid gap-10 lg:grid-cols-12">
            <div className="min-w-0 border-t-2 border-ink lg:col-span-8">
              {MPS.map((m) => (
                <Link
                  key={m.id}
                  href={`/poslanec/${m.id}`}
                  className="group grid grid-cols-[2.5rem_1fr_auto_auto_auto] items-center gap-4 border-b border-hairline px-2 py-3.5 transition-colors hover:bg-paper-strong"
                >
                  <span className={`font-mono text-xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
                    {m.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black uppercase tracking-tight">
                      {m.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: m.partyColor }}
                      />
                      {m.party} · {tc(`regions.${m.region}`)}
                    </span>
                    {/* Rozpad kompozitu na pilíře — odečet, ne dekorace. */}
                    <span className="mt-1.5 flex h-1.5 w-full max-w-56 gap-px" aria-hidden>
                      {PILLARS.map((p) => (
                        <span
                          key={p.key}
                          className={`${PILLAR_BG[p.key]} block`}
                          style={{ width: `${m.pillars[p.key] / 4}%`, minWidth: 2 }}
                        />
                      ))}
                    </span>
                  </span>
                  <RankDelta delta={m.delta} />
                  <span className="text-xl font-black tabular-nums">{f.dec(m.score)}</span>
                  <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <SourceNote>{t("rankingFootnote")}</SourceNote>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {PILLARS.map((p) => (
                    <span
                      key={p.key}
                      className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-steel"
                    >
                      <span className={`inline-block h-2 w-2 ${PILLAR_BG[p.key]}`} />
                      {tc(`pillars.${p.key}.label`)}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-4">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {t("chamberTrendLabel")}
              </p>
              <div
                className="mt-3 w-full overflow-hidden"
                style={{ aspectRatio: "5 / 3", minHeight: 200 }}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={chamberTrendData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={HAIRLINE} vertical={false} />
                    <XAxis
                      dataKey="q"
                      tick={CHART_TICK}
                      tickLine={false}
                      axisLine={{ stroke: INK, strokeWidth: 2 }}
                    />
                    <YAxis
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tick={CHART_TICK}
                      tickFormatter={(v: number) => f.dec(v)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: INK, strokeDasharray: "4 4" }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [f.dec(Number(value)), t("chamberTrendTooltip")]}
                    />
                    <Area
                      type="linear"
                      dataKey="avg"
                      stroke={SIGNAL}
                      strokeWidth={3}
                      fill={SIGNAL}
                      fillOpacity={0.12}
                      dot={{ r: 3.5, fill: SIGNAL, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: INK }}
                      isAnimationActive={!reduceMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <SourceNote className="mt-2">{t("chamberTrendSource")}</SourceNote>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
