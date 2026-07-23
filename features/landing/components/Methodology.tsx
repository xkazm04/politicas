/** Metoda — žádná černá skříňka: verzované váhy, citace, drill-down. */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PILLARS } from "@/lib/civic/data";
import SourceNote from "@/features/shared/components/SourceNote";

export default function Methodology() {
  return (
    <section id="k-metoda" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h2 className="text-4xl font-black uppercase tracking-tight">
          Žádná černá skříňka<span className="text-signal">.</span>
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-steel">
          Verzované váhy, citace u každého pilíře, proklik až k doloženému faktu.
          Vazby mezi politiky a firmami zveřejňujeme jako datovaná, doložená fakta —
          nikdy jako obvinění. Postaveno a otestováno celý volební cyklus předtím,
          než na tom bude záležet.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-signal px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            Najdi svého poslance <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#"
            className="inline-flex items-center gap-2 border-2 border-ink px-6 py-3.5 text-sm font-black uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
          >
            API pro redakce
          </a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px self-start border border-ink bg-ink">
        {PILLARS.map((p) => (
          <div key={p.key} className="bg-paper p-5">
            <p className={`text-4xl font-black tabular-nums ${p.key === "integrity" ? "text-signal" : "text-ink"}`}>
              {(p.weight * 100).toFixed(0)}
              <span className="text-lg">%</span>
            </p>
            <p className="mt-1 text-sm font-black uppercase tracking-wide">{p.label}</p>
            <SourceNote className="mt-1 !text-[10px]">{p.source}</SourceNote>
          </div>
        ))}
      </div>
    </section>
  );
}
