"use client";

import { czechInt } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import type { SystemState } from "../adminTypes";

/** Kontrolka stavu smyček. Tři stavy, tři barvy — a „nečitelné“ je vlastní
 *  stav, ne tichá pauza: okr = pozastaveno, signální = běží, ocelová = stav
 *  se nepodařilo přečíst. */
const RUN_STATE_DOT: Record<SystemState["loopsRunState"], string> = {
  paused: "bg-ochre",
  running: "bg-signal",
  unknown: "bg-steel",
};

/** The one-glance strip: graph totals, last pass number, and the loops'
 *  running/paused status. The status is DERIVED from the STATUS line of
 *  docs/case-loops.md (getAdminData.loadLoopsStatus) — until 2026-08-12 it was
 *  a hardcoded constant that had outlived the operation it described. */
export default function SystemStateStrip({ state }: { state: SystemState }) {
  const { graph, lastPass, loopsRunState, loopsStatusLabel, loopsStatusSource } = state;
  const topKinds = graph ? Object.entries(graph.nodesByKind).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  const topRels = graph ? Object.entries(graph.edgesByRel).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];

  return (
    <div className="flex flex-col gap-4 border-4 border-ink bg-ink p-6 text-paper">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 shrink-0 ${RUN_STATE_DOT[loopsRunState]}`} aria-hidden />
          <p className="font-mono text-sm font-bold uppercase tracking-widest">{loopsStatusLabel}</p>
        </div>
        <p className="font-mono text-sm uppercase tracking-widest text-paper/70">
          poslední pass: <span className="font-bold text-paper">{lastPass != null ? `#${lastPass}` : "—"}</span>
        </p>
      </div>

      {graph ? (
        <div className="grid gap-6 border-t border-paper/20 pt-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
              uzly celkem: {czechInt(graph.nodes)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topKinds.map(([kind, n]) => (
                <span key={kind} className="border border-paper/40 px-2 py-1 font-mono text-[11px] uppercase tracking-widest">
                  {kind} · {czechInt(n)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
              hrany celkem: {czechInt(graph.edges)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topRels.map(([rel, n]) => (
                <span key={rel} className="border border-paper/40 px-2 py-1 font-mono text-[11px] uppercase tracking-widest">
                  {rel} · {czechInt(n)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="border-t border-paper/20 pt-4 text-sm text-paper/70">Graf se nepodařilo načíst (store nedostupný).</p>
      )}

      <SourceNote tone="paper">
        zdroj: kg_node / kg_edge — countKgNodes/Edges + countKgEdgesByRel + kgKindCounts (indexované
        group-by, ne výčet uzlů) · stav smyček: STATUS řádek {loopsStatusSource}
      </SourceNote>
    </div>
  );
}
