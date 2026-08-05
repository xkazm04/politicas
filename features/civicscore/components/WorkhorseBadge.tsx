"use client";

/*
 * Tichý pracant — štítek flavouru (Case ② build, batch 003 — O-effort-3).
 * REÁLNÁ DATA: čte `effort_workhorse` + `effort_workhorse_flavour` z uzlu
 * poslance — hodnotu z uzavřeného slovníku (lib/analysis/workhorse-flavour.ts),
 * psanou deterministicky (scripts/case-loops/effort/workhorse-flavour.ts) z
 * triage lens `quiet_workhorse` (P31: vysoká výborová/legislativní práce, nízká
 * viditelnost v sále). SOUMĚRNÉ zacházení s oběma flavours (legislativní i
 * kontrolní) — stejná velikost štítku, stejný tón, žádná hierarchie.
 *
 * DATUM A ČÍSLO (2026-08-04) — do té doby to bylo jediné tvrzení na žebříčku
 * i ve spisu, které stálo BEZ data a BEZ čísla: „tichý tvůrce zákonů" jako holý
 * přívlastek. LowScoreReasonChip vedle něj přitom drží standard, který tenhle
 * štítek teď dodržuje taky:
 *   1. copy je VERBATIM z uzavřeného slovníku — aplikace verdikt nepřebásňuje
 *      do chvály; druhá polovina tvrzení („málo vystoupení v sále") jde s ním;
 *   2. je to DATOVANÉ tvrzení — `recordedAt` je `effort_provenance.computedAt`,
 *      tedy kdy to enrichment zaznamenal; bez data se datum netiskne a NIKDY se
 *      nedopočítává na dnešek;
 *   3. nese ČÍSLO, o které se opírá — počet vystoupení v sále (`speech_turns`),
 *      právě tu veličinu, jejíž nízkost je půlka verdiktu. Chybějící údaj se
 *      nevykreslí jako nula: „0 vystoupení" by byla fabrikace, ne mlčení.
 *
 * Degraduje čestně: bez `effort_workhorse_flavour` (nebo s hodnotou mimo
 * slovník) se nevykresluje vůbec.
 */

import { Gavel, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { workhorseFlavourCopy, type WorkhorseFlavour } from "@/lib/analysis/workhorse-flavour";

const ICON: Record<WorkhorseFlavour, typeof Gavel> = {
  legislative: Gavel,
  oversight: ShieldCheck,
};

export default function WorkhorseBadge({
  flavour,
  speechTurns = null,
  recordedAt = null,
  compact = false,
}: {
  flavour: string | null;
  /** `speech_turns` — vystoupení v sále; číslo, o které se „tichý" opírá. Null = údaj chybí. */
  speechTurns?: number | null;
  /** ISO datum záznamu verdiktu (`effort_provenance.computedAt`), nebo null. */
  recordedAt?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const copy = workhorseFlavourCopy(flavour);
  if (!copy) return null;
  const Icon = ICON[flavour as WorkhorseFlavour];

  const turns = speechTurns != null ? f.int(speechTurns) : null;
  const claim =
    copy.detail +
    (turns ? ` ${t("workhorseSpeechClaim", { turns })}` : "") +
    (recordedAt ? ` ${t("recordedAt", { date: f.date(recordedAt) })}` : "");

  const size = compact
    ? "gap-1 border px-1.5 py-0.5 text-[9px]"
    : "gap-1.5 border-2 px-2.5 py-1 text-[11px]";

  return (
    <span
      title={claim}
      className={`inline-flex items-center border-cobalt bg-cobalt/5 font-mono font-bold uppercase tracking-wider text-cobalt ${size}`}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} aria-hidden />
      {copy.badge}
      {turns && <span className="tabular-nums">· {t("workhorseTurnsShort", { turns })}</span>}
      <span className="sr-only"> — {claim}</span>
    </span>
  );
}
