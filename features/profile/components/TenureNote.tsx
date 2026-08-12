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

import { profileIntl } from "../serverIntl";
import { mandateNoteCopy } from "@/lib/analysis/tenure-copy";
import SourceNote from "@/features/shared/components/SourceNote";

export default async function TenureNote({
  tenureClass,
  tenureStart,
  tenureEnd,
  termNumber,
}: {
  tenureClass: string | null;
  tenureStart: string | null;
  tenureEnd?: string | null;
  /** Číslo volebního období z `termNumberOf(TERM)` (ProfileData.termNumber), NIKDY
   *  literál v katalogu: citace psala „PSP10" nad loaderem, který ten kód drží
   *  jako konstantu — týž rozchod, který /zebricek i /penize už opravovaly. Když
   *  kód období nemá tvar PSP<n>, období se prostě netvrdí (vzor `periodNote` /
   *  `periodNoteUnknown` v hlavičce spisu). */
  termNumber?: number | null;
}) {
  const { t, f } = await profileIntl();
  const copy = mandateNoteCopy(tenureClass, tenureStart, tenureEnd);
  if (!copy) return null;

  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-steel">{copy.detail}</p>
      <SourceNote className="mt-1 !text-[10px]">
        {termNumber != null ? t("tenureSource", { term: f.int(termNumber) }) : t("tenureSourceUnknownTerm")}
      </SourceNote>
    </div>
  );
}
