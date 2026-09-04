"use client";

/**
 * @catalog Rung štítku verdiktu — „strojově odvozeno" vs „ověřeno (kdo, kdy)".
 *
 * Každý verdikt, který aplikace vysloví o KONKRÉTNÍM ČLOVĚKU, stojí na nějakém
 * stupni žebříčku tvrzení. Do 2026-09-04 se stupeň nikde netiskl: „tichý tvůrce
 * zákonů" u jména poslance vypadal stejně, ať ho napsal deterministický průchod
 * grafu, nebo ho potvrdila redakce. Tenhle prvek ten rozdíl vysloví.
 *
 * ČTYŘI STUPNĚ, a proč ne tři:
 *   machine   pipeline to odvodila, nikdo se na to nedíval — VÝCHOZÍ stav;
 *   pending   člověk se na to díval a POSLAL TO ZPĚT (jiný fakt než „nikdo
 *             se nedíval", a čtenář má na ten rozdíl nárok);
 *   verified  člověk to potvrdil — se jménem a datem;
 *   rejected  člověk to odmítl.
 *
 * ODMÍTNUTÝ VERDIKT SE ZAMLČUJE, NEVYPRÁZDNÍ SE. Zmizelý štítek by čtenář četl
 * jako „tenhle poslanec tichý pracant NENÍ" — druhé tvrzení, vyslovené mlčky,
 * o kterém nikdo nerozhodl. Volající proto u `rejected` nekreslí samotné tvrzení
 * a místo něj vykreslí tenhle prvek s `withheld` — poctivý prázdný stav, který
 * je vidět.
 *
 * ČISTĚ PREZENTAČNÍ: nečte store, nepočítá stupeň, nic neformátuje sám. Stupeň
 * odvozuje `lib/analysis/verdict-provenance.ts` (readVerdictRung) na serveru,
 * datum formátuje volající jedinou formátovací autoritou (lib/format.ts přes
 * useFormat) a předává ho už zformátované — katalogový prvek nesmí sahat ani na
 * doménová data, ani na Intl.
 */

import { BadgeCheck, Ban, Cpu, Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";

/** Mirrors `VerdictRung` in lib/analysis/verdict-provenance.ts — repeated here
 *  rather than imported so the catalog keeps its no-domain-imports boundary. */
export type VerdictRungName = "machine" | "pending" | "verified" | "rejected";

const ICON: Record<VerdictRungName, typeof Cpu> = {
  machine: Cpu,
  pending: Hourglass,
  verified: BadgeCheck,
  rejected: Ban,
};

/** Poster language: cobalt = calm/confirmed, ochre = waiting, signal = refusal,
 *  steel = machine (an unremarkable default, not a warning). Tokens only. */
const TONE: Record<VerdictRungName, string> = {
  machine: "border-hairline bg-paper-strong text-steel-aa",
  pending: "border-ochre bg-ochre/5 text-ochre",
  verified: "border-cobalt bg-cobalt/5 text-cobalt",
  rejected: "border-signal bg-signal/5 text-signal",
};

export default function VerdictProvenance({
  rung,
  decidedBy = null,
  decidedAtLabel = null,
  withheld = false,
  compact = false,
}: {
  rung: VerdictRungName;
  /** Kdo rozhodl. U `machine` je vždy null — stroj nemá jméno. */
  decidedBy?: string | null;
  /** UŽ ZFORMÁTOVANÉ datum rozhodnutí (volající přes useFormat), nebo null.
   *  Prvek sám nikdy nic neformátuje a nikdy nedopočítává datum na dnešek. */
  decidedAtLabel?: string | null;
  /** True u odmítnutého verdiktu: prvek stojí NAMÍSTO tvrzení, ne vedle něj. */
  withheld?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("shared.verdict");

  // Attribution is printed only when it EXISTS. A „verified" with no recorded
  // decider renders as verified, unattributed — never as „ověřeno (—)", which
  // would look like a redacted name rather than an absent record.
  const attribution =
    decidedBy && decidedAtLabel
      ? t("byOn", { kdo: decidedBy, kdy: decidedAtLabel })
      : decidedBy
        ? t("by", { kdo: decidedBy })
        : null;

  const label = withheld ? t("withheld") : t(rung);
  const full = attribution ? `${label} — ${attribution}` : label;
  const Icon = ICON[rung];

  const size = compact
    ? "gap-1 border px-1.5 py-0.5 text-[9px]"
    : "gap-1.5 border px-2 py-0.5 text-[10px]";

  return (
    <span
      title={full}
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider ${TONE[rung]} ${size}`}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {label}
      {attribution && !compact && <span className="font-normal normal-case tracking-normal">· {attribution}</span>}
      <span className="sr-only"> — {full}</span>
    </span>
  );
}
