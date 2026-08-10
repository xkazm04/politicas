"use client";

/**
 * Témata hlasování — the first surface driven by REAL store data: the Silver-layer
 * `vote_tag` dataset (haiku sem_classify, benchmarked in docs/hybrid-benchmark-plan.md)
 * joined to real PSP10 roll calls. Theme chips filter the vote list. Every count
 * cites how the tag was made (model), per the brand rule.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import { themeLabelKey } from "../themeLabels";
import { votePspUrl } from "../record/anchor";
import type { VoteThemeData } from "../themeTypes";
import SourceNote from "@/features/shared/components/SourceNote";

const KNOWN_RESULT = new Set(["accepted", "rejected"]);

/** Kolik hlasování se ve vybraném řezu vypíše. Prezentační strop — do 2026-08-10
 *  řezal seznam beze slova, teď ho stránka jmenuje i s počtem, který mu podléhá. */
const LIST_CAP = 80;

export default function VoteThemeFilter({ data }: { data: VoteThemeData }) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  const [selected, setSelected] = useState<string | null>(null);

  const themeName = (slug: string): string => {
    const key = themeLabelKey(slug);
    return key ? t(key) : slug;
  };

  const shown = selected ? data.votes.filter((v) => v.theme === selected) : data.votes;
  const listed = shown.slice(0, LIST_CAP);

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
          {t("themeAll")} · {f.int(data.total)}
        </button>
        {data.themes.map((th) => (
          <button
            key={th.slug}
            type="button"
            onClick={() => setSelected((s) => (s === th.slug ? null : th.slug))}
            className={chip(selected === th.slug)}
            aria-pressed={selected === th.slug}
          >
            {themeName(th.slug)} · {f.int(th.count)}
          </button>
        ))}
      </div>

      {/* ── Hlasování ve vybraném tématu ────────────────────── */}
      <div className="mt-6 border-t-2 border-ink">
        {listed.map((v) => (
          <div key={v.votePspId} className="border-b border-hairline py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-steel">
                {v.votedOn ? f.date(v.votedOn) : "—"} · {themeName(v.theme)}
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
            {/* Řádek byl slepá ulička: téma, název, výsledek — a žádná cesta k
                záznamu, ze kterého to všechno je. Adresa hlasování na psp.cz je
                z jeho id (record/anchor.ts), takže nic dalšího číst netřeba. */}
            <a
              href={votePspUrl(v.votePspId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("themeVoteLinkAria", { title: v.title })}
              className="mt-1 inline-block font-mono text-[11px] uppercase tracking-wider text-steel-aa underline-offset-2 hover:text-ink hover:underline"
            >
              {t("themeVoteLink")} ↗
            </a>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <SourceNote>{t("themeListCount", { shown: f.int(listed.length), matched: f.int(shown.length), cap: f.int(LIST_CAP) })}</SourceNote>
      </div>
      <div className="mt-1">
        <SourceNote>{t("section4SourceNote", { model: data.model ?? "haiku", n: data.total })}</SourceNote>
      </div>
    </div>
  );
}
