"use client";

/**
 * Referendum o metodice — rubrika titulní strany (moonshot 7B, teaser).
 * Tři REDAKČNÍ ukázkové čočky z features/civicscore/lens.ts (LENS_PRESETS —
 * jediný zdroj, READ-ONLY import; záměrně nepřipsané žádné organizaci) +
 * vstup do plného toku „nastav si váhy" na /referendum. Každý odkaz nese
 * vektor vah v adrese (?vahy=…, týž kodek jako /zebricek) — odkaz je čočka.
 * Copy česky přímo zde (messages/*.json mimo plochu — precedens DenikTeaser).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ComponentKey } from "@/features/civicscore/getLeaderboardData";
import {
  effectiveWeights,
  encodeWeights,
  LENS_COMPONENT_ORDER,
  LENS_PRESETS,
} from "@/features/civicscore/lens";
import { useFormat } from "@/lib/i18n/useFormat";

/** Krátké české štítky složek pro miniaturní otisk vah (plné štítky se zdroji
 *  nese server-only loader — sem patří jen zkratky). */
const SHORT_LABEL: Record<ComponentKey, string> = {
  participation: "účast",
  committee: "výbory",
  legislative: "legislativa",
  speech: "vystoupení",
  attendance: "docházka",
  leadership: "vedení",
};

/** Tailwind bg-* třída složky — drž v sync s COMPONENT_FILL
 *  (features/civicscore/components/LeaderboardTable.tsx). */
const COMPONENT_BG: Record<ComponentKey, string> = {
  participation: "bg-cobalt",
  committee: "bg-signal",
  legislative: "bg-ochre",
  speech: "bg-ink",
  attendance: "bg-steel",
  leadership: "bg-cobalt/50",
};

export default function ReferendumTeaser() {
  const f = useFormat();
  return (
    <section aria-label="Referendum o metodice" className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
              referendum o metodice
            </p>
            <h2 className="mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl">
              Kolik váží dobrý poslanec<span className="text-signal">?</span>
            </h2>
          </div>
          <SourceNote>šest zveřejněných složek indexu přispění · psp.cz</SourceNote>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
          Zveřejněná metodika váží účast 25, výbory 20, legislativu 20, vystoupení 15, docházku 10
          a vedení orgánů 10 body. Vy můžete vážit jinak — a žebříček všech 207 poslanců se pod
          vaší čočkou přepočítá. Tři redakční ukázky, jak různé priority mění pořadí:
        </p>

        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
          {LENS_PRESETS.map((p) => {
            const eff = effectiveWeights(p.weights);
            const vector = encodeWeights(p.weights);
            return (
              <Link
                key={p.id}
                href={vector ? `/referendum?vahy=${vector}` : "/referendum"}
                className="group bg-paper p-5 transition-colors hover:bg-paper-strong"
              >
                <p className="text-lg font-black uppercase tracking-wide">
                  {p.label}
                  <span className="text-cobalt">.</span>
                </p>
                <p className="mt-1 min-h-10 text-[13px] leading-snug text-steel-aa">{p.note}</p>
                <div className="mt-4 space-y-1.5">
                  {LENS_COMPONENT_ORDER.map((k) => (
                    <div key={k} className="grid grid-cols-[5.5rem_1fr_2.2rem] items-center gap-2">
                      <span className="truncate font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                        {SHORT_LABEL[k]}
                      </span>
                      <span className="h-2 bg-paper-strong">
                        <span
                          className={`block h-2 ${COMPONENT_BG[k]}`}
                          style={{ width: `${Math.min(100, eff[k] * 2)}%` }}
                          aria-hidden
                        />
                      </span>
                      <span className="text-right font-mono text-[10px] tabular-nums text-steel-aa">
                        {f.dec(eff[k])}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt group-hover:underline">
                  otevřít tuhle čočku{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <SourceNote>
            ukázkové čočky redakce — nejsou metodikou žádné organizace · efektivní váhy (součet 100)
          </SourceNote>
          <Link
            href="/referendum"
            className="inline-flex items-center gap-2 bg-signal-deep px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            Nastav si váhy sám <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
