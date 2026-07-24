"use client";

/**
 * Témata hlasování — the first surface driven by REAL store data: the Silver-layer
 * `vote_tag` dataset (haiku sem_classify, benchmarked in docs/hybrid-benchmark-plan.md)
 * joined to real PSP10 roll calls. Theme chips filter the vote list. Every count
 * cites how the tag was made (model), per the brand rule.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { themeLabel } from "../themeLabels";
import type { VoteThemeData } from "../themeTypes";
import SourceNote from "@/features/shared/components/SourceNote";

const KNOWN_RESULT = new Set(["accepted", "rejected"]);

export default function VoteThemeFilter({ data }: { data: VoteThemeData }) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const [selected, setSelected] = useState<string | null>(null);

  const shown = selected ? data.votes.filter((v) => v.theme === selected) : data.votes;

  const chip = (active: boolean) =>
    `border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
      active
        ? "border-ink bg-ink text-paper"
        : "border-hairline text-steel hover:border-ink hover:text-ink"
    }`;

  return (
    <div className="min-w-0">
      {/* ── Filtr témat ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelected(null)} className={chip(selected === null)}>
          {t("themeAll")} · {data.total}
        </button>
        {data.themes.map((th) => (
          <button
            key={th.slug}
            type="button"
            onClick={() => setSelected((s) => (s === th.slug ? null : th.slug))}
            className={chip(selected === th.slug)}
            aria-pressed={selected === th.slug}
          >
            {themeLabel(th.slug)} · {th.count}
          </button>
        ))}
      </div>

      {/* ── Hlasování ve vybraném tématu ────────────────────── */}
      <div className="mt-6 border-t-2 border-ink">
        {shown.slice(0, 80).map((v) => (
          <div key={v.votePspId} className="border-b border-hairline py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-steel">
                {v.votedOn ?? "—"} · {themeLabel(v.theme)}
              </span>
              <span
                className={`font-mono text-[11px] font-black uppercase tracking-wider ${
                  v.outcome === "accepted" ? "text-cobalt" : "text-signal"
                }`}
              >
                {KNOWN_RESULT.has(v.outcome) ? tcom(`voteResult.${v.outcome}`) : v.outcome}
              </span>
            </div>
            <span className="mt-1 block text-[15px] font-bold leading-snug">{v.title}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <SourceNote>{t("section4SourceNote", { model: data.model ?? "haiku", n: data.total })}</SourceNote>
      </div>
    </div>
  );
}
