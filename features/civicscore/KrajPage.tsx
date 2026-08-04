"use client";

/*
 * Můj kraj (moonshot 5E) — volební karta kraje (/kraj/[kraj]).
 *
 * Krajský výřez žebříčku Otevřeného indexu jako TISKNUTELNÁ kandidátka:
 * poslanci kraje seřazení indexem přispění, s krajskou i celostátní příčkou,
 * šesti složkovými pruhy a odznaky. Karta je první ostrá adopce PosterFrame
 * mimo demo (batch 5E, kontrakt bod 22): obsah je obalen archem, citace jde
 * VÝHRADNĚ přes buildPosterCitation(krajCitationInput(…)) a viditelnost
 * v tisku drží usePosterMode() — „Tisk kandidátky" vytiskne jen arch.
 *
 * Čtenářova čočka (?vahy=…) prochází kartou stejně jako žebříčkem: pod čočkou
 * se celý žebříček přepočte čistou funkcí reweigh() a výřez kraje se dělá až
 * nad ním — nikdy směs. Označení je nezaměnitelné (kobalt): lepivý pruh na
 * obrazovce, pruh s vektorem vah UVNITŘ archu (jde i do tisku) a řádek
 * metodiky v citační patičce. Čistá adresa = oficiální index.
 *
 * Arch je záměrně statický (žádné animace — náhled musí být totožný s tiskem),
 * takže reduced-motion nemá co tlumit. Česká copy inline (messages/*.json je
 * mimo plochu — precedens batch 1D).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { buildPosterCitation } from "@/features/shared/poster/citation";
import PosterFrame, { type PosterFormat } from "@/features/shared/poster/PosterFrame";
import PosterToolbar from "@/features/shared/poster/PosterToolbar";
import { usePosterMode } from "@/features/shared/poster/usePosterMode";
import { useFormat } from "@/lib/i18n/useFormat";
import type { LeaderboardListData } from "./getLeaderboardData";
import { krajSlate, listKraje, krajCitationInput, type KrajSlateRow } from "./kraj";
import { encodeWeights, reweigh, LENS_COMPONENT_ORDER } from "./lens";
import { formulaMismatchOrNull } from "./provenance";
import { useLensWeights } from "./useLensWeights";
import WorkhorseBadge from "./components/WorkhorseBadge";

/** Zkratky složek pro miniaturní rozpad na kartě — pořadí = zveřejněné váhy. */
const COMPONENT_SHORT: Record<(typeof LENS_COMPONENT_ORDER)[number], string> = {
  participation: "úč",
  committee: "výb",
  legislative: "leg",
  speech: "sál",
  attendance: "doch",
  leadership: "ved",
};

function PillarBars({
  row,
  components,
}: {
  row: KrajSlateRow;
  components: LeaderboardListData["components"];
}) {
  // Miniaturní složkové pruhy: výška = míra naplnění složky (body / váha).
  // Čistě inkoustové — na papíře nesmí význam nést barva. Hodnoty duplikují
  // skóre vedle, proto aria-hidden + title s plným rozpisem.
  const title = components
    .map((c) => `${c.label}: ${row.components[c.key]} z ${c.weight}`)
    .join(" · ");
  return (
    <span aria-hidden title={title} className="flex shrink-0 items-end gap-1">
      {components.map((c) => {
        const share = c.weight > 0 ? Math.max(0, Math.min(1, row.components[c.key] / c.weight)) : 0;
        return (
          <span key={c.key} className="flex w-4 flex-col items-center gap-0.5">
            <span className="flex h-7 w-2 items-end bg-paper-strong">
              <span className="w-full bg-ink" style={{ height: `${Math.round(share * 100)}%` }} />
            </span>
            <span className="font-mono text-[8px] uppercase tracking-tight text-steel-aa">
              {COMPONENT_SHORT[c.key]}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export default function KrajPage({
  data,
  slug,
  retrievedAt,
  liveUrl,
}: {
  data: LeaderboardListData;
  /** Slug kraje — routa ho už ověřila proti listKraje(). */
  slug: string;
  /** ISO datum dne, ke kterému byla karta vykreslena ze živého grafu. */
  retrievedAt: string;
  /** Živá URL této karty (z request hlaviček — nikdy vymyšlená doména). */
  liveUrl: string;
}) {
  const f = useFormat();
  const { printPoster } = usePosterMode();
  const [format, setFormat] = useState<PosterFormat>("a4");

  // Čtenářova čočka: pod ní se přepočítá CELÝ žebříček a kraj se vyřezává
  // až z přepočtu — krajská i celostátní příčka pak obě nesou čočku.
  const lens = useLensWeights();
  const lensView = useMemo(
    () => (!lens.isDefault ? reweigh(data.entries, data.components, lens.weights) : null),
    [data, lens.isDefault, lens.weights],
  );
  const custom = lensView !== null;
  const entries = lensView?.entries ?? data.entries;
  const components = lensView?.components ?? data.components;

  const slate = useMemo(() => krajSlate(entries, slug), [entries, slug]);
  const kraje = useMemo(() => listKraje(data.entries), [data.entries]);
  const unassignedInfo = kraje.find((k) => k.unassigned);

  const citation = buildPosterCitation(
    krajCitationInput({
      liveUrl,
      retrievedAt,
      provenancePass: data.provenancePass,
      formulaMismatch: formulaMismatchOrNull(data.provenance),
      weights: lens.weights,
    }),
  );

  // Slug byl ověřen routou nad oficiálními daty; reweigh identitu (region)
  // nemění, takže výřez existuje pod každou čočkou. Kdyby ne, přiznat.
  if (!slate) {
    return (
      <main className="min-h-screen bg-paper font-sans text-ink">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-base font-black uppercase tracking-wide">
            Kraj bez poslanců v záznamu.
          </p>
          <Link href="/kraj" className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-cobalt hover:underline">
            ← zpět na rozcestník krajů
          </Link>
        </div>
      </main>
    );
  }

  const vahy = encodeWeights(lens.weights);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ můj kraj</span>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
            <Link href={custom && vahy ? `/kraj?vahy=${vahy}` : "/kraj"} className="text-steel-aa transition-colors hover:text-ink">
              ostatní kraje
            </Link>
            <Link href={custom && vahy ? `/zebricek?vahy=${vahy}` : "/zebricek"} className="text-steel-aa transition-colors hover:text-ink">
              celý žebříček →
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Lepivý pruh vlastní čočky (obrazovka) ───────────── */}
      {custom && (
        <div className="sticky top-0 z-20 border-b-2 border-ink bg-cobalt">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-paper">
              váš index — váhy {vahy} · nejde o zveřejněnou metodiku
            </p>
            <button
              type="button"
              onClick={lens.reset}
              className="inline-flex items-center gap-1.5 border-2 border-paper px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-cobalt"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Výchozí metodika
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SourceNote tone="signal">
          volební karta kraje — výřez žebříčku indexu přispění, psp.cz · PSP10
        </SourceNote>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel-aa">
          Kandidátka vašeho kraje: poslanci zvolení za {slate.unassigned ? "mandáty bez uvedeného kraje" : slate.label},
          seřazení indexem přispění. Karta se dá vytisknout jako arch A4/A3 — na papíře zůstane jen
          kandidátka s citací zdroje a datem.
        </p>

        <div className="mt-8">
          <PosterToolbar
            format={format}
            onFormatChange={setFormat}
            onPrint={printPoster}
            printLabel="Tisk kandidátky"
          />
        </div>

        <div className="mt-8">
          <PosterFrame
            eyebrow={`Politicas — volební karta · ${custom ? "váš index" : "otevřený index"} · sněmovna PSP10`}
            figureLabel={`kandidátka · ${f.int(slate.rows.length)} poslanců`}
            title={slate.label}
            lead={
              slate.unassigned
                ? `Mandáty, u nichž registr psp.cz kraj neuvádí — přiznaná mezera záznamu, ne čtrnáctý kraj. Řazení i skóre jsou táž metodika jako u celostátního žebříčku.`
                : `Všichni poslanci zvolení za tento kraj, seřazení podle indexu přispění — složeného skóre 0–100 z veřejných dat Poslanecké sněmovny. Krajská příčka vlevo, celostátní u skóre; žádné číslo nevzniklo jinde než v ${custom ? "přiznané čtenářově čočce" : "publikované metodice"}.`
            }
            citation={citation}
            format={format}
          >
            {/* ── pruh čočky UVNITŘ archu — jde i do tisku ─────────────── */}
            {custom && (
              <div className="mb-4 border-2 border-cobalt bg-cobalt/5 px-4 py-2">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt">
                  váš index — váhy {vahy} · vlastní čočka čtenáře, nejde o zveřejněnou metodiku
                </p>
              </div>
            )}

            {/* ── souhrn kraje — kachlová mřížka ───────────────────────── */}
            <div className="grid grid-cols-3 gap-px border border-ink bg-ink">
              {[
                { label: "poslanců kraje", value: f.int(slate.rows.length) },
                { label: "průměr kraje", value: f.dec(slate.avgScore) },
                { label: "průměr sněmovny", value: f.dec(lensView?.summary.avg ?? data.summary.avg) },
              ].map((s) => (
                <div key={s.label} className="bg-paper px-4 py-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                    {s.label}
                  </p>
                  <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{s.value}</p>
                </div>
              ))}
            </div>

            {/* ── kandidátka ───────────────────────────────────────────── */}
            <ol className="mt-6 border-t-2 border-ink">
              {slate.rows.map((r) => (
                <li key={r.pspId} className="flex items-center gap-3 border-b border-hairline py-2.5">
                  <span
                    className={`w-9 shrink-0 text-right font-mono text-xl font-black tabular-nums ${
                      r.krajRank === 1 ? (custom ? "text-cobalt" : "text-signal-deep") : "text-ink"
                    }`}
                  >
                    {f.int(r.krajRank)}.
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link
                        href={`/poslanec/${r.pspId}`}
                        className="truncate text-base font-black uppercase tracking-tight hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                        {/* barva klubu je datový údaj (lib/civic/data.ts), ne dekorace */}
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: r.clubColor }}
                        />
                        {r.clubAbbrev}
                      </span>
                      {r.effortWorkhorse && (
                        <WorkhorseBadge
                          flavour={r.effortWorkhorseFlavour}
                          speechTurns={r.duelFacts.speechTurns}
                          recordedAt={r.effortRecordedAt}
                          compact
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                      celostátně č. {f.int(r.rank)} z {f.int(slate.totalMps)}
                      {r.tiedCount > 1 && " (sdílená příčka)"} · mandát PSP10
                    </span>
                  </span>
                  <PillarBars row={r} components={components} />
                  <span className={`w-16 shrink-0 text-right text-2xl font-black tabular-nums ${custom ? "text-cobalt" : ""}`}>
                    {f.dec(r.score)}
                    {r.krajTiedCount > 1 && (
                      <span className="font-mono text-[11px] font-bold text-steel-aa"> =</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-3 font-mono text-xs leading-relaxed text-steel-aa">
              pořadí: competition ranking (1, 2, 2, 4) v kraji i celostátně — shodné skóre sdílí
              příčku, „=&ldquo; značí sdílenou; uvnitř shody rozhoduje jen abeceda a nenese žádný
              význam · složkové pruhy: míra naplnění šesti složek indexu (úč = účast, výb = výbory,
              leg = legislativa, sál = vystoupení, doch = docházka, ved = vedení orgánů)
              {!slate.unassigned && unassignedInfo && (
                <>
                  {" "}· {f.int(unassignedInfo.count)} mandátů v registru kraj neuvádí —{" "}
                  <Link href={`/kraj/${unassignedInfo.slug}`} className="underline hover:text-ink">
                    karta „kraj neuveden&ldquo;
                  </Link>
                </>
              )}
            </p>
          </PosterFrame>
        </div>

        {/* ── pod archem: úprava čočky ──────────────────────────────── */}
        <p className="mt-6 max-w-2xl font-mono text-xs leading-relaxed text-steel-aa">
          Váhy indexu si můžete přenastavit na{" "}
          <Link href={custom && vahy ? `/zebricek?vahy=${vahy}` : "/zebricek"} className="underline hover:text-ink">
            žebříčku (sekce Otevřený index)
          </Link>
          {" "}— odkaz s <span className="text-cobalt">?vahy=…</span> pak nese vaši čočku i sem, na kartu.
        </p>
      </div>
    </main>
  );
}
