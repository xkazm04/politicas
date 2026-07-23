"use client";

/** Vývoj kompozitu vybraného poslance přes 6 čtvrtletí — plochá area. */

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MP } from "@/lib/civic/data";
import { TREND_QUARTERS } from "@/lib/civic/data";
import { czech } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, SIGNAL, STEEL, TOOLTIP_STYLE } from "../palette";

export default function TrendChart({ mp }: { mp: MP }) {
  const reduceMotion = useReducedMotion();
  const data = useMemo(() => mp.trend.map((v, i) => ({ q: TREND_QUARTERS[i], skóre: v })), [mp]);

  return (
    <div>
      <SourceNote>
        vývoj kompozitu — {mp.name} · {TREND_QUARTERS.length} čtvrtletí
      </SourceNote>
      <div className="mt-3 w-full overflow-hidden" style={{ aspectRatio: "5 / 2", minHeight: 150 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={HAIRLINE} vertical={false} />
            <XAxis
              dataKey="q"
              tick={{ fill: STEEL, fontSize: 11, fontFamily: "var(--font-plex)" }}
              tickLine={false}
              axisLine={{ stroke: INK, strokeWidth: 2 }}
            />
            <YAxis
              domain={["dataMin - 4", "dataMax + 4"]}
              tick={{ fill: STEEL, fontSize: 11, fontFamily: "var(--font-plex)" }}
              tickFormatter={(v: number) => czech(v)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: INK, strokeDasharray: "4 4" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [czech(Number(value)), "kompozit"]}
            />
            <Area
              type="linear"
              dataKey="skóre"
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
      <SourceNote className="mt-2 !text-[10px]">
        zdroj: psp.cz · hlídač státu · registr smluv — přepočet metodikou v1.4
      </SourceNote>
    </div>
  );
}
