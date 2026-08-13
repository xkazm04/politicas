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
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { buildPosterCitation } from "@/features/shared/poster/citation";
import PosterFrame, { type PosterFormat } from "@/features/shared/poster/PosterFrame";
import PosterToolbar from "@/features/shared/poster/PosterToolbar";
import { usePosterMode } from "@/features/shared/poster/usePosterMode";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { useFormat } from "@/lib/i18n/useFormat";
import type { LeaderboardListData } from "./getLeaderboardData";
import { krajSlate, listKraje, krajCitationInput, type KrajSlateRow } from "./kraj";
import { encodeWeights, reweigh, LENS_COMPONENT_ORDER } from "./lens";
import { formulaMismatchOrNull, storedRefLabel } from "./provenance";
import { contributionScoreClaim } from "./scoreClaim";
import { useLensWeights } from "./useLensWeights";
import LowScoreReasonChip from "./components/LowScoreReasonChip";
import RapporteurBadge from "./components/RapporteurBadge";
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
  const t = useTranslations("civicscore");
  // Miniaturní složkové pruhy: výška = míra naplnění složky (body / váha).
  // Čistě inkoustové — na papíře nesmí význam nést barva. Hodnoty duplikují
  // skóre vedle, proto aria-hidden + title s plným rozpisem.
  const title = components
    .map((c) => t("krajBarItem", { label: c.label, points: row.components[c.key], weight: c.weight }))
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
  liveUrl,
}: {
  data: LeaderboardListData;
  /** Slug kraje — routa ho už ověřila proti listKraje(). */
  slug: string;
  /** Živá URL této karty (z request hlaviček — nikdy vymyšlená doména). */
  liveUrl: string;
}) {
  const f = useFormat();
  const locale = useLocale();
  const t = useTranslations("civicscore");
  const tm = useTranslations("metodika");
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

  // Citace jde dál VÝHRADNĚ přes buildPosterCitation; navíc jí podáváme stav
  // KOMOROVÉ provenience, aby arch u nejednotného (nebo chybějícího) původu
  // výpočtu nemlčel, ale řekl to — mlčení nerozliší „nevíme" od „neshodneme se".
  //
  // ARCH DATUJE DATA, NE TISK (2026-08-12). Do teď sem routa posílala
  // `new Date()`, takže vytištěná kandidátka nesla „stav dat ke dni <dnešek>"
  // nad žebříčkem, který je artefakt dávkového přepočtu — a papír se po tisku
  // neopraví. Den vydává KOMOROVÝ agregát (`provenance.computedAt`, jediné
  // místo, kde pravidlo „jeden den, jeden průchod, nikdo bez razítka" žije);
  // `null` znamená, že se komora neshodne, a arch to řekne místo aby hádal —
  // totéž pravidlo a totéž rozhodnutí jako `statusLine` vestavného widgetu.
  const citation = buildPosterCitation({
    ...krajCitationInput({
      liveUrl,
      retrievedAt: data.provenance.computedAt,
      provenancePass: data.provenancePass,
      formulaMismatch: formulaMismatchOrNull(data.provenance),
      weights: lens.weights,
    }),
    provenanceState: data.provenance.state,
    provenanceVariants: data.provenance.distinctCount,
  });

  // Slug byl ověřen routou nad oficiálními daty; reweigh identitu (region)
  // nemění, takže výřez existuje pod každou čočkou. Kdyby ne, přiznat.
  if (!slate) {
    return (
      <main className="min-h-screen bg-paper font-sans text-ink">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-base font-black uppercase tracking-wide">
            {t("krajEmpty")}
          </p>
          <Link href="/kraj" className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-cobalt hover:underline">
            ← {t("krajBackToPicker")}
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
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ {t("krajCrumb")}</span>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
            <Link href={custom && vahy ? `/kraj?vahy=${vahy}` : "/kraj"} className="text-steel-aa transition-colors hover:text-ink">
              {t("krajOthers")}
            </Link>
            <Link href={custom && vahy ? `/zebricek?vahy=${vahy}` : "/zebricek"} className="text-steel-aa transition-colors hover:text-ink">
              {t("toFullLeaderboard")}
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Lepivý pruh vlastní čočky (obrazovka) ───────────── */}
      {custom && (
        <div className="sticky top-0 z-20 border-b-2 border-ink bg-cobalt">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-paper">
              {t("lensStickyLine", { weights: vahy ?? "" })}
            </p>
            <button
              type="button"
              onClick={lens.reset}
              className="inline-flex items-center gap-1.5 border-2 border-paper px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-cobalt"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              {t("resetToPublished")}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SourceNote tone="signal">{t("krajSourceNote")}</SourceNote>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel-aa">
          {t("krajLead", {
            subject: slate.unassigned ? t("krajUnassignedSubject") : slate.label,
          })}
        </p>

        {/* Poctivost žebříčku platí i na kartě, která se tiskne: pokud komora
            nemá jeden původ výpočtu (poloviční přepočet) nebo ho nenese vůbec,
            řekne to STRÁNKA — ne jen patička archu. Tytéž věty jako /zebricek,
            týž agregát (features/civicscore/provenance.ts), žádná druhá kopie. */}
        {data.provenance.state === "mixed" && (
          <SourceNote className="mt-3">
            {t("provenanceMixed", {
              count: f.int(data.provenance.distinctCount),
              withProv: f.int(data.provenance.covered),
              total: f.int(data.provenance.total),
            })}
          </SourceNote>
        )}
        {data.provenance.state === "absent" && (
          <SourceNote className="mt-3">{t("provenanceAbsent")}</SourceNote>
        )}
        {!data.provenance.formulaMatch && data.provenance.state !== "absent" && (
          <SourceNote className="mt-1.5">
            {t("provenanceMismatch", {
              dataRef: storedRefLabel(data.provenance),
              codeRef: data.provenance.declaredRef,
            })}
          </SourceNote>
        )}

        <p className="mt-3">
          {/* Táž metodika jako celostátní žebříček — a od 2026-08-04 je i vidět. */}
          <Link
            href="/metodika"
            className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal hover:underline"
          >
            {tm("linkLabel")}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>

        <div className="mt-8">
          <PosterToolbar
            format={format}
            onFormatChange={setFormat}
            onPrint={printPoster}
            printLabel={t("krajPrint")}
          />
        </div>

        <div className="mt-8">
          <PosterFrame
            eyebrow={t("krajEyebrow", { mode: custom ? t("krajModeYours") : t("krajModeOpen") })}
            figureLabel={t("krajFigureLabel", { count: f.int(slate.rows.length) })}
            title={slate.unassigned ? t("krajUnassignedLabel") : slate.label}
            lead={
              slate.unassigned
                ? t("krajPosterLeadUnassigned")
                : t("krajPosterLead", {
                    origin: custom ? t("krajOriginLens") : t("krajOriginPublished"),
                  })
            }
            citation={citation}
            format={format}
          >
            {/* ── pruh čočky UVNITŘ archu — jde i do tisku ─────────────── */}
            {custom && (
              <div className="mb-4 border-2 border-cobalt bg-cobalt/5 px-4 py-2">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt">
                  {t("krajLensStrip", { weights: vahy ?? "" })}
                </p>
              </div>
            )}

            {/* ── souhrn kraje — kachlová mřížka ───────────────────────── */}
            <div className="grid grid-cols-3 gap-px border border-ink bg-ink">
              {[
                { label: t("krajTileMps"), value: f.int(slate.rows.length) },
                { label: t("krajTileAvg"), value: f.dec(slate.avgScore) },
                { label: t("krajTileChamberAvg"), value: f.dec(lensView?.summary.avg ?? data.summary.avg) },
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
                      {/* Korektiv stojí VEDLE čísla, které opravuje — i na papíře.
                          34 z 207 poslanců ho nese; kandidátka bez něj tiskne nízké
                          číslo a nic vedle něj, a z pořadí se stává obvinění. Text je
                          verbatim z uzavřeného slovníku a je DATOVANÝ. */}
                      {r.effortLowScoreReason && (
                        <LowScoreReasonChip
                          reason={r.effortLowScoreReason}
                          recordedAt={r.effortRecordedAt}
                          dateLabel={r.effortRecordedAt ? f.date(r.effortRecordedAt) : null}
                        />
                      )}
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
                      {/* Zpravodajská zátěž je táž třída datovaného verdiktu — na
                          žebříčku se tiskne, na kandidátce chyběla. Pod prahem se
                          nevykreslí vůbec (čestná degradace v komponentě). */}
                      <RapporteurBadge load={r.effortRapporteurLoad} recordedAt={r.effortRecordedAt} compact />
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                      {t("krajNationalRank", { rank: f.int(r.rank), total: f.int(slate.totalMps) })}
                      {r.tiedCount > 1 && ` ${t("krajSharedRank")}`} · {t("krajMandate")}
                    </span>
                  </span>
                  <PillarBars row={r} components={components} />
                  {/* Skóre na kartě je TÝŽ zveřejněný index jako na žebříčku, takže
                      nese TÝŽ claim (scoreClaim.ts — importovaný, nikdy druhá ražba):
                      číslo opsané z vytištěné kandidátky se dá ověřit na /overeni.
                      Pod čtenářovou čočkou se claim ZADRŽUJE — to vážení v grafu
                      nikde nestojí (totéž pravidlo jako v LeaderboardTable). */}
                  <span className={`w-16 shrink-0 text-right text-2xl font-black tabular-nums ${custom ? "text-cobalt" : ""}`}>
                    {custom ? (
                      f.dec(r.score)
                    ) : (
                      <CitableNumber
                        value={r.score}
                        claim={contributionScoreClaim(r.pspId, r.score, data.provenance).claim}
                        locale={locale as Locale}
                      />
                    )}
                    {r.krajTiedCount > 1 && (
                      <span className="font-mono text-[11px] font-bold text-steel-aa"> =</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-3 font-mono text-xs leading-relaxed text-steel-aa">
              {t("krajFootnote")}
              {/* Proč pod čočkou u čísel nestojí citace — řečeno tam, kde ta čísla
                  jsou, a tedy i na papíře. */}
              {custom && <> · {t("krajLensNoClaim")}</>}
              {!slate.unassigned && unassignedInfo && (
                <>
                  {" "}· {t("krajUnassignedNote", { count: f.int(unassignedInfo.count) })} —{" "}
                  <Link href={`/kraj/${unassignedInfo.slug}`} className="underline hover:text-ink">
                    {t("krajUnassignedLink")}
                  </Link>
                </>
              )}
            </p>
          </PosterFrame>
        </div>

        {/* ── pod archem: úprava čočky ──────────────────────────────── */}
        <p className="mt-6 max-w-2xl font-mono text-xs leading-relaxed text-steel-aa">
          {t.rich("krajLensHint", {
            link: (chunks) => (
              <Link href={custom && vahy ? `/zebricek?vahy=${vahy}` : "/zebricek"} className="underline hover:text-ink">
                {chunks}
              </Link>
            ),
            code: (chunks) => <span className="text-cobalt">{chunks}</span>,
          })}
        </p>
      </div>
    </main>
  );
}
