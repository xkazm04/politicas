"use client";

/*
 * Odečet rozložení sněmovny vedle žebříčku — histogram reálných kontribučních
 * skóre, nebo (bez grafu) označený vzorkový trend.
 *
 * Proč VLASTNÍ komponenta, a k tomu memoizovaná: recharts je zdaleka nejdražší
 * strom na téhle stránce a nezávisí na ničem, čím uživatel hýbe. Dokud seděl
 * přímo v těle `DashboardPage`, překresloval se s každou změnou stavu plochy —
 * a jedno přejetí grafu myší jich vyrobilo 36 (velin-hover-cost-freshness).
 * Náhled sice od 2026-07-28 žije uvnitř plátna, ale výběr uzlu pořád mění stav
 * kořene; `memo` zajistí, že se z toho graf nedozví nic, protože jeho vstupy
 * jsou memoizovaná pole a jedno boolean.
 *
 * ResponsiveContainer MUSÍ zůstat v `overflow-hidden` obálce s pevným poměrem
 * stran uvnitř `min-w-0` sloupce — jinak stránka spadne do resize smyčky
 * (incident 2026-07-22, docs/DESIGN.md §4).
 */

import { memo } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

export interface ChamberChartProps {
  /** Reálný histogram skóre (207 poslanců). null ⇒ kreslí se vzorkový trend. */
  histogram: { band: string; count: number }[] | null;
  /** Vzorkový trend — vykreslí se JEN když histogram chybí, a je označený.
   *  `null` když histogram JE: plocha ho pak vůbec nepočítá (viz ../DashboardPage). */
  mockTrend: { q: string; avg: number }[] | null;
  /** Počet poslanců do popisky histogramu. */
  count: number;
  reduceMotion: boolean;
}

function ChamberChart({ histogram, mockTrend, count, reduceMotion }: ChamberChartProps) {
  const t = useTranslations("dashboard");
  const f = useFormat();

  return (
    <>
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {histogram ? t("histogram.label", { count }) : t("chamberTrendLabel")}
      </p>
      <div className="mt-3 w-full overflow-hidden" style={{ aspectRatio: "5 / 3", minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {histogram ? (
            <BarChart data={histogram} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={HAIRLINE} vertical={false} />
              <XAxis dataKey="band" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} />
              <YAxis tick={CHART_TICK} tickFormatter={(v: number) => f.int(v)} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: HAIRLINE }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [f.int(Number(value)), t("histogram.tooltip")]}
              />
              <Bar dataKey="count" fill={SIGNAL} isAnimationActive={!reduceMotion} />
            </BarChart>
          ) : (
            <AreaChart data={mockTrend ?? []} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
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
          )}
        </ResponsiveContainer>
      </div>
      <SourceNote className="mt-2">
        {histogram ? t("histogram.source") : t("chamberTrendSource")}
      </SourceNote>
    </>
  );
}

export default memo(ChamberChart);
