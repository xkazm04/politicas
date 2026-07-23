"use client";

/** Řádky žebříčku — výběr řádku přepíná rozklad, trend i živý vzorek. */

import type { MP } from "@/lib/civic/data";
import { MPS } from "@/lib/civic/data";
import { czech } from "@/lib/format";
import RankDelta from "@/features/shared/components/RankDelta";

export default function Standings({
  selected,
  onSelect,
}: {
  selected: MP;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-w-0 border-t-2 border-ink">
      {MPS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className={`grid w-full grid-cols-[3rem_1fr_auto_auto] items-center gap-4 border-b border-hairline px-2 py-4 text-left transition-colors hover:bg-paper-strong ${
            m.id === selected.id ? "bg-paper-strong" : ""
          }`}
          aria-pressed={m.id === selected.id}
        >
          <span className={`font-mono text-2xl font-bold ${m.rank <= 3 ? "text-signal" : "text-steel"}`}>
            {m.rank}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black uppercase tracking-tight">{m.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
              {/* barva strany je datový údaj — jediné povolené inline barvy */}
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.partyColor }} />
              {m.party} · {m.region}
            </span>
          </span>
          <RankDelta delta={m.delta} />
          <span className={`text-2xl font-black tabular-nums ${m.id === selected.id ? "text-signal" : "text-ink"}`}>
            {czech(m.score)}
          </span>
        </button>
      ))}
      <p className="mt-3 text-sm italic text-steel">{selected.headline}</p>
    </div>
  );
}
