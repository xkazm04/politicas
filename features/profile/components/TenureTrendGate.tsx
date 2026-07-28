"use client";

/*
 * Tenure-aware brána pro TrendPanel (Case ② build, batch 005).
 *
 * TrendPanel (features/civicscore/components/TrendPanel.tsx) srovnává
 * PSP9→PSP10 SAZBY (účast, docházka) mezi obdobími — u poslance, který ve
 * Sněmovně sedí pár týdnů, je taková sazba statisticky nesmyslná (dělitel je
 * pár desítek hlasování místo stovek). Tahle brána sedí PŘED TrendPanel v
 * boundary tohoto case (features/profile/**) — TrendPanel samotný je
 * sdílená komponenta jiného case (civicscore) a needitujeme ho odsud.
 *
 * Pod `TREND_MIN_TENURE_DAYS` (lib/analysis/tenure-copy.ts) srovnání
 * potlačíme a místo něj ukážeme čestný "na srovnání je brzy" stav —
 * stejný "graceful null" princip jako LowScoreReasonBadge/TenureNote, jen
 * s viditelným (ne prázdným) odstavcem, protože tady jde o VYSVĚTLENÍ
 * nepřítomnosti panelu, ne jen o jeho vynechání.
 */

import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import type { ComponentKey, ContributionTrend } from "@/lib/analysis/contribution-trend";
import { isTrendTooEarly, TREND_MIN_TENURE_DAYS } from "@/lib/analysis/tenure-copy";
import TrendPanel from "@/features/civicscore/components/TrendPanel";
import SourceNote from "@/features/shared/components/SourceNote";

export default function TenureTrendGate({
  trend,
  componentLabels,
  tenureDays,
}: {
  trend: ContributionTrend | null;
  componentLabels: Partial<Record<ComponentKey, string>>;
  tenureDays: number | null;
}) {
  const t = useTranslations("profile");
  const f = useFormat();
  if (!trend) return null;

  if (isTrendTooEarly(tenureDays)) {
    const unknown = typeof tenureDays !== "number" || !Number.isFinite(tenureDays);
    return (
      <div className="mt-10 border-2 border-dashed border-hairline p-6">
        <p className="text-sm leading-relaxed text-steel">
          {unknown
            ? t("trendTenureUnknown", { term: trend.priorTerm })
            : t("trendTooEarly", { term: trend.priorTerm })}
        </p>
        <SourceNote className="mt-2 !text-[10px]">
          {t("trendGateSource", { days: f.int(TREND_MIN_TENURE_DAYS) })}
        </SourceNote>
      </div>
    );
  }

  return <TrendPanel trend={trend} componentLabels={componentLabels} />;
}
