"use client";

/*
 * Velín republiky — přehledová plocha aplikace (vítěz dashboardového kola,
 * konsolidováno + vyleštěno na laťku landing page: plakátové sekce s velkými
 * titulky, vzdušnější rytmus, čitelné feed řádky, nástroje jako dlaždicový
 * pás). Mentální model: „co se ve státě změnilo, když jsem se nedíval?"
 * Řádky žebříčku vedou do spisů (/poslanec/[id]) — velín je rozcestník,
 * spis je produkt.
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHAMBER_STATS,
  CHAMBER_TREND,
  EVENTS,
  MODULES,
  MPS,
  PILLARS,
  TREND_QUARTERS,
} from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import RankDelta from "@/features/shared/components/RankDelta";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, PAPER_STRONG, PILLAR_FILL, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";

const TONE_DOT: Record<string, string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
};

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("dashboard");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  // Sněmovní trend přes 6 čtvrtletí — přesunuto do komponenty spolu s
  // pilířovými průměry, aby dataKey zůstal neutrální (avg) a název série
  // pilíře byl lokalizovaný.
  const chamberTrendData = useMemo(
    () => CHAMBER_TREND.map((v, i) => ({ q: TREND_QUARTERS[i], avg: v })),
    [],
  );

  const pillarAvgData = useMemo(
    () =>
      PILLARS.map((p) => ({
        key: p.key,
        name: tc(`pillars.${p.key}.label`),
        avg: Math.round((MPS.reduce((s, m) => s + m.pillars[p.key], 0) / MPS.length) * 10) / 10,
      })),
    [tc],
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" className="fill-signal" />
                <circle cx="16" cy="16" r="9" className="fill-paper" />
                <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
              </svg>
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ {t("headerTag")}</span>
          </div>
          <div className="flex items-center gap-4">
            <SourceNote className="hidden sm:block">{t("headerNote", { date: f.date("2026-07-14") })}</SourceNote>
            <LanguageSwitcher className="my-auto" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {t("lead")}
          </p>
        </div>

        {/* ── Agregátní dlaždice ────────────────────────────── */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {CHAMBER_STATS.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-paper p-6"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {tc(`chamberStats.${s.key}.label`)}
              </p>
              <p className="mt-3 text-5xl font-black tabular-nums tracking-tight">
                {tc(`chamberStats.${s.key}.value`)}
              </p>
              <p className="mt-2 text-sm text-steel">{tc(`chamberStats.${s.key}.sub`)}</p>
              <SourceNote className="mt-3 !text-[10px]">
                {tcom("sourcePrefix")} {tc(`chamberStats.${s.key}.source`)}
              </SourceNote>
            </motion.div>
          ))}
        </div>

        {/* ── 01 Žebříček + vývoj ───────────────────────────── */}
        <section className="mt-16">
          <SectionHeading
            index={1}
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
          <div className="mt-8 grid gap-12 lg:grid-cols-12">
            <div className="min-w-0 border-t-2 border-ink lg:col-span-7">
              {MPS.map((m) => (
                <Link
                  key={m.id}
                  href={`/poslanec/${m.id}`}
                  className="group grid grid-cols-[3rem_1fr_auto_auto_auto] items-center gap-4 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong"
                >
                  <span className={`font-mono text-2xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
                    {m.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-black uppercase tracking-tight">{m.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.partyColor }} />
                      {m.party} · {tc(`regions.${m.region}`)}
                    </span>
                  </span>
                  <RankDelta delta={m.delta} />
                  <span className="text-2xl font-black tabular-nums">{f.dec(m.score)}</span>
                  <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
              <div className="mt-3">
                <SourceNote>{t("rankingFootnote")}</SourceNote>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {t("chamberTrendLabel")}
              </p>
              <div className="mt-4 w-full overflow-hidden" style={{ aspectRatio: "5 / 3", minHeight: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={chamberTrendData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={HAIRLINE} vertical={false} />
                    <XAxis dataKey="q" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} />
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
              <div className="mt-2">
                <SourceNote>{t("chamberTrendSource")}</SourceNote>
              </div>

              <p className="mt-8 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {t("pillarAvgLabel", { n: MPS.length })}
              </p>
              <div className="mt-4 w-full overflow-hidden" style={{ aspectRatio: "5 / 2.4", minHeight: 170 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={pillarAvgData} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={HAIRLINE} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ ...CHART_TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: INK, strokeWidth: 2 }}
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={CHART_TICK} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: PAPER_STRONG }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [f.dec(Number(value)), t("pillarAvgTooltip")]}
                    />
                    <Bar dataKey="avg" isAnimationActive={!reduceMotion}>
                      {pillarAvgData.map((p) => (
                        <Cell key={p.key} fill={PILLAR_FILL[p.key as keyof typeof PILLAR_FILL]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                <SourceNote>{t("pillarAvgSource")}</SourceNote>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Feed ───────────────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("feedSectionTitle")}
            aside={<SourceNote>{t("feedIngestionNote")}</SourceNote>}
          />
          <div className="mt-8 border-t-2 border-ink">
            {EVENTS.map((e, i) => (
              <motion.div
                key={e.id}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[6rem_auto_1fr] items-baseline gap-4 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong max-sm:grid-cols-[auto_1fr]"
              >
                <span className="font-mono text-xs uppercase tracking-wider text-steel max-sm:hidden">
                  {tc(`events.${e.id}.ts`)}
                </span>
                <span className={`inline-block h-2.5 w-2.5 self-center ${TONE_DOT[e.tone]}`} aria-hidden />
                <span className="min-w-0 text-[15px] leading-relaxed">
                  {e.mpId ? (
                    <Link href={`/poslanec/${e.mpId}`} className="font-medium underline-offset-2 hover:text-signal hover:underline">
                      {tc(`events.${e.id}.text`)}
                    </Link>
                  ) : (
                    tc(`events.${e.id}.text`)
                  )}
                  <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
                    [{tc(`events.${e.id}.source`)}]
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 03 Nástroje ───────────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title={t("toolsSectionTitle")}
            aside={<SourceNote>{t("toolsJoinKeyNote")}</SourceNote>}
          />
          <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((m, i) => (
              <Link
                key={m.key}
                href={m.href ?? "#"}
                aria-disabled={!m.href}
                className={`group flex min-h-48 flex-col justify-between bg-paper p-5 transition-colors hover:bg-paper-strong ${
                  m.href ? "" : "cursor-default"
                }`}
              >
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
                    <span className={i === 0 ? "font-bold text-signal" : ""}>0{i + 1}</span> ·{" "}
                    {tc(`modules.${m.key}.tag`)}
                  </p>
                  <p className="mt-2 text-lg font-black uppercase leading-tight tracking-tight">{m.name}</p>
                </div>
                <div>
                  <p className="text-3xl font-black tabular-nums text-cobalt">
                    {tc(`modules.${m.key}.metricValue`)}
                  </p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <SourceNote className="!text-[10px]">{tc(`modules.${m.key}.metricLabel`)}</SourceNote>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
