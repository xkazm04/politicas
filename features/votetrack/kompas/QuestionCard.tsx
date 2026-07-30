"use client";

/**
 * One question of the kompas — a REAL roll call, described only by its own
 * metadata: the literal psp.cz title, session/vote number, date, the full
 * chamber tally and the outcome. No authored summary anywhere (brand rule:
 * zero editorializing). Answered cards flip to the cobalt "your number"
 * convention (landing LiveSpecimen / WeightPanel precedent).
 */

import Link from "next/link";
import { useFormat } from "@/lib/i18n/useFormat";
import { themeLabel } from "../themeLabels";
import { voteAnchorId, votePspUrl } from "../record/anchor";
import type { ClubTally } from "../record/types";
import { KOMPAS_COPY as C } from "./copy";
import type { Answer } from "./score";
import type { KompasQuestion } from "./types";

/** The ledger's tally-bar language (RealVoteLedger): cobalt pro · ochre K ·
 * hairline away · signal proti. */
function TallyBar({ total }: { total: ClubTally }) {
  const seats = total.yes + total.no + total.k + total.away;
  if (seats === 0) return <div className="h-3 w-full bg-hairline" />;
  const w = (n: number) => `${(n / seats) * 100}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden bg-hairline" aria-hidden>
      {total.yes > 0 && <span className="h-full bg-cobalt" style={{ width: w(total.yes) }} />}
      {total.k > 0 && <span className="h-full bg-ochre" style={{ width: w(total.k) }} />}
      {total.away > 0 && <span className="h-full bg-hairline" style={{ width: w(total.away) }} />}
      {total.no > 0 && <span className="h-full bg-signal" style={{ width: w(total.no) }} />}
    </div>
  );
}

export default function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
}: {
  question: KompasQuestion;
  index: number;
  answer: Answer | null;
  onAnswer: (votePspId: number, answer: Answer | null) => void;
}) {
  const f = useFormat();
  const q = question;
  const answered = answer !== null;
  const session =
    q.sessionNo !== null && q.voteNo !== null ? `${q.sessionNo}. schůze · hlasování č. ${q.voteNo}` : null;

  return (
    <article
      aria-label={C.cardAria(q.title)}
      className={`flex flex-col border-2 p-5 transition-colors motion-reduce:transition-none ${
        answered ? "border-cobalt" : "border-ink"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
          /{String(index + 1).padStart(2, "0")}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
          {themeLabel(q.theme)}
          {q.votedOn ? ` · ${f.date(q.votedOn)}` : ""}
        </span>
      </div>

      <h3 className="mt-2 text-[15px] font-bold leading-snug">{q.title}</h3>

      <div className="mt-3">
        <TallyBar total={q.total} />
        <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs tabular-nums text-steel-aa">
          <span>
            {/* citation-ok: sčítání sálu cituje odkaz psp.cz v patičce karty + zdrojový řádek pravidel na stránce (KompasPage rulesSource) */}
            {C.chamberResult}: {f.int(q.total.yes)} pro · {f.int(q.total.no)} proti · {f.int(q.total.k)}{" "}
            {C.kShort} ·{" "}
            <span
              className={`font-black uppercase ${q.outcome === "accepted" ? "text-cobalt" : "text-signal-deep"}`}
            >
              {q.outcome === "accepted" ? C.outcomeAccepted : C.outcomeRejected}
            </span>
          </span>
          {session && <span>{session}</span>}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={answer === "pro"}
          onClick={() => onAnswer(q.votePspId, answer === "pro" ? null : "pro")}
          className={`border-2 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors motion-reduce:transition-none ${
            answer === "pro"
              ? "border-cobalt bg-cobalt text-paper"
              : "border-ink text-ink hover:bg-paper-strong"
          }`}
        >
          {C.answerPro}
        </button>
        <button
          type="button"
          aria-pressed={answer === "proti"}
          onClick={() => onAnswer(q.votePspId, answer === "proti" ? null : "proti")}
          className={`border-2 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors motion-reduce:transition-none ${
            answer === "proti"
              ? "border-signal-deep bg-signal-deep text-paper"
              : "border-ink text-ink hover:bg-paper-strong"
          }`}
        >
          {C.answerProti}
        </button>
        {answered ? (
          <span aria-live="polite" className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt">
            {answer === "pro" ? C.answeredPro : C.answeredProti}
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">{C.answerSkip}</span>
        )}
      </div>

      <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-3 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/hlasovani#${voteAnchorId(q.votePspId)}`}
          className="text-steel-aa underline-offset-2 hover:text-ink hover:underline"
        >
          {C.recordLink} →
        </Link>
        <a
          href={votePspUrl(q.votePspId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-steel-aa underline-offset-2 hover:text-ink hover:underline"
        >
          {C.pspLink} ↗
        </a>
      </p>
    </article>
  );
}
