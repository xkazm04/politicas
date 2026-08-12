"use client";

/**
 * Souboj — dva poslanci vedle sebe (REÁLNÁ DATA). Dvě patra:
 *
 *  1. SLOŽKY INDEXU — zrcadlené pruhy, pruh = body složky / její váha,
 *     číslo = získané body. Odvozená čísla, ale přiznaně odvozená.
 *  2. FAKTA (2026-08-04) — to, co čtenář opravdu váží: převzatý mandát,
 *     vystoupení v sále, pozměňovací návrhy, interpelace, zpravodajská zátěž
 *     a poctivý korektiv nízkého skóre. Každý fakt ve VLASTNÍ jednotce a proti
 *     SKUTEČNÉMU mediánu sněmovny (konvence z lib/analysis/score-legibility.ts,
 *     odkud se bere i `median()`). Pravidla jsou čistá funkce ../duelFacts.ts.
 *
 * Tři věci, které se tu nesmí stát:
 *  · chybějící údaj se NIKDY nekreslí jako nula („údaj v grafu chybí"),
 *  · `never_seated` poslanec je OZNAČEN — jeho prázdný záznam není nízký výkon,
 *  · PENÍZE se neporovnávají, a je to PRAVIDLO, ne popis dat: vazba prochází
 *    lidskou branou (/penize/kontrola umí zapsat rozhodnutí od e8bf6c8), takže
 *    věta „všech 211 vazeb čeká na kontrolu" — která tu stála do 2026-08-12 —
 *    je od prvního potvrzení nepravdivá. Souboj nesmí z nepotvrzené stopy
 *    udělat zjištění; patička to říká nahlas, bez počtu, který by ji vyvrátil.
 *
 * Verdiktová copy („tichý pracant", „zpravodajský tahoun", korektiv, třída
 * mandátu) se přebírá VERBATIM z lib/analysis/* — žádný druhý copy engine.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import type { LeaderboardData, LeaderboardListEntry } from "../getLeaderboardData";
import { componentWinner, duelOutcome } from "../duel";
import { duelFactRows } from "../duelFacts";
import { contributionScoreClaim } from "../scoreClaim";
import type { ContributionProvenance } from "../provenance";
import { tenureClassLabel } from "@/lib/analysis/tenure-copy";
import { useFormat } from "@/lib/i18n/useFormat";
import type { Claim } from "@/lib/claims/claim";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SourceNote from "@/features/shared/components/SourceNote";
import WorkhorseBadge from "./WorkhorseBadge";
import RapporteurBadge from "./RapporteurBadge";
import LowScoreReasonChip from "./LowScoreReasonChip";

function Fighter({
  row,
  align,
  custom,
  claim,
}: {
  row: LeaderboardListEntry;
  align: "left" | "right";
  custom: boolean;
  /** Citace zveřejněného kompozitu; pod čtenářovou čočkou přichází `undefined`
   *  (viz pravidlo u ražby níž). */
  claim?: Claim;
}) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-2 ${right ? "justify-end" : ""}`}>
        <Link
          href={`/poslanec/${row.pspId}`}
          className="inline-flex items-center gap-1.5 text-2xl font-black uppercase tracking-tight hover:text-signal sm:text-3xl"
        >
          {row.name}
          <ArrowUpRight className="h-5 w-5 text-signal" />
        </Link>
      </div>
      <div className={`mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel ${right ? "justify-end" : ""}`}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.clubColor }} aria-hidden />
        {/* Zkratka z rejstříku vidět, celý název slyšet — `clubName.split(" ")[0]`
            tu z „TOP 09" dělalo „TOP" a z „ANO 2011" „ANO". */}
        <span aria-hidden title={row.clubName}>{row.clubAbbrev}</span>
        <span className="sr-only">{row.clubName}</span> ·{" "}
        {row.tiedCount > 1 ? t("rankShared", { rank: f.int(row.rank) }) : t("rank", { rank: f.int(row.rank) })}
      </div>
      {/* Kobaltová číslice = vaše číslo, ne zveřejněné (konvence z landing LiveSpecimen).
          A právě proto se ČTENÁŘOVO číslo NERAZÍ jako citace — `claim` k němu
          nepřijde (týž zákaz jako v LeaderboardTable a na kartě kraje). */}
      <AnimatedScore
        value={row.score}
        format={f.dec}
        claim={claim}
        className={`mt-2 block text-6xl font-black leading-none tracking-tighter sm:text-7xl ${custom ? "text-cobalt" : ""}`}
      />
      {/* Verdiktová copy VERBATIM z lib/analysis/* — žádný druhý copy engine. */}
      <div className={`mt-2 flex flex-wrap items-center gap-1.5 ${right ? "justify-end" : ""}`}>
        {row.effortWorkhorse && (
          <WorkhorseBadge
            flavour={row.effortWorkhorseFlavour}
            speechTurns={row.duelFacts.speechTurns}
            recordedAt={row.effortRecordedAt}
            compact
          />
        )}
        <RapporteurBadge load={row.effortRapporteurLoad} recordedAt={row.effortRecordedAt} compact />
        {row.effortLowScoreReason && (
          <LowScoreReasonChip
            reason={row.effortLowScoreReason}
            recordedAt={row.effortRecordedAt}
            dateLabel={row.effortRecordedAt ? f.date(row.effortRecordedAt) : null}
          />
        )}
      </div>
    </div>
  );
}

/** Třída mandátu jako PODMÍNKA čtení všech čísel pod ní — ne dekorace.
 *  Kdo mandát nepřevzal, nemá nízký výkon; nemá záznam. */
function TenureLine({ row, align }: { row: LeaderboardListEntry; align: "left" | "right" }) {
  const t = useTranslations("civicscore");
  const copy = tenureClassLabel(row.duelFacts.tenureClass);
  const right = align === "right";
  if (!copy) {
    return (
      <p className={`font-mono text-[10px] uppercase tracking-wider text-steel-aa ${right ? "text-right" : ""}`}>
        {t("graphValueMissing")}
      </p>
    );
  }
  return (
    <p
      title={copy.detail}
      className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
        copy.structural ? "text-signal-deep" : "text-steel-aa"
      } ${right ? "text-right" : ""}`}
    >
      {copy.label}
      <span className="sr-only"> — {copy.detail}</span>
    </p>
  );
}

export default function HeadToHead({
  pair,
  components,
  chamber,
  provenance,
  custom = false,
}: {
  pair: [LeaderboardListEntry, LeaderboardListEntry] | null;
  components: LeaderboardData["components"];
  /** Celá sněmovna, jak ji stránka už drží — pro SKUTEČNÝ medián u každého faktu.
   *  Prop, ne další čtení storu: souboj nesmí sáhnout do databáze. */
  chamber: readonly LeaderboardListEntry[];
  /** Komorový agregát `{pass, ref}` — ZÁKLAD citace skóre. Prop ze stránky,
   *  nikdy druhé čtení: půlkou přepočtená komora nemá jednu provenienci a
   *  ražba pak základ vynechá (scoreClaim.ts, pravidlo 2). */
  provenance: ContributionProvenance;
  /** True = položky i váhy jsou čtenářova čočka (otevřený index) — obě pravidla
   *  z ../duel.ts jsou čisté funkce a běží nad libovolnými vahami beze změny;
   *  jen citace musí říct, čí čísla to jsou. Česká kopie inline (messages/*.json
   *  je ve fleet režimu mimo hranici — týž precedens jako LeaderboardTable). */
  custom?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("civicscore");
  const tcom = useTranslations("common");
  const f = useFormat();

  if (!pair) {
    return (
      <div className="border-2 border-dashed border-hairline p-8">
        <p className="text-base font-black uppercase tracking-wide">{t("emptyTitle")}</p>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel">
          {t("emptyBody")}
        </p>
      </div>
    );
  }

  const [a, b] = pair;
  // Obě čísla souboje se razí TÝMŽ čistým razidlem jako žebříček, spis i karta
  // kraje (../scoreClaim.ts — importované, nikdy druhá ražba téže figury).
  // Pod čtenářovou čočkou se citace ZADRŽUJE: přepočtené skóre v grafu nikde
  // nestojí, takže by adresa vedla k něčemu, co brána nemá proti čemu ověřit.
  const claimFor = (row: LeaderboardListEntry): Claim | undefined =>
    custom ? undefined : contributionScoreClaim(row.pspId, row.score, provenance).claim;
  // Nula není náskok. Dřív `diff >= 0 ? a : b` vyhlásilo vítěze i při shodě a
  // vypsalo „vede o 0,0 b" (36 z 21 321 dvojic má shodné skóre). Pravidlo je
  // čistá funkce s testy — viz ../duel.ts.
  const outcome = duelOutcome(a, b);
  const diffLabel = `${f.dec(outcome.diff)} ${tcom("pts")}`;
  // Fakta a jejich sněmovní mediány — čistá funkce nad tím, co stránka už má.
  const factRows = duelFactRows(a, b, chamber);
  const factSources = [...new Set(factRows.map((r) => r.def.source))].join(" · ");

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${a.pspId}-${b.pspId}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="grid grid-cols-2 items-end gap-6">
          <Fighter row={a} align="left" custom={custom} claim={claimFor(a)} />
          <Fighter row={b} align="right" custom={custom} claim={claimFor(b)} />
        </div>
        {/* Třída mandátu stojí NAD čísly, protože je jejich podmínkou. */}
        <div className="mt-2 grid grid-cols-2 items-start gap-6">
          <TenureLine row={a} align="left" />
          <TenureLine row={b} align="right" />
        </div>
        <p className="mt-3 border-y-2 border-ink py-2 text-center font-mono text-xs font-bold uppercase tracking-widest">
          {outcome.tied
            ? t("tieLine")
            : t.rich("leadLine", {
                name: outcome.leader.name.split(" ").at(-1) ?? outcome.leader.name,
                diffLabel,
                diff: (chunks) => <span className="text-signal">{chunks}</span>,
              })}
        </p>

        <div className="mt-6 space-y-4">
          {components.map((c) => {
            const pa = a.components[c.key];
            const pb = b.components[c.key];
            // Číslo se tiskne na stejné desetině, na jaké složku počítá index, a
            // signální barvu dostane jen skutečně vyšší hodnota. Dřív se tisklo
            // celé číslo (Math.round), ale barvilo se podle nezaokrouhlené — 672
            // ze 127 926 buněk tak ukázalo dvě stejná čísla s jedním „vítězem".
            const va = f.dec(pa);
            const vb = f.dec(pb);
            const winner = componentWinner(pa, pb);
            // Pruh = podíl získaných bodů na max. váze složky. Čtenářova čočka
            // může složku vynulovat — váha 0 pak znamená prázdný pruh, ne NaN.
            const wa = c.weight > 0 ? (pa / c.weight) * 100 : 0;
            const wb = c.weight > 0 ? (pb / c.weight) * 100 : 0;
            // Efektivní váhy čočky jsou na desetiny; zveřejněné jsou celé.
            const weightLabel = Number.isInteger(c.weight) ? f.int(c.weight) : f.dec(c.weight);
            return (
              <div key={c.key} className="grid grid-cols-[3.5rem_1fr_auto_1fr_3.5rem] items-center gap-3">
                <span className={`text-right text-lg font-black tabular-nums ${winner === "a" ? "text-signal" : "text-ink"}`}>
                  {va}
                </span>
                <div className="flex justify-end bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${wa}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className={`min-w-[7.5rem] text-center font-mono text-[11px] font-bold uppercase tracking-wider ${custom ? "text-cobalt" : "text-steel"}`}>
                  {c.label} × {weightLabel}
                </span>
                <div className="flex justify-start bg-hairline">
                  <motion.span
                    className="block h-4 bg-ink"
                    initial={false}
                    animate={{ width: `${wb}%` }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
                  />
                </div>
                <span className={`text-lg font-black tabular-nums ${winner === "b" ? "text-signal" : "text-ink"}`}>
                  {vb}
                </span>
              </div>
            );
          })}
        </div>
        {/* ── Fakta ─────────────────────────────────────────────────────
            Vlastní jednotka, skutečný medián sněmovny, chybějící údaj jako
            chybějící. Pravidla: ../duelFacts.ts (čistá funkce + testy). */}
        <div className="mt-8 border-t-2 border-ink pt-6">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">{t("factsTitle")}</p>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-steel-aa">{t("factsLead")}</p>
          <div className="mt-5 space-y-3">
            {factRows.map((r) => {
              const missing = t("factMissing");
              return (
                <div
                  key={r.def.key}
                  className="grid grid-cols-[4.5rem_1fr_4.5rem] items-baseline gap-3 border-b border-hairline pb-2 sm:grid-cols-[5.5rem_1fr_5.5rem]"
                >
                  <span
                    className={`text-right text-lg font-black tabular-nums ${
                      r.a === null ? "text-steel-aa" : r.winner === "a" ? "text-signal" : "text-ink"
                    }`}
                  >
                    {r.a === null ? <span className="font-mono text-[10px] uppercase tracking-wider">{missing}</span> : f.int(r.a)}
                  </span>
                  <span className="text-center">
                    <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
                      {r.def.label}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                      {r.chamberMedian === null
                        ? t("factNoMedian")
                        : t("factMedian", {
                            value: f.int(r.chamberMedian),
                            unit: r.def.unit,
                            n: f.int(r.chamberN),
                          })}
                    </span>
                  </span>
                  <span
                    className={`text-lg font-black tabular-nums ${
                      r.b === null ? "text-steel-aa" : r.winner === "b" ? "text-signal" : "text-ink"
                    }`}
                  >
                    {r.b === null ? <span className="font-mono text-[10px] uppercase tracking-wider">{missing}</span> : f.int(r.b)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <SourceNote className="!text-[10px]">
              {t("factsSource", { sources: factSources })}
            </SourceNote>
          </div>
          {/* Peníze se v souboji NEPOROVNÁVAJÍ — a mlčení by bylo horší než věta. */}
          <div className="mt-1.5">
            <SourceNote className="!text-[10px]">{t("factsNoMoney")}</SourceNote>
          </div>
        </div>

        <div className="mt-4">
          {custom ? (
            // Zadržená citace se PŘIZNÁVÁ — mlčení by čtenáře nechalo hledat
            // adresu, která nikdy nevznikne. Věta se přebírá VERBATIM z klíče,
            // který na to zavedla karta kraje (`krajLensNoClaim`): je psaná
            // obecně o čočce, ne o kraji, a druhá kopie téže věty by se rozešla.
            <SourceNote>
              {t("lensDuelNote")} · {t("krajLensNoClaim")}
            </SourceNote>
          ) : (
            <SourceNote>
              {t("footnote")}
            </SourceNote>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
