"use client";

/*
 * Paměť zákona — /zakony/predpis (moonshot 5A): rejstřík všech předpisů,
 * které stopa tisků v grafu zná. Vstupní brána ke kritickým vydáním
 * (/zakony/predpis/[ref]); pokrytí §-stopy se přiznává na řádku i souhrnně.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import type { StatuteRegistryRow } from "./deriveStatuteDossier";

const plural = (n: number, one: string, few: string, many: string): string =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;

export default function StatuteRegistryPage({ rows }: { rows: StatuteRegistryRow[] }) {
  const f = useFormat();
  const withTrail = rows.filter((r) => r.changes > 0).length;
  const totalChanges = rows.reduce((s, r) => s + r.changes, 0);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ zákony / předpis</span>
          <Link
            href="/zakony"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> monitor legislativy
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">paměť zákona · rejstřík předpisů</SourceNote>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Paměť zákona<span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            Každý předpis, který stopa sněmovních tisků v grafu zná, má vlastní kritické vydání: kroniku
            tisků, které ho měnily, a — kde archiv nese reálný e-Sbírka §-diff — doslovnou §-stopu
            „před / po“ s trvalými kotvami <span className="font-mono">#p-&lt;§&gt;</span>.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px border-2 border-ink bg-ink max-sm:grid-cols-1">
          {[
            { v: f.int(rows.length), l: "předpisů ve stopě" },
            { v: f.int(withTrail), l: "předpisů se §-stopou" },
            { v: f.int(totalChanges), l: "doložených změn fragmentů" },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-4">
              <div className="text-3xl font-black tabular-nums">{s.v}</div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <SourceNote>
            psp.cz tisky (amends + census textu) · e-Sbírka SPARQL §-diffy — §-stopa je bodová, pokrytí se
            přiznává na každém řádku
          </SourceNote>
        </div>

        <section className="mt-12 pb-20">
          <SectionHeading
            index={1}
            title="Rejstřík předpisů"
            aside={<SourceNote>řazeno počtem tisků, pak číslem předpisu</SourceNote>}
          />
          <div className="mt-8 border-t-2 border-ink">
            {rows.map((r) => (
              <Link
                key={r.ref}
                href={`/zakony/predpis/${r.slug}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-6 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-xs font-bold text-signal">č. {r.ref} Sb.</span>
                    {r.changes > 0 && (
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
                        §-stopa · {f.int(r.changes)} {plural(r.changes, "změna", "změny", "změn")}
                      </span>
                    )}
                  </span>
                  {r.title ? (
                    <span className="mt-0.5 block text-[15px] font-bold leading-snug">{r.title}</span>
                  ) : (
                    <span className="mt-0.5 block text-[15px] font-bold leading-snug">{r.label}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums">{f.int(r.trailBills)}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {plural(r.trailBills, "tisk", "tisky", "tisků")}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            Stopa zahrnuje vazby z názvu tisku (citace „č. N/RRRR Sb.“) i nezávislý census plného textu
            (průchod grafu 20) — obě provenience se na stránce předpisu rozlišují. Předpis bez §-stopy
            není prázdná stránka: kronika tisků platí i bez e-Sbírka diffu.
          </p>
        </section>
      </div>
    </main>
  );
}
