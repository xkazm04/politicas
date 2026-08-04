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
 *
 * `effort_psp9_trend_note` (13/207 uzlů, 6 projde public-copy bránou) je
 * JEDINÁ mezidobová próza, kterou graf drží — analytikovo čtení téhož
 * srovnání, které panel počítá. Do teď se nevykreslovala nikde. Vykresluje se
 * v OBOU větvích: vedle panelu, i tam, kde je panel potlačen — potlačené sazby
 * nejsou důvod ztratit srovnání celé, jen důvod netisknout čísla. Verbatim,
 * datovaně (`effort_provenance.computedAt`) a označeně jako analytická próza,
 * stejně jako `effort_notes` v dosieru. Nedatovaná próza se nedopočítává na
 * dnešek — chybějící datum se přizná.
 */

import { profileIntl } from "../serverIntl";
import type { ComponentKey, ContributionTrend } from "@/lib/analysis/contribution-trend";
import { isTrendTooEarly, TREND_MIN_TENURE_DAYS } from "@/lib/analysis/tenure-copy";
import TrendPanel from "@/features/civicscore/components/TrendPanel";
import SourceNote from "@/features/shared/components/SourceNote";
import ExpandableText from "./ExpandableText";

export default async function TenureTrendGate({
  trend,
  componentLabels,
  tenureDays,
  psp9TrendNote,
  recordedAt,
}: {
  trend: ContributionTrend | null;
  componentLabels: Partial<Record<ComponentKey, string>>;
  tenureDays: number | null;
  /** `effort_psp9_trend_note`, already past the public-copy guard (getProfileData). */
  psp9TrendNote?: string | null;
  /** `effort_provenance.computedAt` — null = nedatováno, nikdy se nedopočítává. */
  recordedAt?: string | null;
}) {
  const { t, f } = await profileIntl();

  // Analytikova mezidobová próza. Stojí vedle panelu i místo něj — a vykreslí se
  // i tehdy, když `trend` chybí: potlačit reálný datovaný fakt jen proto, že
  // odvozený panel není, je právě to mlčení, které tenhle průchod odstraňuje.
  const note = psp9TrendNote ? (
    <div className="mt-6 max-w-3xl border-l-4 border-hairline pl-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {t("trendNoteHeading")}
      </p>
      <ExpandableText className="mt-2 text-[15px] leading-relaxed text-steel" text={psp9TrendNote} />
      <SourceNote className="mt-2 !text-[10px]">
        {recordedAt ? t("trendNoteSourceDated", { date: f.date(recordedAt) }) : t("trendNoteSource")}
      </SourceNote>
    </div>
  ) : null;

  if (!trend) return note;

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
        {note}
      </div>
    );
  }

  return (
    <>
      <TrendPanel trend={trend} componentLabels={componentLabels} />
      {note}
    </>
  );
}
