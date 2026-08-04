"use client";

/*
 * Referenční integrace režimu plakátu (batch 1D): žebříček Otevřeného indexu
 * jako tiskový arch. Data přicházejí ZE serveru už ořezaná na to, co arch
 * sází (LeaderboardPosterData) — loader civicscore se odsud jen čte, nikdy
 * neupravuje. Tohle je zároveň vzor adopce pro další plochy: ořež data,
 * postav citaci přes buildPosterCitation(), obal obsah <PosterFrame>,
 * viditelnost v tisku zapni usePosterMode().
 *
 * Arch je záměrně STATICKÝ (žádné animace — na papíře se nic nehýbe a náhled
 * musí být totožný s tiskem), takže reduced-motion nemá co tlumit.
 */

import { useState } from "react";
import { useFormat } from "@/lib/i18n/useFormat";
import { buildPosterCitation } from "../citation";
import PosterFrame, { type PosterFormat } from "../PosterFrame";
import PosterToolbar from "../PosterToolbar";
import { usePosterMode } from "../usePosterMode";

/** Přesně to, co arch žebříčku sází — ořez LeaderboardListData na serveru. */
export interface LeaderboardPosterData {
  /** ISO datum dne, ke kterému byl arch vykreslen ze živého grafu. */
  retrievedAt: string;
  /** Živá URL žebříčku (odvozená z requestu — nikdy vymyšlená doména). */
  liveUrl: string;
  provenancePass: number | null;
  /** Rozpor mezi linií formule v datech a v kódu; null = shoda (viz citation.ts). */
  formulaMismatch: { storedRef: string; declaredRef: string } | null;
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  top: {
    rank: number;
    name: string;
    clubAbbrev: string;
    clubColor: string;
    score: number;
    tiedCount: number;
  }[];
}

export default function LeaderboardPoster({ data }: { data: LeaderboardPosterData }) {
  const f = useFormat();
  const { printPoster } = usePosterMode();
  const [format, setFormat] = useState<PosterFormat>("a4");

  const citation = buildPosterCitation({
    sourceLabel: "psp.cz — hlasování, tisky, stenozáznamy, členství (deterministický znalostní graf)",
    sourceUrl: data.liveUrl,
    retrievedAt: data.retrievedAt,
    methodology: "index přispění 0–100, šest složek s publikovanou vahou 25/20/20/15/10/10",
    provenancePass: data.provenancePass,
    formulaMismatch: data.formulaMismatch,
  });

  const maxBand = Math.max(1, ...data.histogram.map((h) => h.count));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PosterToolbar format={format} onFormatChange={setFormat} onPrint={printPoster} />

      <div className="mt-8">
        <PosterFrame
          eyebrow="Politicas — otevřený index přispění · sněmovna PSP10"
          figureLabel="obr. 1 — tiskový arch"
          title="Žebříček republiky"
          lead={`Všech ${f.int(data.summary.count)} poslanců seřazených podle indexu přispění — složeného skóre 0–100 z veřejných dat Poslanecké sněmovny. Žádné číslo na tomto archu nevzniklo jinde než v publikované metodice.`}
          citation={citation}
          format={format}
        >
          {/* ── souhrn sněmovny — kachlová mřížka ─────────────────────── */}
          <div className="grid grid-cols-4 gap-px border border-ink bg-ink">
            {[
              { label: "průměr", value: f.dec(data.summary.avg) },
              { label: "medián", value: f.dec(data.summary.median) },
              { label: "směrod. odchylka", value: f.dec(data.summary.sigma) },
              { label: "poslanců", value: f.int(data.summary.count) },
            ].map((s) => (
              <div key={s.label} className="bg-paper px-4 py-3">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                  {s.label}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-[3fr_2fr] gap-10">
            {/* ── čelo sněmovny ──────────────────────────────────────── */}
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal-deep">
                /01 čelo sněmovny
              </p>
              <ol className="mt-2 border-t-2 border-ink">
                {data.top.map((e) => (
                  <li
                    key={`${e.rank}-${e.name}`}
                    className="flex items-baseline gap-3 border-b border-hairline py-2"
                  >
                    <span
                      className={`w-8 shrink-0 font-mono text-sm font-bold tabular-nums ${
                        e.rank <= 3 ? "text-signal-deep" : "text-steel-aa"
                      }`}
                    >
                      {f.int(e.rank)}.
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black uppercase tracking-tight">
                      {e.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                      {/* barva klubu je datový údaj (lib/civic/data.ts), ne dekorace */}
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: e.clubColor }}
                      />
                      {e.clubAbbrev}
                    </span>
                    <span className="w-14 shrink-0 text-right text-base font-black tabular-nums">
                      {f.dec(e.score)}
                      {e.tiedCount > 1 && (
                        <span className="font-mono text-[11px] font-bold text-steel-aa"> =</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 font-mono text-xs leading-relaxed text-steel-aa">
                pořadí: competition ranking (1, 2, 2, 4) — shodné skóre sdílí příčku, „=&ldquo;
                značí sdílenou; uvnitř shody rozhoduje o pořadí jen abeceda a nenese žádný význam
              </p>
            </div>

            {/* ── rozložení skóre ────────────────────────────────────── */}
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal-deep">
                /02 rozložení indexu
              </p>
              <div className="mt-2 border-t-2 border-ink pt-4">
                <div className="flex h-44 items-end gap-1">
                  {data.histogram.map((h) => (
                    <div key={h.from} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="font-mono text-xs tabular-nums text-steel-aa">
                        {f.int(h.count)}
                      </span>
                      <div
                        className="w-full bg-ink"
                        style={{ height: `${Math.round((h.count / maxBand) * 100)}%` }}
                        aria-hidden
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between border-t border-hairline pt-1 font-mono text-xs tabular-nums text-steel-aa">
                  <span>{f.int(data.histogram[0]?.from ?? 0)}</span>
                  <span>
                    {f.int(
                      (data.histogram[data.histogram.length - 1]?.from ?? 0) + 5,
                    )}
                  </span>
                </div>
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-steel-aa">
                obr. 2 — počty poslanců v pásmech po 5 bodech; pásmo je interval
                [od, od+5), horní mez patří dalšímu pásmu
              </p>
            </div>
          </div>
        </PosterFrame>
      </div>
    </div>
  );
}
