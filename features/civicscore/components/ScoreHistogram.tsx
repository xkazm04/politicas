"use client";

/**
 * Rozložení sněmovny — histogram indexu přispění po 5 bodech + počítaný souhrn.
 * Vše z reálného grafu (getLeaderboardData). Pásmo je interval [od, od+5) a nese
 * jeho skutečnou horní mez; barva má TŘI stavy — celé pásmo pod mediánem
 * (signální), pásmo s mediánem (okrová), zbytek (kobaltová). Žádné mock, žádná
 * čtvrtletní řada.
 */

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeaderboardData } from "../getLeaderboardData";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { COBALT, HAIRLINE, INK, OCHRE, PAPER_STRONG, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

export default function ScoreHistogram({
  summary,
  histogram,
}: {
  summary: LeaderboardData["summary"];
  histogram: LeaderboardData["histogram"];
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("civicscore");
  const tcom = useTranslations("common");
  const f = useFormat();

  const summaryTiles = useMemo(
    () => [
      { label: t("avgLabel"), value: f.dec(summary.avg) },
      { label: t("medianLabel"), value: f.dec(summary.median) },
      { label: t("sigmaLabel"), value: f.dec(summary.sigma) },
    ],
    [t, f, summary],
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[8fr_4fr]">
      <div className="min-w-0">
        <div className="w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={histogram} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={HAIRLINE} vertical={false} />
              <XAxis dataKey="label" tick={{ ...CHART_TICK, fontSize: 11 }} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} interval={0} angle={-45} textAnchor="end" height={44} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: PAPER_STRONG }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [t("histogramCount", { value: Number(value) }), t("histogramBand")]}
              />
              {/* Tři stavy, ne dva. Pásmo, V NĚMŽ medián leží, není „pod mediánem" —
                  a přesně to se dřív dělo největšímu pásmu sněmovny (65–70 při
                  mediánu 68,6 se barvilo signální „pod mediánem"). */}
              <Bar dataKey="count" isAnimationActive={!reduceMotion}>
                {histogram.map((b) => {
                  const holdsMedian = summary.median >= b.from && summary.median < b.from + 5;
                  const below = b.from + 5 <= summary.median;
                  return (
                    <Cell
                      key={b.from}
                      fill={holdsMedian ? OCHRE : below ? SIGNAL : COBALT}
                      fillOpacity={below ? 0.85 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2">
          <SourceNote>
            {t("histogramSource", { pts: tcom("pts") })}
          </SourceNote>
        </div>
      </div>
      <div className="grid content-start gap-px self-start border border-ink bg-ink">
        {summaryTiles.map((tile) => (
          <div key={tile.label} className="flex items-baseline justify-between gap-4 bg-paper px-5 py-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{tile.label}</span>
            <span className="text-3xl font-black tabular-nums">{tile.value}</span>
          </div>
        ))}
        <div className="bg-paper px-5 py-4">
          <SourceNote className="!text-[10px]">{t("histogramFootnote")}</SourceNote>
        </div>
      </div>
    </div>
  );
}
