"use client";

/**
 * Pohled do sálu — detail jednoho REÁLNÉHO hlasování: hemicykl z 200 skutečných
 * hlasů, sečtená legenda, rozpad po klubech s linií + disciplínou (pravidlo
 * zveřejněno v metodické poznámce sekce 03) a jmenovitý seznam rebelů s
 * proklikem na skutečné profily /poslanec/<pspId>. Každé číslo cituje psp.cz —
 * titulek odkazuje přímo na záznam hlasování.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { votePspUrl } from "../record/anchor";
import { clubStyle, wedgeSort } from "../record/clubStyle";
import type { LedgerVote } from "../record/types";
import RealHemicycle from "./RealHemicycle";

const LEGEND = [
  { key: "yes", cls: "bg-cobalt" },
  { key: "no", cls: "bg-signal" },
  { key: "k", cls: "bg-ochre" },
  { key: "away", cls: "bg-steel" },
] as const;

export default function RealChamberDetail({ vote }: { vote: LedgerVote }) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const legendLabel = (key: (typeof LEGEND)[number]["key"]): string =>
    key === "yes"
      ? tcom("voteChoice.for")
      : key === "no"
        ? tcom("voteChoice.against")
        : key === "k"
          ? t("record.legendK")
          : t("record.legendAway");
  const sessionVote = (session: number | null, voteNo: number | null) =>
    [
      session !== null ? t("record.sessionLabel", { session }) : null,
      voteNo !== null ? t("record.voteNumberLabel", { vote: voteNo }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const clubs = wedgeSort(Object.keys(vote.stat.byClub));
  const un = vote.stat.unaffiliated;
  const unSeats = un.yes + un.no + un.k + un.away;

  // ── kolik hlasů bylo potřeba ────────────────────────────────────────────────
  // Tři sloupce zdroje (přítomní · práh · zveřejněné „pro") a dvě ODVOZENÁ čísla
  // vedle nich (rozdíl proti prahu · prostá většina přítomných). Chybějící sloupec
  // se vysází slovem, nikdy nulou — a rozdíl se z ničeho nedopočítává.
  const th = vote.threshold;
  const marginSentence =
    th.margin === null
      ? t("record.thresholdMarginUnknown")
      : th.margin === 0
        ? t("record.thresholdExact")
        : th.margin > 0
          ? t("record.thresholdOver", { n: th.margin, nFmt: f.int(th.margin) })
          : t("record.thresholdUnder", { n: -th.margin, nFmt: f.int(-th.margin) });
  // „Práh se liší" je ÚDAJ; jaké pravidlo za ním stojí, zdroj u hlasování nenese,
  // takže se tu žádný předpis nejmenuje — vedle rozdílu stojí jen prostá většina
  // přítomných, aby si ho čtenář mohl přepočítat.
  const simpleSentence =
    th.differs === null || th.simpleMajority === null
      ? t("record.thresholdUnassessed")
      : th.differs
        ? t("record.thresholdDiffers", { simple: f.int(th.simpleMajority) })
        : t("record.thresholdSimple");
  const thresholdCells = [
    { id: "present", label: t("record.thresholdPresent"), value: th.present },
    { id: "quorum", label: t("record.thresholdQuorum"), value: th.quorum },
    { id: "yes", label: t("record.thresholdYes"), value: th.publishedYes },
  ];

  return (
    <motion.div
      key={vote.pspId}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-w-0"
    >
      <div className="border-b-2 border-ink pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
            {vote.votedOn ? f.date(vote.votedOn) : "—"}
            {vote.time ? ` · ${vote.time}` : ""} · {sessionVote(vote.sessionNo, vote.voteNo)}
          </span>
          <span
            className={`font-mono text-lg font-black uppercase tracking-wider ${
              vote.outcome === "accepted" ? "text-cobalt" : "text-signal"
            }`}
          >
            {vote.outcome === "accepted" ? tcom("voteResult.accepted") : tcom("voteResult.rejected")}
          </span>
        </div>
        <h3 className="mt-1 text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">{vote.title}</h3>
        <a
          href={votePspUrl(vote.pspId)}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-steel-aa transition-colors hover:text-ink motion-reduce:transition-none"
        >
          {t("record.pspSource")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <div className="mt-6">
        <RealHemicycle vote={vote} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {LEGEND.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
            <span className={`inline-block h-3 w-3 ${s.cls}`} />
            <span className="font-bold tabular-nums">{f.int(vote.stat.total[s.key])}</span>
            <span className="text-steel-aa">{legendLabel(s.key)}</span>
          </span>
        ))}
      </div>

      {vote.stat.cohesion !== null && (
        <p className="mt-3 text-center font-mono text-xs uppercase tracking-wider text-steel-aa">
          {t("record.chamberCohesionLabel")}{" "}
          <span className="font-bold tabular-nums text-cobalt">{f.int(Math.round(vote.stat.cohesion * 100))} %</span>
        </p>
      )}

      {/* ── kolik hlasů bylo potřeba ──────────────────────────── */}
      <div className="mt-8 border-t-2 border-ink pt-4">
        <h4 className="font-mono text-xs font-black uppercase tracking-wider">{t("record.thresholdTitle")}</h4>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {thresholdCells.map((cell) => (
            <div key={cell.id} className="border-l-2 border-hairline pl-2">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">{cell.label}</dt>
              <dd className="mt-0.5 font-mono text-lg font-black tabular-nums">
                {/* Chybějící sloupec je věta, ne nula: „zdroj to neuvádí" a
                    „bylo potřeba nula hlasů" jsou dvě různá tvrzení. */}
                {cell.value === null ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-steel-aa">
                    {t("record.thresholdUnstated")}
                  </span>
                ) : (
                  f.int(cell.value)
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
            {t("record.thresholdDerived")}
          </span>
          <p className="mt-1 text-sm leading-relaxed">{marginSentence}</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">{simpleSentence}</p>
        </div>
        <div className="mt-3">
          <SourceNote>{t("record.thresholdNote")}</SourceNote>
        </div>
      </div>

      {/* ── rozpad po klubech ─────────────────────────────────── */}
      <div className="mt-8 border-t-2 border-ink pt-4">
        <SourceNote>{t("record.splitNote")}</SourceNote>
        <div className="mt-4 space-y-3">
          {clubs.map((club) => {
            const s = vote.stat.byClub[club];
            const style = clubStyle(club);
            const seats = s.yes + s.no + s.k + s.away;
            const w = (n: number) => `${(n / Math.max(1, seats)) * 100}%`;
            return (
              <div key={club} className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: style.color }} />
                  {style.short}
                </span>
                <div className="flex h-4 w-full overflow-hidden bg-hairline">
                  {s.yes > 0 && <span className="h-full bg-cobalt" style={{ width: w(s.yes) }} />}
                  {s.k > 0 && <span className="h-full bg-ochre" style={{ width: w(s.k) }} />}
                  {s.away > 0 && <span className="h-full bg-steel" style={{ width: w(s.away) }} />}
                  {s.no > 0 && <span className="h-full bg-signal" style={{ width: w(s.no) }} />}
                </div>
                <span className="text-right font-mono text-[11px] font-bold uppercase tabular-nums">
                  {s.line === null || s.discipline === null ? (
                    // Tie or no positional ballots — no line exists; never a
                    // fabricated arrow.
                    <span className="text-steel-aa">—</span>
                  ) : (
                    <>
                      <span className={s.line === "yes" ? "text-cobalt" : "text-signal-deep"}>
                        {s.line === "yes" ? "▲" : "▼"}
                      </span>{" "}
                      <span className="text-steel-aa">{f.int(Math.round(s.discipline * 100))} %</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {unSeats > 0 && (
            <div className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
                {t("record.unaffiliated")}
              </span>
              <div className="flex h-4 w-full overflow-hidden bg-hairline">
                {un.yes > 0 && <span className="h-full bg-cobalt" style={{ width: `${(un.yes / unSeats) * 100}%` }} />}
                {un.k > 0 && <span className="h-full bg-ochre" style={{ width: `${(un.k / unSeats) * 100}%` }} />}
                {un.away > 0 && <span className="h-full bg-steel" style={{ width: `${(un.away / unSeats) * 100}%` }} />}
                {un.no > 0 && <span className="h-full bg-signal" style={{ width: `${(un.no / unSeats) * 100}%` }} />}
              </div>
              <span className="text-right font-mono text-[11px] font-bold text-steel-aa">—</span>
            </div>
          )}
        </div>
      </div>

      {/* ── rebelové tohoto hlasování ─────────────────────────── */}
      <div className="mt-8 border-t-2 border-ink pt-4">
        <SourceNote>{t("record.voteRebelsNote")}</SourceNote>
        {vote.rebels.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-steel-aa">{t("record.noRebelsInVote")}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {vote.rebels.map((r) => (
              <Link
                key={r.personPspId}
                href={`/poslanec/${r.personPspId}`}
                className="group inline-flex items-center gap-2 border-2 border-hairline px-3 py-2 transition-colors hover:border-ink motion-reduce:transition-none"
              >
                <span className="text-sm font-bold">{r.name}</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
                  {clubStyle(r.club).short}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
                    r.choice === "yes" ? "text-cobalt" : "text-signal-deep"
                  }`}
                >
                  {r.choice === "yes" ? tcom("voteChoice.for") : tcom("voteChoice.against")}
                </span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-steel-aa transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
