"use client";

/**
 * Skládaný rozklad skóre — kolik bodů přinesla která z ŠESTI zveřejněných
 * složek indexu přispění (reálné body z loaderu, ne mockové pilíře).
 * Šířka segmentu = zveřejněné body složky; součet ≈ kompozit (zaokrouhlení
 * na desetiny — poznámka pod grafem to přiznává, viz getLeaderboardData.ts).
 * Kliknutí na pruh vybírá poslance (stejný stav jako řádky žebříčku).
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComponentDef, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import { COMPONENT_FILL } from "@/features/civicscore/componentFill";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { HAIRLINE, INK, PAPER_STRONG, STEEL, TOOLTIP_STYLE } from "../palette";

export default function ScoreBreakdown({
  entries,
  components,
  selectedId,
  onSelect,
}: {
  entries: LeaderboardListEntry[];
  components: ComponentDef[];
  selectedId: number;
  onSelect: (pspId: number) => void;
}) {
  const t = useTranslations("landing");
  const f = useFormat();

  // Reálné body složek — klíčováno stabilním c.key; label jde jen jako
  // `name` na <Bar> pro tooltip.
  const stackedData = useMemo(
    () =>
      entries.map((e) => ({
        id: e.pspId,
        name: e.name.split(" ").at(-1) ?? e.name,
        ...e.components,
      })),
    [entries],
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
            {components.map((c) => {
              const fill = COMPONENT_FILL[c.key];
              return (
                <Bar
                  key={c.key}
                  dataKey={c.key}
                  name={c.label}
                  stackId="kompozit"
                  fill={fill.color}
                  onClick={(entry) => {
                    const id = (entry as unknown as { payload?: { id?: number } }).payload?.id;
                    if (id) onSelect(id);
                  }}
                  cursor="pointer"
                >
                  {entries.map((e) => (
                    <Cell
                      key={e.pspId}
                      fillOpacity={(e.pspId === selectedId ? 1 : 0.38) * (fill.opacity ?? 1)}
                    />
                  ))}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {components.map((c) => {
          const fill = COMPONENT_FILL[c.key];
          return (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-steel-aa"
            >
              <span
                className="inline-block h-2.5 w-2.5"
                style={{ background: fill.color, opacity: fill.opacity ?? 1 }}
              />
              {c.label} × {c.weight}
            </span>
          );
        })}
      </div>
      <SourceNote className="mt-2">{t("breakdownFootnote")}</SourceNote>
    </div>
  );
}
