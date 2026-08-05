"use client";

/**
 * Váš kompas — the alignment board. Everything inside the cobalt frame is the
 * READER's number, never a published one (the "your lens vs official"
 * convention shared with the Otevřený index: cobalt frame + cobalt accents,
 * WeightPanel precedent — no third variant). Ranked MPs, club lines, and a
 * per-vote receipt for every row: each receipt line links to the roll call's
 * permanent `#h-` address. The two disclosed rules print verbatim below.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Link2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { clubStyle } from "../record/clubStyle";
import { voteAnchorId } from "../record/anchor";
import type { AlignmentResult, Answer, MpAlignment } from "./score";
import type { KompasBallots, KompasQuestion } from "./types";

const TOP_ROWS = 15;

const pctText = (rate: number, f: { dec: (n: number) => string }) => `${f.dec(Math.round(rate * 1000) / 10)} %`;

function ShareButton() {
  const t = useTranslations("votetrack");
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(id);
  }, [state]);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(window.location.href).then(
          () => setState("ok"),
          () => setState("fail"),
        )
      }
      className="inline-flex items-center gap-1.5 border-2 border-cobalt px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:bg-cobalt hover:text-paper motion-reduce:transition-none"
    >
      {state === "ok" ? <Check className="h-3 w-3" aria-hidden /> : <Link2 className="h-3 w-3" aria-hidden />}
      {state === "ok" ? t("kompas.shareOk") : state === "fail" ? t("kompas.shareFail") : t("kompas.shareCta")}
    </button>
  );
}

function ClubDot({ club }: { club: string }) {
  const s = clubStyle(club);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: s.color }} aria-hidden />
      <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">{s.short}</span>
    </span>
  );
}

/** Per-vote receipt of one MP row — every line links to the `#h-` permalink. */
function Receipts({
  mp,
  questions,
  ballots,
  answers,
}: {
  mp: MpAlignment;
  questions: readonly KompasQuestion[];
  ballots: KompasBallots;
  answers: ReadonlyMap<number, Answer>;
}) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const choiceWord = (a: Answer) => (a === "pro" ? tcom("voteChoice.for") : tcom("voteChoice.against"));
  return (
    <ul aria-label={t("kompas.receiptsAria", { name: mp.name })} className="mt-2 border-t border-hairline">
      {questions
        .filter((q) => answers.has(q.votePspId))
        .map((q) => {
          const you = answers.get(q.votePspId)!;
          const bucket = ballots[q.votePspId]?.[mp.personPspId] ?? "away";
          const positional = bucket === "yes" || bucket === "no";
          const match = positional && (you === "pro") === (bucket === "yes");
          const verdict = positional
            ? match
              ? t("kompas.receiptMatch")
              : t("kompas.receiptDiffer")
            : bucket === "k"
              ? t("kompas.receiptK")
              : t("kompas.receiptAway");
          return (
            <li
              key={q.votePspId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-hairline py-1.5"
            >
              <Link
                href={`/hlasovani#${voteAnchorId(q.votePspId)}`}
                className="min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline"
                title={q.title}
              >
                {q.title}
              </Link>
              <span className="font-mono text-xs uppercase tracking-wider tabular-nums">
                <span className="text-steel-aa">
                  {t("kompas.receiptYou")} {choiceWord(you)} · {t("kompas.receiptMp")}{" "}
                  {bucket === "yes"
                    ? tcom("voteChoice.for")
                    : bucket === "no"
                      ? tcom("voteChoice.against")
                      : bucket === "k"
                        ? t("kompas.kShort")
                        : t("kompas.awayShort")}{" "}
                  ·{" "}
                </span>
                <span
                  className={`font-black ${
                    positional ? (match ? "text-cobalt" : "text-signal-deep") : "text-steel-aa"
                  }`}
                >
                  {verdict}
                </span>
              </span>
            </li>
          );
        })}
    </ul>
  );
}

function MpRow({
  mp,
  rank,
  questions,
  ballots,
  answers,
}: {
  mp: MpAlignment;
  /** 1-based position on the ranked board; null for the unranked tail. */
  rank: number | null;
  questions: readonly KompasQuestion[];
  ballots: KompasBallots;
  answers: ReadonlyMap<number, Answer>;
}) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-hairline py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="w-8 shrink-0 font-mono text-sm font-bold tabular-nums text-steel-aa">
          {rank !== null ? f.int(rank) : "—"}
        </span>
        <Link
          href={`/poslanec/${mp.personPspId}`}
          className="min-w-0 font-black uppercase tracking-tight underline-offset-2 hover:underline"
        >
          {mp.name}
        </Link>
        {mp.club !== null ? (
          <ClubDot club={mp.club} />
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">{t("kompas.unaffiliated")}</span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-steel-aa">
            {t("kompas.alignmentOf", { matches: mp.matches, comparable: mp.comparable })}
            {mp.kCount > 0 ? ` · ${f.int(mp.kCount)}× ${t("kompas.kShort")}` : ""}
            {mp.awayCount > 0 ? ` · ${f.int(mp.awayCount)}× ${t("kompas.awayShort")}` : ""}
          </span>
          <span className={`font-mono text-lg font-black tabular-nums ${rank !== null ? "text-cobalt" : "text-steel-aa"}`}>
            {mp.rate === null ? "—" : pctText(mp.rate, f)}
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-label={t("kompas.receiptsAria", { name: mp.name })}
            onClick={() => setOpen((o) => !o)}
            className="border border-hairline p-1 text-steel-aa transition-colors hover:border-ink hover:text-ink motion-reduce:transition-none"
          >
            <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </span>
      </div>
      {rank === null && (
        <p className="mt-0.5 pl-12 font-mono text-xs uppercase tracking-wider text-steel-aa">{t("kompas.notRankable")}</p>
      )}
      {open && <Receipts mp={mp} questions={questions} ballots={ballots} answers={answers} />}
    </li>
  );
}

export default function ResultsBoard({
  result,
  questions,
  ballots,
  answers,
  onReset,
  rules,
}: {
  result: AlignmentResult;
  questions: readonly KompasQuestion[];
  ballots: KompasBallots;
  answers: ReadonlyMap<number, Answer>;
  onReset: () => void;
  /** The verbatim disclosed rules + coverage line, rendered inside the frame. */
  rules: { selection: string; scoring: string; source: string };
}) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const [showAll, setShowAll] = useState(false);
  const ranked = result.mps.filter((m) => m.rankable);
  const tail = result.mps.filter((m) => !m.rankable);
  const visible = showAll ? ranked : ranked.slice(0, TOP_ROWS);

  return (
    <div className="border-2 border-cobalt p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
          {t("kompas.yourResultBadge", { answered: result.answered })}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <ShareButton />
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 border-2 border-ink bg-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-ink motion-reduce:transition-none"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t("kompas.resetCta")}
          </button>
        </span>
      </div>

      {/* ── kluby ─────────────────────────────────────────────── */}
      <div className="mt-6">
        <h3 className="text-xl font-black uppercase tracking-tight">
          {t("kompas.clubsBoard")}
          <span className="text-cobalt">.</span>
        </h3>
        <div className="mt-1">
          <SourceNote>{t("kompas.clubsBoardNote")}</SourceNote>
        </div>
        <ul className="mt-3">
          {result.clubs.map((c) => {
            const s = clubStyle(c.club);
            return (
              <li key={c.club} className="flex items-center gap-3 border-b border-hairline py-2">
                <span className="inline-block h-3 w-3 shrink-0" style={{ background: s.color }} aria-hidden />
                <span className="w-28 shrink-0 truncate font-black uppercase tracking-tight">{s.short}</span>
                <span className="h-3 flex-1 bg-hairline">
                  <span
                    className={`block h-full ${c.rankable ? "bg-cobalt" : "bg-hairline"}`}
                    style={{ width: `${(c.rate ?? 0) * 100}%` }}
                    aria-hidden
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-steel-aa">
                  {c.comparable > 0
                    ? t("kompas.alignmentOf", { matches: c.matches, comparable: c.comparable })
                    : t("kompas.noComparable")}
                </span>
                <span
                  className={`w-16 shrink-0 text-right font-mono text-base font-black tabular-nums ${
                    c.rankable ? "text-cobalt" : "text-steel-aa"
                  }`}
                >
                  {c.rate === null ? "—" : pctText(c.rate, f)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── poslanci ──────────────────────────────────────────── */}
      <div className="mt-8">
        <h3 className="text-xl font-black uppercase tracking-tight">
          {t("kompas.mpsBoard")}
          <span className="text-cobalt">.</span>
        </h3>
        <div className="mt-1">
          <SourceNote>{t("kompas.mpsBoardNote")}</SourceNote>
        </div>
        <ul className="mt-3">
          {visible.map((mp, i) => (
            <MpRow key={mp.personPspId} mp={mp} rank={i + 1} questions={questions} ballots={ballots} answers={answers} />
          ))}
        </ul>
        {ranked.length > TOP_ROWS && (
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((s) => !s)}
            className="mt-3 border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-paper-strong motion-reduce:transition-none"
          >
            {showAll ? t("kompas.showLess") : t("kompas.showAll", { n: ranked.length })}
          </button>
        )}
        {tail.length > 0 && showAll && (
          <div className="mt-6">
            <SourceNote>{t("kompas.unrankedTail", { n: tail.length })}</SourceNote>
            <ul className="mt-2">
              {tail.map((mp) => (
                <MpRow key={mp.personPspId} mp={mp} rank={null} questions={questions} ballots={ballots} answers={answers} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── zveřejněná pravidla (stateSlice bordered-note pattern) ── */}
      <div className="mt-8 border-l-4 border-cobalt pl-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">{t("kompas.rulesTitle")}</p>
        <div className="mt-2 space-y-2">
          <SourceNote>{rules.selection}</SourceNote>
          <SourceNote>{rules.scoring}</SourceNote>
          <SourceNote>{rules.source}</SourceNote>
        </div>
      </div>
    </div>
  );
}
