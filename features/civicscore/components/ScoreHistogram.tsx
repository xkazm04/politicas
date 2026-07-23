"use client";

/**
 * Rozložení sněmovny — histogram kompozitů po 5 bodech + počítaný souhrn.
 * Vše z LEADERBOARD (jediný zdroj pravdy); dlaždice velína jsou k témuž
 * souhrnu přišité testem.
 */

import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHAMBER_SUMMARY, SCORE_HISTOGRAM } from "@/lib/civic/leaderboard";
import { czech } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import { COBALT, HAIRLINE, INK, PAPER_STRONG, SIGNAL, STEEL, TOOLTIP_STYLE } from "@/features/landing/palette";

const SUMMARY_TILES = [
  { label: "průměr", value: czech(CHAMBER_SUMMARY.avg) },
  { label: "medián", value: czech(CHAMBER_SUMMARY.median) },
  { label: "rozptyl σ", value: czech(CHAMBER_SUMMARY.sigma) },
];

const CHART_TICK = { fill: STEEL, fontSize: 12, fontFamily: "var(--font-plex)" } as const;

export default function ScoreHistogram() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-10 lg:grid-cols-[8fr_4fr]">
      <div className="min-w-0">
        <div className="w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={SCORE_HISTOGRAM} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={HAIRLINE} vertical={false} />
              <XAxis dataKey="label" tick={{ ...CHART_TICK, fontSize: 11 }} tickLine={false} axisLine={{ stroke: INK, strokeWidth: 2 }} interval={0} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: PAPER_STRONG }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [`${value} poslanců`, "v pásmu"]}
              />
              <Bar dataKey="count" isAnimationActive={!reduceMotion}>
                {SCORE_HISTOGRAM.map((b) => (
                  <Cell key={b.from} fill={b.from >= 55 ? COBALT : SIGNAL} fillOpacity={b.from >= 55 ? 1 : 0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2">
          <SourceNote>
            histogram kompozitů po 5 b. · signální = pod mediánem sněmovny · civicscore v1.4
          </SourceNote>
        </div>
      </div>
      <div className="grid content-start gap-px self-start border border-ink bg-ink">
        {SUMMARY_TILES.map((t) => (
          <div key={t.label} className="flex items-baseline justify-between gap-4 bg-paper px-5 py-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{t.label}</span>
            <span className="text-3xl font-black tabular-nums">{t.value}</span>
          </div>
        ))}
        <div className="bg-paper px-5 py-4">
          <SourceNote className="!text-[10px]">počítáno z plného žebříčku 200 poslanců</SourceNote>
        </div>
      </div>
    </div>
  );
}
