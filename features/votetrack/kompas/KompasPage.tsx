"use client";

/*
 * Volební kompas naruby (moonshot 5B) — the inverted election compass.
 * Ordinary compasses score stated intentions; this one scores revealed
 * behaviour: the reader takes positions on ~20 REAL divisive roll calls
 * (picked by the disclosed rule in select.ts), and per-MP / per-club
 * alignment is computed deterministically from the actual PSP10 ballots
 * (score.ts). The whole result lives in the URL (?hlasy=…) — shareable,
 * no accounts. Cobalt = your numbers (the Otevřený-index convention);
 * every receipt line links into the `#h-` permalink namespace.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { useFormat } from "@/lib/i18n/useFormat";
import QuestionCard from "./QuestionCard";
import ResultsBoard from "./ResultsBoard";
import { MIN_ANSWERS, scoreAlignment } from "./score";
import { MIN_POSITIONAL, PER_THEME_CAP, QUESTIONS_CAP } from "./select";
import type { KompasData } from "./types";
import { useKompasAnswers } from "./useKompasAnswers";

/** Stejná mez jako na /hlasovani a /penize — importovaná, nikdy předeklarovaná. */
const RECORD_MEMO_HOURS = MONEY_MEMO_TTL_MS / 3_600_000;

export default function KompasPage({ data }: { data: KompasData }) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const { answers, setAnswer, reset } = useKompasAnswers();

  const result = useMemo(
    () => scoreAlignment(data.questions, data.mps, data.ballots, data.clubLines, answers),
    [data, answers],
  );

  const rules = useMemo(
    () => ({
      selection: t("kompas.selectionRule", {
        cap: QUESTIONS_CAP,
        perTheme: PER_THEME_CAP,
        minPositional: MIN_POSITIONAL,
      }),
      scoring: t("kompas.scoringRule"),
      source: t("kompas.rulesSource", {
        valid: data.coverage.valid,
        tagged: data.coverage.tagged,
        candidates: data.coverage.candidates,
        from: data.coverage.from ? f.date(data.coverage.from) : "—",
        to: data.coverage.to ? f.date(data.coverage.to) : "—",
      }),
      freshness: t("kompas.freshness", { hours: f.int(RECORD_MEMO_HOURS) }),
    }),
    [data.coverage, f, t],
  );

  const total = data.questions.length;
  const answered = result.answered;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ kompas</span>
          <Link
            href="/hlasovani"
            className="font-mono text-xs uppercase tracking-widest text-steel-aa underline-offset-2 hover:text-ink hover:underline"
          >
            {t("kompas.backToVotes")} →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("kompas.heroNote")}</SourceNote>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            {t("kompas.title")}
            <span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">{t("kompas.lead")}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel-aa">{t("kompas.howTo")}</p>
        </div>

        {/* ── 01 Otázky ─────────────────────────────────────── */}
        <section id="otazky">
          <SectionHeading index={1} title={t("kompas.questionsTitle")} aside={<SourceNote>{t("kompas.questionsNote", { n: total })}</SourceNote>} />

          {/* postup — kobalt = váš stav */}
          <div className="mt-6" role="status" aria-label={t("kompas.progressAria", { answered, total })}>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
              {t("kompas.progress", { answered, total })}
            </p>
            <div className="mt-1.5 h-1.5 w-full max-w-md bg-hairline">
              <div
                className="h-full bg-cobalt transition-[width] motion-reduce:transition-none"
                style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {data.questions.map((q, i) => (
              <QuestionCard
                key={q.votePspId}
                question={q}
                index={i}
                answer={answers.get(q.votePspId) ?? null}
                onAnswer={setAnswer}
              />
            ))}
          </div>
        </section>

        {/* ── 02 Váš kompas ─────────────────────────────────── */}
        <section id="vysledek" className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading index={2} title={t("kompas.resultsTitle")} aside={<SourceNote>{t("kompas.resultsNote")}</SourceNote>} />
          <div className="mt-8">
            {answered >= MIN_ANSWERS ? (
              <ResultsBoard
                result={result}
                questions={data.questions}
                ballots={data.ballots}
                answers={answers}
                onReset={reset}
                rules={rules}
              />
            ) : (
              <div className="border-2 border-hairline p-6">
                <p className="text-base leading-relaxed text-steel">{t("kompas.needMore", { min: MIN_ANSWERS, answered })}</p>
                <div className="mt-3 border-l-4 border-cobalt pl-4">
                  <SourceNote>{rules.selection}</SourceNote>
                  <div className="mt-2">
                    <SourceNote>{rules.source}</SourceNote>
                  </div>
                  <div className="mt-2">
                    <SourceNote>{rules.freshness}</SourceNote>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
