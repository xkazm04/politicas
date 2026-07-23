"use client";

/**
 * Pravá polovina hero — živý, přenastavitelný index.
 * Metodika jako hlavní interakce: posuvníky vah přepočítávají skóre živě.
 * Stav (vybraný poslanec + váhy) vlastní LandingPage; tady jen ovládání.
 */

import { RotateCcw } from "lucide-react";
import type { MP, Pillar } from "@/lib/civic/data";
import { MPS, PILLARS } from "@/lib/civic/data";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import { PILLAR_BG } from "../palette";

export type Weights = Record<Pillar["key"], number>;

export default function LiveSpecimen({
  mp,
  score,
  weights,
  isDefault,
  onSelect,
  onWeightChange,
  onReset,
}: {
  mp: MP;
  score: number;
  weights: Weights;
  isDefault: boolean;
  onSelect: (id: string) => void;
  onWeightChange: (key: Pillar["key"], value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="py-14 lg:pl-12">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-steel">
          živý vzorek — {mp.name}, {mp.party}
        </p>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <RotateCcw className="h-3 w-3" /> zveřejněné váhy
          </button>
        )}
      </div>

      {/* přepínač vzorku — příjmení jako štítky */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {MPS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`border-2 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              m.id === mp.id ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
            }`}
            aria-pressed={m.id === mp.id}
          >
            {m.name.split(" ").at(-1)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-4">
        <AnimatedScore
          value={score}
          className={`text-[8rem] font-black leading-[0.85] tracking-tighter sm:text-[10rem] ${
            isDefault ? "text-ink" : "text-cobalt"
          }`}
        />
        <div className="pb-4">
          <span className="block h-10 w-10 rounded-full bg-signal" />
          <span className="mt-2 block font-mono text-[11px] uppercase tracking-widest text-steel">/100</span>
        </div>
      </div>
      <p className={`mt-1 font-mono text-[11px] uppercase tracking-widest ${isDefault ? "text-steel" : "text-cobalt"}`}>
        {isDefault ? "spočteno podle zveřejněných vah v1.4" : "spočteno podle VAŠICH vah — stejné důkazy"}
      </p>

      <div className="mt-8 space-y-5">
        {PILLARS.map((p) => (
          <div key={p.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
              <span className={`inline-block h-3 w-3 ${PILLAR_BG[p.key]}`} />
              {p.label}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[p.key]}
              onChange={(e) => onWeightChange(p.key, Number(e.target.value))}
              aria-label={`Váha pilíře ${p.label}`}
              className="k-range"
            />
            <span className="text-right font-mono text-sm tabular-nums text-steel">
              {Math.round(weights[p.key])}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 border-l-4 border-signal pl-4 text-sm italic leading-relaxed text-steel">
        Hodnoty pilířů jsou fakta s citacemi — {mp.pillars.attendance} % docházky je
        psp.cz, vazby na zakázky Registr smluv. Názorem je jen váhování — a to je
        vytištěné na stránce.
      </p>
    </div>
  );
}
