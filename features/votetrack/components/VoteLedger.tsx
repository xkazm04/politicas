"use client";

/**
 * Deník hlasování — chronologické zápisy jako výběr (master strana fúze).
 * Řádek nese datum, tisk, poměrový pruh 200 křesel a razítko výsledku;
 * výběr řídí vedlejší pohled do sálu.
 */

import { useTranslations } from "next-intl";
import type { RollCall } from "@/lib/civic/data";
import { ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";

/** RollCall.result z dat (česky) → klíč common.voteResult. */
const RESULT_KEY: Record<string, string> = {
  přijato: "accepted",
  zamítnuto: "rejected",
};

/** Poměrový pruh sálu — 200 křesel jako šířky segmentů. */
export function ResultBar({ rc }: { rc: RollCall }) {
  const other = 200 - rc.pro - rc.proti;
  return (
    <div className="flex h-3 w-full overflow-hidden bg-hairline">
      <span className="h-full bg-cobalt" style={{ width: `${(rc.pro / 200) * 100}%` }} />
      <span className="h-full bg-hairline" style={{ width: `${(other / 200) * 100}%` }} />
      <span className="h-full bg-signal" style={{ width: `${(rc.proti / 200) * 100}%` }} />
    </div>
  );
}

export default function VoteLedger({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("votetrack");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  return (
    <div className="min-w-0">
      <div className="border-t-2 border-ink">
        {ROLL_CALLS.map((rc) => (
          <button
            key={rc.id}
            type="button"
            onClick={() => onSelect(rc.id)}
            className={`block w-full border-b border-hairline py-4 pr-2 text-left transition-colors hover:bg-paper-strong ${
              rc.id === selectedId ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-0"
            }`}
            aria-pressed={rc.id === selectedId}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-steel">
                {f.date(rc.date)} · {tc(`rollCalls.${rc.id}.tisk`)}
              </span>
              <span
                className={`font-mono text-[11px] font-black uppercase tracking-wider ${
                  rc.result === "přijato" ? "text-cobalt" : "text-signal"
                }`}
              >
                {tcom(`voteResult.${RESULT_KEY[rc.result]}`)}
              </span>
            </span>
            <span className="mt-1 block text-[15px] font-bold leading-snug">
              {tc(`rollCalls.${rc.id}.title`)}
            </span>
            <span className="mt-2 block">
              <ResultBar rc={rc} />
            </span>
            <span className="mt-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-steel">
              <span>{f.int(rc.pro)}:{f.int(rc.proti)}</span>
              {rc.rebels.length > 0 && (
                <span className="font-bold text-signal">{t("rebelsCount", { n: rc.rebels.length })}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <SourceNote>
          {t("sampleFootnote", { sample: ROLL_CALLS.length, total: f.int(5214) })}
        </SourceNote>
      </div>
    </div>
  );
}
