"use client";

/**
 * Skládaný rozklad skóre — kolik bodů přinesl který pilíř.
 * Šířka segmentu = pilíř × zveřejněná váha, součet = kompozit.
 * Kliknutí na pruh vybírá poslance (stejný stav jako řádky žebříčku).
 */

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MPS, PILLARS } from "@/lib/civic/data";
import { czech } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, PAPER_STRONG, PILLAR_FILL, STEEL, TOOLTIP_STYLE } from "../palette";

// Statická data — vážené příspěvky se nemění s výběrem, jen zvýraznění.
const STACKED_DATA = MPS.map((m) => ({
  id: m.id,
  name: m.name.split(" ").at(-1) ?? m.name,
  ...(Object.fromEntries(
    PILLARS.map((p) => [p.label, Math.round(m.pillars[p.key] * p.weight * 10) / 10]),
  ) as Record<string, number>),
}));

export default function ScoreBreakdown({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <SourceNote>rozklad skóre — kolik bodů přinesl který pilíř</SourceNote>
      <div className="mt-3 w-full overflow-hidden" style={{ aspectRatio: "5 / 3", minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={STACKED_DATA} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={HAIRLINE} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: STEEL, fontSize: 11, fontFamily: "var(--font-plex)" }}
              tickLine={false}
              axisLine={{ stroke: INK, strokeWidth: 2 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={82}
              tick={{ fill: INK, fontSize: 12, fontFamily: "var(--font-plex)", fontWeight: 700 }}
              tickLine={false}
              axisLine={{ stroke: INK, strokeWidth: 2 }}
            />
            <Tooltip
              cursor={{ fill: PAPER_STRONG }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${czech(Number(value))} b.`, String(name)]}
            />
            {PILLARS.map((p) => (
              <Bar
                key={p.key}
                dataKey={p.label}
                stackId="kompozit"
                fill={PILLAR_FILL[p.key]}
                onClick={(entry) => {
                  const id = (entry as unknown as { payload?: { id?: string } }).payload?.id;
                  if (id) onSelect(id);
                }}
                cursor="pointer"
              >
                {MPS.map((m) => (
                  <Cell key={m.id} fillOpacity={m.id === selectedId ? 1 : 0.38} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {PILLARS.map((p) => (
          <span
            key={p.key}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel"
          >
            <span className="inline-block h-2.5 w-2.5" style={{ background: PILLAR_FILL[p.key] }} />
            {p.label} × {p.weight}
          </span>
        ))}
      </div>
    </div>
  );
}
