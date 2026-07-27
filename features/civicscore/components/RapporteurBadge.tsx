"use client";

/*
 * Zpravodajský tahoun — štítek zpravodajské zátěže (Case ② build, batch 008).
 * REÁLNÁ DATA: čte `effort_rapporteur_load` z uzlu poslance — deterministický
 * počet různých návrhů zákona, u nichž poslanec drží roli zpravodaje (psp.cz
 * tisky.zip, průchod grafu 34/36; scripts/case-loops/effort/rapporteur-load.ts).
 *
 * Záměrně NENÍ třetím flavourem „tichého pracanta“: zpravodajská zátěž nic
 * neříká o viditelnosti v sále (nejvytíženější zpravodajka je zároveň jednou
 * z nejčastějších řečnic). Práh a copy v lib/analysis/rapporteur-load.ts;
 * pod prahem se nevykresluje vůbec (čestná degradace).
 */

import { FileSearch } from "lucide-react";
import { rapporteurLoadCopy } from "@/lib/analysis/rapporteur-load";

export default function RapporteurBadge({ load, compact = false }: { load: number; compact?: boolean }) {
  const copy = rapporteurLoadCopy(load);
  if (!copy) return null;

  if (compact) {
    return (
      <span
        title={copy.detail}
        className="inline-flex items-center gap-1 border border-ochre bg-ochre/5 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ochre"
      >
        <FileSearch className="h-2.5 w-2.5" aria-hidden />
        {copy.badge}
      </span>
    );
  }

  return (
    <span
      title={copy.detail}
      className="inline-flex items-center gap-1.5 border-2 border-ochre bg-ochre/5 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ochre"
    >
      <FileSearch className="h-3.5 w-3.5" aria-hidden />
      {copy.badge} · {copy.load}
    </span>
  );
}
