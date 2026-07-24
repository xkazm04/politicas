"use client";

/*
 * Poctivý korektiv nízkého skóre (Case ② build, batch 002 — O-effort-2).
 * REÁLNÁ DATA: čte `effort_low_score_reason` (+ volitelně `effort_public_role`)
 * z uzlu poslance — hodnoty píše enrichment stage effort-loopu z uzavřeného
 * slovníku (lib/analysis/low-score-reason.ts), nikdy ne LLM ad hoc.
 *
 * Batch 001 zjistil, že v mladém období spodek žebříčku ovládají strukturální
 * artefakty (mandátu se vzdal, souběžný úřad, předání vlády), ne nezájem — a
 * že křížová vazba "absentee manager" na tyto MP dávala falešně pozitivní
 * poplach. Tenhle štítek dělá nápravu čitelnou přímo ve spisu poslance:
 * číslo zůstává nedotčené, ale profil poctivě řekne PROČ je nízké.
 *
 * Degraduje čestně: bez uloženého důvodu (nebo s hodnotou mimo slovník) se
 * nevykresluje vůbec — žádný vymyšlený text. `genuine_absentee` je záměrně
 * NE-korektiv (viz copy) a dostává neutrální, ne pozitivní tón.
 *
 * Copy je český inline literál (fleet: messages/*.json je sdílený soubor a
 * needitujeme ho z hranice tohoto case — navržené i18n klíče jsou v handoffu,
 * stejně jako u TrendPanel).
 */

import { ShieldCheck, Info } from "lucide-react";
import { lowScoreReasonCopy } from "@/lib/analysis/low-score-reason";
import SourceNote from "@/features/shared/components/SourceNote";

export default function LowScoreReasonBadge({
  reason,
  publicRole,
}: {
  reason: string | null;
  publicRole?: string | null;
}) {
  const copy = lowScoreReasonCopy(reason);
  if (!copy) return null;

  const positive = copy.tone === "positive";
  const Icon = positive ? ShieldCheck : Info;

  return (
    <div
      className={`mt-6 flex items-start gap-3 border-2 p-4 ${
        positive ? "border-cobalt bg-cobalt/5" : "border-hairline bg-paper-strong"
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${positive ? "text-cobalt" : "text-steel"}`} aria-hidden />
      <div className="min-w-0">
        <p className={`font-mono text-xs font-bold uppercase tracking-widest ${positive ? "text-cobalt" : "text-steel"}`}>
          {copy.badge}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{copy.detail}</p>
        {publicRole && <p className="mt-1.5 text-sm italic leading-relaxed text-steel">{publicRole}</p>}
        <SourceNote className="mt-2 !text-[10px]">
          zdroj: effort-loop enrichment (psp.cz + veřejné registry) · effort_low_score_reason
        </SourceNote>
      </div>
    </div>
  );
}
