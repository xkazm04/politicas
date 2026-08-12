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
 *
 * DATUM A ČÍSLO V OBOU HUSTOTÁCH (2026-08-04) — počet se dřív tiskl jen ve
 * spisu; na žebříčku (compact) stálo „zpravodajský tahoun" bez čísla, takže
 * zpravodaj tří tisků a zpravodaj třinácti vypadali stejně. Teď platí týž
 * standard jako u LowScoreReasonChip: číslo jde s verdiktem v obou hustotách,
 * projde jedinou formátovací autoritou (lib/format.ts) a tvrzení je DATOVANÉ
 * `effort_provenance.computedAt` — bez data se datum netiskne, nikdy se
 * nedopočítává na dnešek.
 */

import { FileSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { rapporteurLoadCopy } from "@/lib/analysis/rapporteur-load";

export default function RapporteurBadge({
  load,
  recordedAt = null,
  compact = false,
}: {
  load: number;
  /** ISO datum záznamu verdiktu (`effort_provenance.computedAt`), nebo null. */
  recordedAt?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("civicscore");
  /** Verdiktní slovník — `verdicts` (od 2026-08-12 v katalogu, ne v lib/analysis). */
  const tv = useTranslations("verdicts");
  const f = useFormat();
  const copy = rapporteurLoadCopy(load);
  if (!copy) return null;

  // Číslo verdiktu prochází jedinou formátovací autoritou (lib/format.ts přes useFormat).
  // Citaci zdroje (psp.cz tisky.zip / pass 34) nese sekce, ve které štítek stojí —
  // DossierSection má vlastní SourceNote, řádek žebříčku citaci celé tabulky.
  const loadLabel = f.int(copy.load);
  // Počet vstupuje do věty UŽ ZFORMÁTOVANÝ (lib/format.ts) — next-intl by ho
  // jinak protáhl vlastním Intl.NumberFormat, tedy mimo jedinou formátovací
  // autoritu aplikace (a s rizikem rozchodu SSR/CSR).
  const claim =
    tv(copy.detailKey, { load: loadLabel }) +
    (recordedAt ? ` ${t("recordedAt", { date: f.date(recordedAt) })}` : "");
  const size = compact
    ? "gap-1 border px-1.5 py-0.5 text-[9px]"
    : "gap-1.5 border-2 px-2.5 py-1 text-[11px]";

  return (
    <span
      title={claim}
      className={`inline-flex items-center border-ochre bg-ochre/5 font-mono font-bold uppercase tracking-wider text-ochre ${size}`}
    >
      <FileSearch className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} aria-hidden />
      {tv(copy.badgeKey)}
      <span className="tabular-nums">· {loadLabel}</span>
      <span className="sr-only"> — {claim}</span>
    </span>
  );
}
