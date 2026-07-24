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
 * Degraduje čestně: bez `effort_workhorse_flavour` (nebo s hodnotou mimo
 * slovník) se nevykresluje vůbec.
 */

import { Gavel, ShieldCheck } from "lucide-react";
import { workhorseFlavourCopy, type WorkhorseFlavour } from "@/lib/analysis/workhorse-flavour";

const ICON: Record<WorkhorseFlavour, typeof Gavel> = {
  legislative: Gavel,
  oversight: ShieldCheck,
};

export default function WorkhorseBadge({
  flavour,
  compact = false,
}: {
  flavour: string | null;
  compact?: boolean;
}) {
  const copy = workhorseFlavourCopy(flavour);
  if (!copy) return null;
  const Icon = ICON[flavour as WorkhorseFlavour];

  if (compact) {
    return (
      <span
        title={copy.detail}
        className="inline-flex items-center gap-1 border border-cobalt bg-cobalt/5 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cobalt"
      >
        <Icon className="h-2.5 w-2.5" aria-hidden />
        {copy.badge}
      </span>
    );
  }

  return (
    <span
      title={copy.detail}
      className="inline-flex items-center gap-1.5 border-2 border-cobalt bg-cobalt/5 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {copy.badge}
    </span>
  );
}
