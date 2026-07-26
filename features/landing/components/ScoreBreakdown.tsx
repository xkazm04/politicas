"use client";

/**
 * Skládaný rozklad skóre — kolik bodů přinesl který pilíř.
 * Šířka segmentu = pilíř × zveřejněná váha, součet = kompozit.
 * Kliknutí na pruh vybírá poslance (stejný stav jako řádky žebříčku).
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MPS, PILLARS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, PAPER_STRONG, PILLAR_FILL, STEEL, TOOLTIP_STYLE } from "../palette";

export default function ScoreBreakdown({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("landing");
  const tc = useTranslations("content");
  const f = useFormat();

  // Pilíře v pořadí PILLARS; klíč série = lokalizovaný label (zobrazí se v tooltipu).
  const pillarLabels = useMemo(
    () => PILLARS.map((p) => ({ key: p.key, weight: p.weight, label: tc(`pillars.${p.key}.label`) })),
    [tc],
  );

  // Vážené příspěvky se nemění s výběrem, jen zvýraznění. Klíčováno stabilním
  // p.key (enum), NE lokalizovaným labelem — dva pilíře se stejným přeloženým
  // textem by jinak přes Object.fromEntries tiše přepsaly jeden druhým a jeden
  // pilíř by z grafu beze stopy zmizel. Label se předává jen jako `name` na
  // <Bar> níže, čistě pro zobrazení v tooltipu.
  const stackedData = useMemo(
    () =>
      MPS.map((m) => ({
        id: m.id,
        name: m.name.split(" ").at(-1) ?? m.name,
        ...(Object.fromEntries(
          pillarLabels.map((p) => [p.key, Math.round(m.pillars[p.key] * p.weight * 10) / 10]),
        ) as Record<string, number>),
      })),
    [pillarLabels],
  );

  return (
    <div>
      <SourceNote>{t("breakdownSource")}</SourceNote>
      <div className="mt-3 w-full overflow-hidden" style={{ aspectRatio: "5 / 3", minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={stackedData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
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
              formatter={(value, name) => [t("breakdownTooltipUnit", { value: f.dec(Number(value)) }), String(name)]}
            />
            {pillarLabels.map((p) => (
              <Bar
                key={p.key}
                dataKey={p.key}
                name={p.label}
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
        {pillarLabels.map((p) => (
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
