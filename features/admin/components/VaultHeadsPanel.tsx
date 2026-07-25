"use client";

import { czechDate } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import type { VaultHeads } from "../adminTypes";

const TRACK_TONE: Record<string, string> = {
  money: "text-signal",
  effort: "text-cobalt",
  law: "text-ochre",
};

/** Last passes written to the shared investigative sequence (graph-log.md) — the
 *  vault's head, so the operator can see what actually landed most recently
 *  without opening the log file by hand. */
export default function VaultHeadsPanel({ heads }: { heads: VaultHeads }) {
  return (
    <div className="flex flex-col gap-4 border border-ink bg-paper p-6">
      <h3 className="text-lg font-black uppercase tracking-tight">Poslední zápisy do trezoru</h3>
      {heads.recentPasses.length > 0 ? (
        <ul className="flex flex-col divide-y divide-hairline border-t-2 border-ink">
          {heads.recentPasses.map((p) => (
            <li key={p.pass} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{p.title}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
                  {isIso(p.date) ? czechDate(p.date) : p.date}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold tabular-nums">#{p.pass}</p>
                <p className={`font-mono text-[11px] uppercase tracking-widest ${TRACK_TONE[p.track] ?? "text-steel"}`}>
                  {p.track}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-steel">graph-log.md se nepodařilo přečíst / žádný zápis nenalezen.</p>
      )}
      <SourceNote>zdroj: docs/data-analysis/graph-log.md</SourceNote>
    </div>
  );
}

function isIso(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
