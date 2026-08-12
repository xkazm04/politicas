"use client";

/*
 * Poctivý korektiv nízkého skóre — ŘÁDKOVÁ podoba (žebříček /zebricek).
 *
 * REÁLNÁ DATA: `effort_low_score_reason` z uzlu poslance, uzavřený slovník
 * (lib/analysis/low-score-reason.ts) psaný enrichment stagí effort-loopu.
 * 34 z 207 poslanců ho nese (měřeno nad živým grafem 2026-08-04).
 *
 * PROČ TU JE: štítek existoval jen ve spisu (/poslanec). Žebříček tak u
 * poslance, který se mandátu vzdal před složením slibu, tiskl nízké číslo a
 * NIC vedle něj — z pořadí se stalo obvinění z nezájmu. Tenhle čip je totéž
 * zjištění na místě, kde vzniká dojem.
 *
 * DVĚ PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT:
 *  1. Text je VERBATIM z uzavřeného slovníku — aplikace ho nesmí přebásnit do
 *     omluvy. `genuine_absentee` je záměrně NE-korektiv a jeho vlastní copy to
 *     říká; čip mu proto nedává pozitivní tón.
 *  2. Korektiv je DATOVANÉ tvrzení. `recordedAt` je `effort_provenance
 *     .computedAt` — kdy to enrichment zaznamenal; bez data se datum netiskne,
 *     nikdy se nedopočítává na dnešek.
 *
 * Degraduje čestně: hodnota mimo slovník (nebo žádná) → nevykreslí se vůbec.
 */

import { Info, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { lowScoreReasonCopy } from "@/lib/analysis/low-score-reason";

export default function LowScoreReasonChip({
  reason,
  recordedAt,
  dateLabel,
}: {
  reason: string | null;
  /** ISO datum záznamu korektivu (`effort_provenance.computedAt`), nebo null. */
  recordedAt?: string | null;
  /** Už zformátované datum (přes useFormat u volajícího) — čip sám nic neformátuje. */
  dateLabel?: string | null;
}) {
  const t = useTranslations("civicscore");
  /** Uzavřený verdiktní slovník — text od 2026-08-12 v katalogu (`verdicts`),
   *  ne v lib/analysis; pravidlo „verbatim, aplikace verdikt nepřebásňuje" platí
   *  dál, jen ho drží katalog a jazyková brána nad ním. */
  const tv = useTranslations("verdicts");
  const copy = lowScoreReasonCopy(reason);
  if (!copy) return null;

  const positive = copy.tone === "positive";
  const Icon = positive ? ShieldCheck : Info;
  const detail = tv(copy.detailKey);
  const dated = recordedAt && dateLabel ? `${detail} ${t("recordedAt", { date: dateLabel })}` : detail;

  return (
    <span
      title={dated}
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
        positive ? "border-cobalt bg-cobalt/5 text-cobalt" : "border-hairline bg-paper-strong text-steel-aa"
      }`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {tv(copy.badgeKey)}
      <span className="sr-only"> — {dated}</span>
    </span>
  );
}
