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
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUDGET_YEARS, TOWNS, type Town } from "@/lib/civic/data";
import { czech, czechInt } from "@/lib/format";
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

/** Medián trendu dluhu vrstevníků po letech — srovnávací čára grafu. */
const PEER_TREND = BUDGET_YEARS.map((_, i) => median(TOWNS.map((t) => t.debtTrend[i])));

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

/** Dvojice pruhů město vs. medián — metrika správcovství. */
function MetricDuo({
  label,
  unit,
  town,
  peer,
  max,
  lowerIsBetter,
}: {
  label: string;
  unit: string;
  town: number;
  peer: number;
  max: number;
  lowerIsBetter: boolean;
}) {
  const better = lowerIsBetter ? town <= peer : town >= peer;
  const width = (v: number) => `${Math.min(100, Math.max(2, (Math.abs(v) / max) * 100))}%`;
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${better ? "text-ink" : "text-signal"}`}>
        {czechInt(town)}
        <span className="ml-1 text-base font-bold text-steel">{unit}</span>
      </p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="h-3 bg-ink" style={{ width: width(town) }} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">město</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 bg-hairline" style={{ width: width(peer) }}>
            <span className="block h-full w-full border border-steel/40" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
            medián · {czechInt(peer)} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BudgetMirrorPage() {
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<Town["id"]>("beroun");
  const town = TOWNS.find((t) => t.id === selectedId) ?? TOWNS[0];

  const trendData = useMemo(
    () =>
      BUDGET_YEARS.map((y, i) => ({
        rok: y,
        město: town.debtTrend[i],
        "medián vrstevníků": PEER_TREND[i],
      })),
    [town],
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
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ budgetmirror</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> velín
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">
            budgetmirror · rozpočtové srovnání · správcovství pro exekutivní role
          </SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            Zrcadlo rozpočtů<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            Hospodaření města nemá smysl číst samo o sobě — zrcadlo ho staví vedle
            vrstevníků podobné velikosti. Ukázková skupina: města 20–40 tisíc obyvatel
            (z 6 254 obcí v MONITORu).
          </p>
        </div>

        {/* ── 01 Město vs. vrstevníci ───────────────────────── */}
        <section>
          <SectionHeading
            index={1}
            title="Město vs. vrstevníci"
            aside={<SourceNote>signální hodnota = horší než medián skupiny · MONITOR, čtvrtletně</SourceNote>}
          />
          <div className="mt-6 flex flex-wrap gap-1.5">
            {TOWNS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  t.id === selectedId ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
                }`}
                aria-pressed={t.id === selectedId}
              >
                {t.name}
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
                  {town.region} · {czechInt(town.population)} obyvatel
                </span>
              </h3>
            </div>
            <div className="mt-6 grid gap-px border border-ink bg-ink sm:grid-cols-3">
              <MetricDuo
                label="dluh na obyvatele"
                unit="Kč"
                town={town.debtPerCapita}
                peer={PEER_MEDIAN.debt}
                max={14000}
                lowerIsBetter
              />
              <MetricDuo
                label="podíl investic na výdajích"
                unit="%"
                town={town.capexRatio}
                peer={PEER_MEDIAN.capex}
                max={30}
                lowerIsBetter={false}
              />
              <MetricDuo
                label="saldo na obyvatele"
                unit="Kč"
                town={town.saldoPerCapita}
                peer={PEER_MEDIAN.saldo}
                max={3000}
                lowerIsBetter={false}
              />
            </div>
          </motion.div>
        </section>

        {/* ── 02 Vývoj dluhu ────────────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title="Vývoj dluhu"
            aside={<SourceNote>Kč na obyvatele · plná čára = {town.name} · čárkovaná = medián vrstevníků</SourceNote>}
          />
          <div className="mt-8 w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={HAIRLINE} vertical={false} />
                <XAxis dataKey="rok" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} />
                <YAxis
                  tick={CHART_TICK}
                  tickFormatter={(v: number) => czechInt(v)}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ stroke: INK, strokeDasharray: "4 4" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [`${czechInt(Number(value))} Kč`, String(name)]}
                />
                <Line
                  type="linear"
                  dataKey="město"
                  stroke={SIGNAL}
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: SIGNAL, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: INK }}
                  isAnimationActive={!reduceMotion}
                />
                <Line
                  type="linear"
                  dataKey="medián vrstevníků"
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
            <SourceNote>zdroj: MONITOR / Státní pokladna — čtvrtletní ingesce, konsolidováno po letech</SourceNote>
          </div>
        </section>

        {/* ── 03 Vrstevnická skupina ────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title="Vrstevnická skupina"
            aside={<SourceNote>řazeno podle dluhu na obyvatele · řádek přepíná zrcadlo</SourceNote>}
          />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel">
                  <th className="py-3 pr-4 font-bold">město</th>
                  <th className="py-3 pr-4 text-right font-bold">obyvatel</th>
                  <th className="py-3 pr-4 font-bold">dluh / obyv.</th>
                  <th className="py-3 pr-4 text-right font-bold">investice %</th>
                  <th className="py-3 text-right font-bold">saldo / obyv.</th>
                </tr>
              </thead>
              <tbody>
                {[...TOWNS]
                  .sort((a, b) => a.debtPerCapita - b.debtPerCapita)
                  .map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`cursor-pointer border-b border-hairline transition-colors hover:bg-paper-strong ${
                        t.id === selectedId ? "bg-paper-strong" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-4">
                        <span className="text-[15px] font-black uppercase tracking-tight">{t.name}</span>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-steel">
                          {t.region}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums text-steel">
                        {czechInt(t.population)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="flex items-center gap-3">
                          <span className="h-3 w-40 bg-hairline">
                            <span
                              className={`block h-full ${t.debtPerCapita > PEER_MEDIAN.debt ? "bg-signal" : "bg-ink"}`}
                              style={{ width: `${(t.debtPerCapita / 14000) * 100}%` }}
                            />
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {czechInt(t.debtPerCapita)} Kč
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums">
                        {czech(t.capexRatio)} %
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono text-sm font-bold tabular-nums ${
                          t.saldoPerCapita < 0 ? "text-signal" : "text-ink"
                        }`}
                      >
                        {t.saldoPerCapita > 0 ? "+" : ""}
                        {czechInt(t.saldoPerCapita)} Kč
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            Správcovství se propisuje do CivicScore jen u politiků v exekutivních rolích
            (starostové, hejtmani) — poslanec za špatný rozpočet cizího města skóre
            neztrácí. Data měst jsou ilustrativní mock nad tvarem MONITORu.
          </p>
        </section>
      </div>
    </main>
  );
}
