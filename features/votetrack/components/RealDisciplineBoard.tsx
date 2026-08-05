"use client";

/**
 * Linie klubů nad REÁLNÝM záznamem — žebříček průměrné disciplíny a soudržnosti
 * (Rice) přes všechna platná hlasování, matice linií nad posledními 12 zápisy
 * deníku a metodická poznámka zveřejňující celé pravidlo výpočtu (vzor
 * stateSlice: ohraničená poznámka + SourceNote).
 */

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { clubStyle } from "../record/clubStyle";
import type { ClubAggregate, LedgerVote, VoteRecordData } from "../record/types";

const MATRIX_WINDOW = 12;

export default function RealDisciplineBoard({
  data,
  onSelectVote,
}: {
  data: VoteRecordData;
  /** Jump the matrix column's vote into the ledger detail. */
  onSelectVote: (votePspId: number) => void;
}) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const ranked: ClubAggregate[] = [...data.clubs].sort(
    (a, b) => (b.avgDiscipline ?? -1) - (a.avgDiscipline ?? -1) || a.club.localeCompare(b.club, "cs"),
  );
  const matrixVotes: LedgerVote[] = data.ledger.slice(0, MATRIX_WINDOW);

  return (
    <div className="min-w-0">
      <div className="grid gap-12 lg:grid-cols-[5fr_7fr]">
        {/* ── žebříček disciplíny ───────────────────────────── */}
        <div className="min-w-0">
          <SourceNote>{t("record.disciplineNote", { valid: data.coverage.valid })}</SourceNote>
          <div className="mt-3 border-t-2 border-ink">
            {ranked.map((c, i) => {
              const style = clubStyle(c.club);
              const pct = c.avgDiscipline === null ? null : c.avgDiscipline * 100;
              return (
                <motion.div
                  key={c.club}
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ delay: reduceMotion ? 0 : i * 0.04 }}
                  className="grid grid-cols-[2rem_7.5rem_1fr_4.5rem] items-center gap-3 border-b border-hairline px-1 py-3.5"
                >
                  <span className={`font-mono text-lg font-bold ${i === 0 ? "text-signal" : "text-steel-aa"}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-black uppercase tracking-tight">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: style.color }} />
                      <span className="truncate">{style.short}</span>
                      <span className="font-mono text-[11px] font-normal text-steel-aa">{c.seats}</span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                      {t("record.cohesionColumn")}{" "}
                      <span className="font-bold tabular-nums">
                        {c.cohesion === null ? "—" : f.dec(Math.round(c.cohesion * 1000) / 10)}
                      </span>
                    </span>
                  </span>
                  <span className="h-4 w-full bg-hairline">
                    <motion.span
                      className="block h-full bg-cobalt"
                      initial={reduceMotion ? false : { width: 0 }}
                      whileInView={{ width: `${pct ?? 0}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : i * 0.04 }}
                    />
                  </span>
                  <span className="text-right text-lg font-black tabular-nums">
                    {pct === null ? <span className="text-steel-aa">—</span> : `${f.dec(Math.round(pct * 10) / 10)} %`}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── matice linií ──────────────────────────────────── */}
        <div className="min-w-0">
          <SourceNote>{t("record.matrixNote")}</SourceNote>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-center">
              <thead>
                <tr>
                  <th className="border-b-2 border-ink py-2 pr-3 text-left font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                    {t("record.partyHeader")}
                  </th>
                  {matrixVotes.map((v) => (
                    <th key={v.pspId} className="border-b-2 border-ink px-1.5 py-2">
                      <button
                        type="button"
                        onClick={() => onSelectVote(v.pspId)}
                        title={v.title}
                        className="font-mono text-[11px] uppercase tracking-wider text-steel-aa transition-colors hover:text-ink motion-reduce:transition-none"
                      >
                        {v.votedOn ? f.date(v.votedOn) : `#${v.pspId}`}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.clubs.map((c) => {
                  const style = clubStyle(c.club);
                  return (
                    <tr key={c.club} className="border-b border-hairline">
                      <td className="py-2.5 pr-3 text-left">
                        <span className="flex items-center gap-1.5 text-sm font-black uppercase">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: style.color }} />
                          {style.short}
                        </span>
                      </td>
                      {matrixVotes.map((v) => {
                        const s = v.stat.byClub[c.club];
                        const disc = s?.discipline ?? null;
                        if (!s || s.line === null || disc === null) {
                          return (
                            <td key={v.pspId} className="px-1.5 py-2.5">
                              <span className="inline-flex min-w-[3.75rem] items-center justify-center border-2 border-dashed border-hairline px-1.5 py-1 font-mono text-xs text-steel-aa">
                                —
                              </span>
                            </td>
                          );
                        }
                        const pct = Math.round(disc * 100);
                        const strong = pct >= 90;
                        return (
                          <td key={v.pspId} className="px-1.5 py-2.5">
                            <span
                              className={`inline-flex min-w-[3.75rem] items-center justify-center gap-1 border-2 px-1.5 py-1 font-mono text-xs font-bold tabular-nums ${
                                s.line === "yes"
                                  ? strong
                                    ? "border-cobalt bg-cobalt text-paper"
                                    : "border-cobalt text-cobalt"
                                  : strong
                                    ? "border-signal-deep bg-signal-deep text-paper"
                                    : "border-signal-deep text-signal-deep"
                              }`}
                            >
                              {s.line === "yes" ? "▲" : "▼"} {f.int(pct)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-md text-sm italic leading-relaxed text-steel-aa">{t("record.matrixFootnote")}</p>
        </div>
      </div>

      {/* ── zveřejněné pravidlo (stateSlice disclosure pattern) ── */}
      <div className="mt-10 border-2 border-ink p-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep">{t("record.methodTitle")}</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">{t("record.methodBody")}</p>
        <SourceNote className="mt-3">
          {t("record.methodSource", {
            valid: data.coverage.valid,
            voided: data.coverage.voided,
            ballots: f.int(data.coverage.ballots),
            from: data.coverage.from ? f.date(data.coverage.from) : "—",
            to: data.coverage.to ? f.date(data.coverage.to) : "—",
          })}
        </SourceNote>
      </div>
    </div>
  );
}
