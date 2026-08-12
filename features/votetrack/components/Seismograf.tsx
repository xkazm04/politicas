"use client";

/**
 * Seismograf sněmovny — the hero instrument: one column per voting day over the
 * FULL real ledger. Below the baseline, the needle deflects by how much the
 * clubs split that day (1 − mean chamber cohesion); above it, red spikes count
 * votes cast against a member's own club line. Keyboard: every day is a real
 * <button> (aria-pressed); the detail panel narrates the selected day and can
 * jump to the day's tightest vote in the ledger (or to psp.cz when it is
 * outside the shipped window). Entry animation is one-shot and gated by
 * useReducedMotion.
 *
 * NEMĚŘENO NENÍ NULA (2026-08-12): den, ve kterém žádný klub nedosáhl na
 * MIN_CLUB_POSITIONAL pozičních hlasů, nemá soudržnost — kreslí se čárkovanou
 * značkou, ne (jako dřív) pahýlem k nerozeznání od dokonalé jednoty, popisek dne
 * to říká slovem a počet takových dnů stojí pod nástrojem vedle hlasování, která
 * do seismogramu nespadla, protože je zdroj nedatoval.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MIN_CLUB_POSITIONAL } from "@/lib/analysis/kg";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { votePspUrl } from "../record/anchor";
import type { SeismoDay, VoteRecordData } from "../record/types";

/**
 * Zisk zobrazení výchylky: střední Rice na reálných dnech sedí ~0,75–1,0, takže
 * syrový pruh (1 − soudržnost) by byl neviditelný. Odchylka 0,5 (soudržnost 50 %)
 * vyplní spodní polovinu celou.
 *
 * OBĚ STUPNICE JSOU USEKNUTÉ (`Math.min(1, …)` níž): den se soudržností pod dnem
 * stupnice se kreslí stejně jako den přesně na dně a den s dvojnásobkem rebelských
 * hlasů stejně jako den na stropu. To je tvrzení o obrázku, které si čtenář nemá
 * jak ověřit — do 2026-08-12 tu stálo, že mez „zveřejňují popisky osy", což byla
 * nepravda: jediný popisek pod pruhem je řada měsíců a ta je `aria-hidden`. Mez se
 * proto tiskne pod nástrojem (`record.seismoScale`) a OBĚ hodnoty se do věty
 * interpolují odsud, nikdy se do katalogu nepřepisují.
 */
const DEVIATION_FULL_SCALE = 0.5;
/** Rebel spikes saturate at this many rebel ballots per day. */
const REBELS_FULL_SCALE = 40;

/** Čtenářský tvar dna výchylky: procento soudržnosti, při kterém je jehla na dně
 *  (odchylka 0,5 → soudržnost 50 %). Odvozeno z konstanty, ne z textu. */
const DEVIATION_FLOOR_PCT = Math.round((1 - DEVIATION_FULL_SCALE) * 100);

/**
 * Výchylka dne v procentech poloviny pruhu. Volá se JEN nad dnem, který
 * soudržnost má: `meanCohesion === null` znamená, že se ten den soudržnost
 * NEDALA ZMĚŘIT (žádný klub nedosáhl na MIN_CLUB_POSITIONAL pozičních hlasů), a
 * do 2026-08-12 se takový den kreslil jako `pctDown → 0`, tedy pixel po pixelu
 * stejně jako den s dokonalou jednotou 1,0 — přesně to, co vedle stálo
 * v popisku („jednotné kluby = žádná výchylka"). Neměřeno není nula: nezměřený
 * den má vlastní čárkovanou značku a počítá se pod nástrojem.
 */
const pctDown = (meanCohesion: number): number =>
  Math.min(1, (1 - meanCohesion) / DEVIATION_FULL_SCALE) * 100;
const pctUp = (d: SeismoDay): number => Math.min(1, d.rebels / REBELS_FULL_SCALE) * 100;

export default function Seismograf({
  data,
  onJumpToVote,
}: {
  data: VoteRecordData;
  /** Select + scroll a ledger vote (only called with ids inside the window). */
  onJumpToVote: (votePspId: number) => void;
}) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const days = data.seismogram;
  const [selectedDate, setSelectedDate] = useState<string | null>(days.length ? days[days.length - 1].date : null);
  const selected = days.find((d) => d.date === selectedDate) ?? null;

  // First day of each month gets a tick label.
  const monthTick = (i: number): string | null => {
    const m = days[i].date.slice(0, 7);
    if (i > 0 && days[i - 1].date.slice(0, 7) === m) return null;
    return `${Number(m.slice(5, 7))}/${m.slice(2, 4)}`;
  };

  /** Nezměřená soudržnost dostane SLOVO, ne pomlčku: „—" se čte jako chybějící
   *  buňka tabulky, kdežto tady jde o tvrzení („žádný klub nedosáhl na práh"),
   *  které stránka umí vysvětlit. Táž věta jde do popisku i do aria-label. */
  const cohesionText = (v: number | null): string =>
    v === null ? t("record.seismoUnmeasured") : `${f.int(Math.round(v * 100))} %`;

  /** Dny, ve kterých se soudržnost nedala změřit — populace čárkovaných značek.
   *  Bez čísla pod nástrojem by značka byla jen dalším nevysvětleným tvarem. */
  const unmeasuredDays = days.reduce((n, d) => (d.meanCohesion === null ? n + 1 : n), 0);

  return (
    <div className="min-w-0">
      <p className="max-w-3xl text-[15px] leading-relaxed text-steel-aa">{t("record.seismoExplainer")}</p>

      {/* ── strip ─────────────────────────────────────────────── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-6"
        role="group"
        aria-label={t("record.seismoAria")}
      >
        <div className="relative flex h-36 items-stretch border-x-2 border-ink">
          {/* baseline */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink" />
          {days.map((d) => {
            const active = d.date === selectedDate;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                aria-pressed={active}
                aria-label={t("record.seismoDayAria", {
                  date: f.date(d.date),
                  votes: d.votes,
                  cohesion: cohesionText(d.meanCohesion),
                  rebels: d.rebels,
                })}
                className={`group relative min-w-0 flex-1 transition-colors motion-reduce:transition-none ${
                  active ? "bg-paper-strong" : "hover:bg-paper-strong"
                }`}
              >
                {/* rebel spike — above the baseline */}
                {d.rebels > 0 && (
                  <span
                    aria-hidden
                    className="absolute bottom-1/2 left-1/2 w-[2px] -translate-x-1/2 bg-signal"
                    style={{ height: `${Math.max(4, pctUp(d) * 0.5)}%` }}
                  />
                )}
                {/* cohesion deviation — below the baseline.
                    Nezměřený den (žádný klub nad prahem) NEKRESLÍ výchylku:
                    dostane čárkovanou značku v tlumené barvě, aby ho nešlo
                    zaměnit s dnem, ve kterém se kluby neštěpily. Dva různé
                    fakty, dva různé tvary. */}
                {d.meanCohesion === null ? (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 h-3 w-0 -translate-x-1/2 border-l-2 border-dashed border-steel-aa"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={`absolute left-1/2 top-1/2 w-[2px] -translate-x-1/2 ${active ? "bg-cobalt" : "bg-ink group-hover:bg-cobalt"}`}
                    style={{ height: `${Math.max(2, pctDown(d.meanCohesion) * 0.5)}%` }}
                  />
                )}
                {/* active marker on the baseline */}
                {active && (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal" />
                )}
              </button>
            );
          })}
        </div>
        {/* month ticks */}
        <div aria-hidden className="flex border-x-2 border-t border-ink">
          {days.map((d, i) => {
            const tick = monthTick(i);
            return (
              <span key={d.date} className="relative min-w-0 flex-1">
                {tick && (
                  <span className="absolute left-0 top-0 whitespace-nowrap pt-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
                    {tick}
                  </span>
                )}
              </span>
            );
          })}
          <span className="h-6" />
        </div>
      </motion.div>

      {/* Obě stupnice mají dno a strop — a obrázek to sám o sobě neřekne.
          Hodnoty se interpolují z konstant výš, aby se změnou zisku změnila
          i věta (vzor PUBLISHED_WEIGHTS_LABEL). */}
      <SourceNote className="mt-3">
        {t("record.seismoScale", {
          deviationScale: f.int(DEVIATION_FLOOR_PCT),
          rebelsScale: f.int(REBELS_FULL_SCALE),
        })}
      </SourceNote>

      {/* Co nástroj SKUTEČNĚ kreslí a co z platného záznamu do něj nespadlo.
          Dvě ztráty, obě spočítané v derivaci a obě pojmenované: hlasování bez
          data (coverage.withoutDate — kbelík je den, takže nemá kam) a dny bez
          měřitelné soudržnosti (žádný klub nad prahem). Do 2026-08-12 první
          mizela beze slova a druhá se kreslila jako nula. */}
      <SourceNote className="mt-1">
        {t("record.seismoCoverage", {
          dated: f.int(data.coverage.valid - data.coverage.withoutDate),
          days: f.int(days.length),
          withoutDate: f.int(data.coverage.withoutDate),
          unmeasured: f.int(unmeasuredDays),
          minClubPositional: f.int(MIN_CLUB_POSITIONAL),
        })}
      </SourceNote>

      {/* ── detail panel for the selected day ─────────────────── */}
      {selected && (
        <div className="mt-4 border-2 border-ink">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-hairline px-4 py-3">
            <span className="font-mono text-sm font-black uppercase tracking-wider">{f.date(selected.date)}</span>
            <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
              {f.int(selected.votes)} {t("record.seismoVotes")}
            </span>
            <span className="font-mono text-xs uppercase tracking-wider">
              <span className="text-steel-aa">{t("record.seismoCohesion")} </span>
              {/* Neměřeno se ani nesází jako číslo: tlumená barva a slovo, aby
                  se nedalo přečíst jako naměřená hodnota. */}
              <span
                className={`font-bold ${selected.meanCohesion === null ? "text-steel-aa" : "tabular-nums text-cobalt"}`}
              >
                {cohesionText(selected.meanCohesion)}
              </span>
            </span>
            <span className="font-mono text-xs uppercase tracking-wider">
              <span className="text-steel-aa">{t("record.seismoRebels")} </span>
              <span className={`font-bold tabular-nums ${selected.rebels > 0 ? "text-signal-deep" : "text-steel-aa"}`}>
                {f.int(selected.rebels)}
              </span>
            </span>
          </div>
          <div className="px-4 py-3">
            {selected.worst ? (
              <>
                <SourceNote>
                  {t("record.seismoWorst")} {cohesionText(selected.worst.cohesion)}
                </SourceNote>
                <p className="mt-1 text-[15px] font-bold leading-snug">{selected.worst.title}</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {selected.worst.inLedger && (
                    <button
                      type="button"
                      onClick={() => onJumpToVote(selected.worst!.pspId)}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal motion-reduce:transition-none"
                    >
                      {t("record.seismoJump")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <a
                    href={votePspUrl(selected.worst.pspId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-steel-aa transition-colors hover:text-ink motion-reduce:transition-none"
                  >
                    {t("record.seismoPspLink")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
              </>
            ) : (
              <SourceNote>{t("record.seismoNoCohesion")}</SourceNote>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
