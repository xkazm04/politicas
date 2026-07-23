/** Surový materiál — ověřené veřejné zdroje na kobaltové ploše + klíč IČO. */

import { SOURCES } from "@/lib/civic/data";

export default function DataSources() {
  return (
    <section id="k-data" className="bg-cobalt text-paper">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-black uppercase tracking-tight">Surový materiál</h2>
          <p className="font-mono text-xs uppercase tracking-[0.25em] opacity-80">
            obr. 4 — ověřené veřejné zdroje
          </p>
        </div>
        <div className="mt-8 grid gap-px bg-paper/35 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.slice(0, 8).map((s, i) => (
            <div key={s.name} className="bg-cobalt p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-70">
                {String(i + 1).padStart(2, "0")} · {s.cadence}
              </p>
              <p className="mt-2 text-lg font-black uppercase">{s.name}</p>
              <p className="mt-1 text-sm opacity-80">{s.what}</p>
            </div>
          ))}
          <div className="flex flex-col justify-between bg-signal p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest opacity-80">spojovací klíč</p>
            <p className="text-4xl font-black tracking-tight">IČO</p>
            <p className="text-sm opacity-90">8 číslic spojujících firmu ↔ smlouvu ↔ dotaci ↔ dar.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
