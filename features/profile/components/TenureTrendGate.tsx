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
  if (!trend) return null;

  if (isTrendTooEarly(tenureDays)) {
    const unknown = typeof tenureDays !== "number" || !Number.isFinite(tenureDays);
    return (
      <div className="mt-10 border-2 border-dashed border-hairline p-6">
        <p className="text-sm leading-relaxed text-steel">
          {unknown
            ? `Délku mandátu se nepodařilo určit, takže srovnání s obdobím ${trend.priorTerm} zatím neukazujeme — sazby (účast, docházka) by mohly být zavádějící bez jistoty, na kolika hlasováních jsou postavené.`
            : `Na srovnání s obdobím ${trend.priorTerm} je zatím brzy — mandát trvá teprve krátce a sazby (účast, docházka) by byly zavádějící na tak malém počtu hlasování.`}
        </p>
        <SourceNote className="mt-2 !text-[10px]">
          zdroj: effort_tenure_days · práh {TREND_MIN_TENURE_DAYS} dní
        </SourceNote>
      </div>
    );
  }

  return <TrendPanel trend={trend} componentLabels={componentLabels} />;
}
