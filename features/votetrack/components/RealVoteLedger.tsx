"use client";

/**
 * Deník hlasování nad REÁLNÝM záznamem — the LEDGER_WINDOW most recent valid
 * roll calls as a selectable chronicle. Each row carries the vote's permanent
 * anchor id (`h-<pspId>`, see record/anchor.ts); selecting a row writes that
 * fragment into the address bar, and arriving with the fragment scrolls to and
 * highlights the row (useVoteAnchor). The mock VoteLedger stays behind the
 * store-outage fallback only.
 */

import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { voteAnchorId } from "../record/anchor";
import type { ClubTally, LedgerVote } from "../record/types";

function RatioBar({ total }: { total: ClubTally }) {
  const seats = total.yes + total.no + total.k + total.away;
  if (seats === 0) return <div className="h-3 w-full bg-hairline" />;
  const w = (n: number) => `${(n / seats) * 100}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden bg-hairline">
      {total.yes > 0 && <span className="h-full bg-cobalt" style={{ width: w(total.yes) }} />}
      {total.k > 0 && <span className="h-full bg-ochre" style={{ width: w(total.k) }} />}
      {total.away > 0 && <span className="h-full bg-hairline" style={{ width: w(total.away) }} />}
      {total.no > 0 && <span className="h-full bg-signal" style={{ width: w(total.no) }} />}
    </div>
  );
}

export default function RealVoteLedger({
  votes,
  selectedId,
  highlightedId,
  onSelect,
  ledgerWindow,
  validTotal,
}: {
  votes: LedgerVote[];
  selectedId: number;
  /** Row arriving via a #h-… permalink — gets the temporary flash treatment. */
  highlightedId: number | null;
  onSelect: (votePspId: number) => void;
  ledgerWindow: number;
  validTotal: number;
}) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  const sessionVote = (session: number | null, vote: number | null) =>
    [
      session !== null ? t("record.sessionLabel", { session }) : null,
      vote !== null ? t("record.voteNumberLabel", { vote }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="min-w-0">
      <div className="border-t-2 border-ink">
        {votes.map((v) => {
          const selected = v.pspId === selectedId;
          const flashed = v.pspId === highlightedId;
          return (
            <button
              key={v.pspId}
              id={voteAnchorId(v.pspId)}
              type="button"
              onClick={() => onSelect(v.pspId)}
              aria-pressed={selected}
              title={t("record.permalinkTitle")}
              className={`block w-full scroll-mt-24 border-b border-hairline py-4 pr-2 text-left transition-colors duration-500 hover:bg-paper-strong motion-reduce:transition-none ${
                selected ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-0"
              } ${flashed ? "bg-paper-strong ring-2 ring-inset ring-signal" : ""}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
                  {v.votedOn ? f.date(v.votedOn) : "—"}
                  {v.time ? ` · ${v.time}` : ""} · {sessionVote(v.sessionNo, v.voteNo)}
                </span>
                <span
                  className={`font-mono text-[11px] font-black uppercase tracking-wider ${
                    v.outcome === "accepted" ? "text-cobalt" : "text-signal-deep"
                  }`}
                >
                  {v.outcome === "accepted" ? tcom("voteResult.accepted") : tcom("voteResult.rejected")}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 block text-[15px] font-bold leading-snug">{v.title}</span>
              <span className="mt-2 block">
                <RatioBar total={v.stat.total} />
              </span>
              <span className="mt-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                <span className="tabular-nums">
                  {f.int(v.stat.total.yes)}:{f.int(v.stat.total.no)}
                </span>
                {v.rebels.length > 0 && (
                  <span className="font-bold text-signal-deep">{t("rebelsCount", { n: v.rebels.length })}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <SourceNote>{t("record.ledgerFootnote", { window: ledgerWindow, valid: validTotal })}</SourceNote>
      </div>
    </div>
  );
}
