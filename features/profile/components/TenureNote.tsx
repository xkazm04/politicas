"use client";

/*
 * Mandátová poznámka (Case ② build, batch 005 — tenure-aware profile copy).
 * REÁLNÁ DATA: čte `effort_tenure_class` + `effort_tenure_start`/`effort_tenure_end`
 * z uzlu poslance — hodnoty píše deterministický skript
 * scripts/case-loops/effort/tenure.ts (membership.fromAt/toAt na organu 174),
 * nikdy ne LLM ad hoc.
 *
 * Batch 002/003 zjistily, že náhradníci a poslanci, kteří odešli v průběhu
 * období, mají nízké skóre jako artefakt kratší reálné doby ve Sněmovně
 * (viz LowScoreReasonBadge "replacement"/P38) — tahle poznámka dělá tu dobu
 * čitelnou přímo v hlavičce spisu, nezávisle na tom, jestli enrichment stage
 * už doplnila `effort_low_score_reason`.
 *
 * Degraduje čestně: pro `full_term` a `never_seated` (a pro chybějící/
 * nerozpoznanou třídu nebo datum) se nevykresluje vůbec — žádné vymyšlené
 * datum. Viz lib/analysis/tenure-copy.ts pro čistou logiku.
 */

import { mandateNoteCopy } from "@/lib/analysis/tenure-copy";
import SourceNote from "@/features/shared/components/SourceNote";

export default function TenureNote({
  tenureClass,
  tenureStart,
  tenureEnd,
}: {
  tenureClass: string | null;
  tenureStart: string | null;
  tenureEnd?: string | null;
}) {
  const copy = mandateNoteCopy(tenureClass, tenureStart, tenureEnd);
  if (!copy) return null;

  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-steel">{copy.detail}</p>
      <SourceNote className="mt-1 !text-[10px]">
        zdroj: psp.cz · členství v organu 174 (PSP10) · effort_tenure_start/effort_tenure_end
      </SourceNote>
    </div>
  );
}
