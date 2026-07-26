"use client";

/*
 * BudgetMirror — zrcadlo rozpočtů (/rozpocty, roadmapa Fáze 3).
 * Hospodaření města proti vrstevnické skupině: vyber město → tři metriky
 * proti mediánu vrstevníků, tabulka skupiny a vývoj dluhu na obyvatele
 * v čase. Sytí dimenzi Správcovství pro exekutivní role (starostové,
 * hejtmani) — na poslance vzorku se zatím nepropisuje.
 */

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUDGET_YEARS, TOWNS, type Town } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const PEER_MEDIAN = {
  debt: median(TOWNS.map((t) => t.debtPerCapita)),
  capex: median(TOWNS.map((t) => t.capexRatio)),
  saldo: median(TOWNS.map((t) => t.saldoPerCapita)),
};

/** Bar-width ceilings derived from the live TOWNS data (+10% headroom) rather
 * than hand-picked magic numbers — a hardcoded max silently saturates every
 * bar at 100% once a town's real figure grows past it, making two towns with
 * wildly different debt burdens render an identical full-width bar with no
 * visual cue anything is capped. Shared by both MetricDuo (Section 01) and
 * the peer-group table's debt bar (Section 03) so there's one ceiling, not
 * two independently-maintained literals. */
const METRIC_MAX = {
  debt: Math.max(...TOWNS.map((t) => t.debtPerCapita)) * 1.1,
  capex: Math.max(...TOWNS.map((t) => t.capexRatio)) * 1.1,
  saldo: Math.max(...TOWNS.map((t) => Math.abs(t.saldoPerCapita))) * 1.1,
};

/** Medián trendu dluhu vrstevníků po letech — srovnávací čára grafu. */
const PEER_TREND = BUDGET_YEARS.map((_, i) => median(TOWNS.map((t) => t.debtTrend[i])));

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

/** Dvojice pruhů město vs. medián — metrika správcovství. */
function MetricDuo({
  label,
  kind,
  town,
  peer,
  max,
  lowerIsBetter,
}: {
  label: string;
  /** czk = f.czk (pozice měny se mění podle jazyka) · pct = f.dec + statické "%". */
  kind: "czk" | "pct";
  town: number;
  peer: number;
  max: number;
  lowerIsBetter: boolean;
}) {
  const t = useTranslations("budget");
  const f = useFormat();
  const formatPlain = (n: number) => (kind === "czk" ? f.czk(n) : `${f.dec(n)} %`);
  const better = lowerIsBetter ? town <= peer : town >= peer;
  const width = (v: number) => `${Math.min(100, Math.max(2, (Math.abs(v) / max) * 100))}%`;
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${better ? "text-ink" : "text-signal"}`}>
        {kind === "czk" ? (
          f.czk(town)
        ) : (
          <>
            {f.dec(town)}
            <span className="ml-1 text-base font-bold text-steel">%</span>
          </>
        )}
      </p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="h-3 bg-ink" style={{ width: width(town) }} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">{t("townLabel")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 bg-hairline" style={{ width: width(peer) }}>
            <span className="block h-full w-full border border-steel/40" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
            {t("peerMedianValue", { value: formatPlain(peer) })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BudgetMirrorPage() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("budget");
  const tc = useTranslations("content");
  const f = useFormat();
  const [selectedId, setSelectedId] = useState<Town["id"]>("beroun");
  const town = TOWNS.find((tw) => tw.id === selectedId) ?? TOWNS[0];

  const townSeriesLabel = t("townLabel");
  const peerSeriesLabel = t("peerMedianLabel");

  // Keyed by stable, non-translated identifiers — NOT the translated labels
  // above. Using translated copy as the object/dataKey identity means a
  // future locale (or a copy edit) that makes the two labels equal would
  // silently collapse both series into one property, dropping a line from
  // the chart with no error. Labels are passed to <Line name> purely for
  // display (legend/tooltip), decoupled from data-shape identity.
  const trendData = useMemo(
    () =>
      BUDGET_YEARS.map((y, i) => ({
        year: y,
        town: town.debtTrend[i],
        peer: PEER_TREND[i],
      })),
    [town],
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ budgetmirror</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("eyebrow")}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">{t("intro")}</p>
        </div>

        {/* ── 01 Město vs. vrstevníci ───────────────────────── */}
        <section id="zrcadlo">
          <SectionHeading
            index={1}
            title={t("section1Title")}
            aside={<SourceNote>{t("section1Aside")}</SourceNote>}
          />
          <div className="mt-6 flex flex-wrap gap-1.5">
            {TOWNS.map((tw) => (
              <button
                key={tw.id}
                type="button"
                onClick={() => setSelectedId(tw.id)}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  tw.id === selectedId ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
                }`}
                aria-pressed={tw.id === selectedId}
              >
                {tw.name}
              </button>
            ))}
          </div>
          <motion.div
            key={town.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
              <h3 className="text-2xl font-black uppercase tracking-tight">
                {town.name}
                <span className="ml-3 font-mono text-xs font-normal normal-case tracking-normal text-steel">
                  {tc(`regions.${town.region}`)} · {t("residents", { count: f.int(town.population) })}
                </span>
              </h3>
            </div>
            <div className="mt-6 grid gap-px border border-ink bg-ink sm:grid-cols-3">
              <MetricDuo
                label={t("metricDebtLabel")}
                kind="czk"
                town={town.debtPerCapita}
                peer={PEER_MEDIAN.debt}
                max={METRIC_MAX.debt}
                lowerIsBetter
              />
              <MetricDuo
                label={t("metricCapexLabel")}
                kind="pct"
                town={town.capexRatio}
                peer={PEER_MEDIAN.capex}
                max={METRIC_MAX.capex}
                lowerIsBetter={false}
              />
              <MetricDuo
                label={t("metricSaldoLabel")}
                kind="czk"
                town={town.saldoPerCapita}
                peer={PEER_MEDIAN.saldo}
                max={METRIC_MAX.saldo}
                lowerIsBetter={false}
              />
            </div>
          </motion.div>
        </section>

        {/* ── 02 Vývoj dluhu ────────────────────────────────── */}
        <section id="dluh" className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("section2Title")}
            aside={<SourceNote>{t("section2Aside", { town: town.name })}</SourceNote>}
          />
          <div className="mt-8 w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={HAIRLINE} vertical={false} />
                <XAxis dataKey="year" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} />
                <YAxis
                  tick={CHART_TICK}
                  tickFormatter={(v: number) => f.int(v)}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ stroke: INK, strokeDasharray: "4 4" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [f.czk(Number(value)), String(name)]}
                />
                <Line
                  type="linear"
                  dataKey="town"
                  name={townSeriesLabel}
                  stroke={SIGNAL}
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: SIGNAL, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: INK }}
                  isAnimationActive={!reduceMotion}
                />
                <Line
                  type="linear"
                  dataKey="peer"
                  name={peerSeriesLabel}
                  stroke={STEEL}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={!reduceMotion}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2">
            <SourceNote>{t("section2Source")}</SourceNote>
          </div>
        </section>

        {/* ── 03 Vrstevnická skupina ────────────────────────── */}
        <section id="skupina" className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title={t("section3Title")}
            aside={<SourceNote>{t("section3Aside")}</SourceNote>}
          />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel">
                  <th className="py-3 pr-4 font-bold">{t("townLabel")}</th>
                  <th className="py-3 pr-4 text-right font-bold">{t("colPopulation")}</th>
                  <th className="py-3 pr-4 font-bold">{t("colDebt")}</th>
                  <th className="py-3 pr-4 text-right font-bold">{t("colCapex")}</th>
                  <th className="py-3 text-right font-bold">{t("colSaldo")}</th>
                </tr>
              </thead>
              <tbody>
                {[...TOWNS]
                  .sort((a, b) => a.debtPerCapita - b.debtPerCapita)
                  .map((tw) => (
                    <tr
                      key={tw.id}
                      onClick={() => setSelectedId(tw.id)}
                      className={`cursor-pointer border-b border-hairline transition-colors hover:bg-paper-strong ${
                        tw.id === selectedId ? "bg-paper-strong" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-4">
                        <span className="text-[15px] font-black uppercase tracking-tight">{tw.name}</span>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-steel">
                          {tc(`regions.${tw.region}`)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums text-steel">
                        {f.int(tw.population)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="flex items-center gap-3">
                          <span className="h-3 w-40 bg-hairline">
                            <span
                              className={`block h-full ${tw.debtPerCapita > PEER_MEDIAN.debt ? "bg-signal" : "bg-ink"}`}
                              style={{ width: `${Math.min(100, (tw.debtPerCapita / METRIC_MAX.debt) * 100)}%` }}
                            />
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{f.czk(tw.debtPerCapita)}</span>
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums">
                        {f.dec(tw.capexRatio)} %
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono text-sm font-bold tabular-nums ${
                          tw.saldoPerCapita < 0 ? "text-signal" : "text-ink"
                        }`}
                      >
                        {tw.saldoPerCapita > 0 ? "+" : ""}
                        {f.czk(tw.saldoPerCapita)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">{t("stewardshipNote")}</p>
        </section>
      </div>
    </main>
  );
}
