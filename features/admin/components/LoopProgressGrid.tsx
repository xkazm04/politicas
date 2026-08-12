"use client";

import { czech, czechInt } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import type { LoopCaseProgress } from "../adminTypes";

function ProgressBar({ pct, note }: { pct: number | null; note: string | null }) {
  // Nehodnocený postup NENÍ nulový postup: prázdná lišta je poctivá jen tehdy,
  // když vedle ní stojí věta, proč se neměří. Bez věty by vypadala jako 0 %.
  if (pct == null) {
    return <div className="h-2 w-full border border-hairline bg-paper" role="img" aria-label={note ?? "postup nehodnocen"} />;
  }
  return (
    <div className="h-2 w-full border border-ink bg-paper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p className="font-mono text-lg tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** One case-loop's progress tile (batches, units, headline). */
function CaseTile({ p }: { p: LoopCaseProgress }) {
  return (
    <div className="flex flex-col gap-4 bg-paper p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-black uppercase tracking-tight">{p.labelCs}</h3>
        <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
          {p.batchesCompleted != null ? `dávka ${p.batchesCompleted}` : "bez dat"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Jednotky"
          value={p.unitsProcessed != null && p.unitsTotal != null ? `${czechInt(p.unitsProcessed)} / ${czechInt(p.unitsTotal)}` : "—"}
        />
        <Stat label="Postup" value={p.progressPct != null ? `${czech(p.progressPct)} %` : "—"} />
        <Stat label="Frontier" value={p.openFrontier != null ? czechInt(p.openFrontier) : "—"} />
      </div>

      <ProgressBar pct={p.progressPct} note={p.progressNoteCs} />

      {p.progressNoteCs && (
        <p className="text-xs leading-relaxed text-steel-aa">{p.progressNoteCs}</p>
      )}

      <p className="min-h-[3rem] text-sm leading-relaxed text-ink">
        {p.latestHeadline ?? <span className="text-steel">Poslední dávka se nepodařilo načíst.</span>}
      </p>

      <SourceNote>zdroj: {p.source}</SourceNote>
    </div>
  );
}

/** Three case-loop progress tiles in the Konstrukt tile-grid pattern. */
export default function LoopProgressGrid({ cases }: { cases: LoopCaseProgress[] }) {
  return (
    <div className="grid gap-px border border-ink bg-ink sm:grid-cols-3">
      {cases.map((c) => (
        <CaseTile key={c.case} p={c} />
      ))}
    </div>
  );
}
