"use client";

/*
 * LawWatch — hlídač paragrafů (/zakony, roadmapa Fáze 3).
 * Uzavírá smyčku hlasování → dopad: vlevo změny paragrafů, vpravo diff
 * před/po s proklikem na jmenovité hlasování, které změnu odhlasovalo,
 * a hlasy sledovaného vzorku. Pod tím legislativní potrubí — kde který
 * tisk právě je. „Váš poslanec hlasoval pro novelu, která změnila §."
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { BILL_STAGES, BILLS, LAW_CHANGES, MPS, ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const VOTE_TEXT: Record<string, string> = {
  pro: "text-cobalt",
  proti: "text-signal",
  "zdržel se": "text-ochre",
  omluven: "text-steel",
};

/** Syrový český klíč hlasu → klíč v common.voteChoice. */
const VOTE_KEY: Record<string, string> = {
  pro: "for",
  proti: "against",
  "zdržel se": "abstained",
  omluven: "excused",
};

export default function LawWatchPage() {
  const t = useTranslations("lawwatch");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState(LAW_CHANGES[0].id);
  const change = LAW_CHANGES.find((c) => c.id === selectedId) ?? LAW_CHANGES[0];
  const rc = ROLL_CALLS.find((r) => r.id === change.rollCallId)!;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" className="fill-signal" />
                <circle cx="16" cy="16" r="9" className="fill-paper" />
                <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
              </svg>
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ lawwatch</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("eyebrow")}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {t("intro")}
          </p>
        </div>

        {/* ── 01 Změny paragrafů ────────────────────────────── */}
        <section>
          <SectionHeading
            index={1}
            title={t("section1Title")}
            aside={<SourceNote>{t("section1Aside")}</SourceNote>}
          />
          <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
            {/* výběr změny */}
            <div className="min-w-0 border-t-2 border-ink">
              {LAW_CHANGES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full border-b border-hairline py-4 pr-2 text-left transition-colors hover:bg-paper-strong ${
                    c.id === selectedId ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-0"
                  }`}
                  aria-pressed={c.id === selectedId}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                      {tc(`lawChanges.${c.id}.paragraph`)}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t("effectiveFrom", { date: f.date(c.effectiveFrom) })}
                    </span>
                  </span>
                  <span className="mt-1 block text-[15px] font-bold leading-snug">
                    {tc(`lawChanges.${c.id}.law`)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                    {tc(`lawChanges.${c.id}.lawRef`)}
                  </span>
                  <span className="mt-1.5 block text-sm leading-snug text-steel">
                    {tc(`lawChanges.${c.id}.summary`)}
                  </span>
                </button>
              ))}
              <div className="mt-3">
                <SourceNote>{t("sampleNote")}</SourceNote>
              </div>
            </div>

            {/* diff */}
            <motion.div
              key={change.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="min-w-0 lg:sticky lg:top-8 lg:self-start"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
                <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
                  {tc(`lawChanges.${change.id}.law`)}{" "}
                  <span className="text-signal">{tc(`lawChanges.${change.id}.paragraph`)}</span>
                </h3>
              </div>

              <div className="mt-6 space-y-4">
                <div className="border-l-4 border-hairline bg-paper-strong p-4">
                  <SourceNote className="!text-[10px]">{t("beforeLabel")}</SourceNote>
                  <p className="mt-2 text-[15px] leading-relaxed text-steel">
                    {tc(`lawChanges.${change.id}.before`)}
                  </p>
                </div>
                <div className="border-l-4 border-signal p-4">
                  <SourceNote tone="signal" className="!text-[10px]">
                    {t("afterLabel", { date: f.date(change.effectiveFrom) })}
                  </SourceNote>
                  <p className="mt-2 text-[15px] font-medium leading-relaxed">
                    {tc(`lawChanges.${change.id}.after`)}
                  </p>
                </div>
              </div>

              {/* propojení na hlasování */}
              <div className="mt-8 border-t-2 border-ink pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <SourceNote>{t("passedBy", { tisk: tc(`rollCalls.${rc.id}.tisk`) })}</SourceNote>
                  <Link
                    href="/hlasovani"
                    className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                  >
                    {t("openInChamber")}
                  </Link>
                </div>
                <p className="mt-2 text-[15px] font-bold leading-snug">
                  {tc(`rollCalls.${rc.id}.title`)}
                  <span
                    className={`ml-3 font-mono text-xs font-black uppercase tracking-wider ${
                      rc.result === "přijato" ? "text-cobalt" : "text-signal"
                    }`}
                  >
                    {tcom(`voteResult.${rc.result === "přijato" ? "accepted" : "rejected"}`)} · {f.int(rc.pro)}:{f.int(rc.proti)}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MPS.map((m) => {
                    const vote = rc.perMP[m.id];
                    return (
                      <Link
                        key={m.id}
                        href={`/poslanec/${m.id}`}
                        className="group inline-flex items-center gap-2 border-2 border-hairline px-3 py-1.5 transition-colors hover:border-ink hover:bg-paper-strong"
                      >
                        <span className="text-sm font-bold">{m.name.split(" ").at(-1)}</span>
                        <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${VOTE_TEXT[vote]}`}>
                          {tcom(`voteChoice.${VOTE_KEY[vote]}`)}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── 02 Legislativní potrubí ───────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={2}
            title={t("section2Title")}
            aside={<SourceNote>{t("section2Aside")}</SourceNote>}
          />
          <div className="mt-8 border-t-2 border-ink">
            {BILLS.map((b, bi) => {
              const rcOfBill = b.rollCallId ? ROLL_CALLS.find((r) => r.id === b.rollCallId) : undefined;
              const rejected = rcOfBill?.result === "zamítnuto";
              return (
                <div
                  key={b.tisk}
                  className="grid grid-cols-[1.2fr_1fr] items-center gap-6 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong max-lg:grid-cols-1"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-snug">{tc(`bills.${bi}.title`)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
                      {tc(`bills.${bi}.tisk`)}
                      {rejected && (
                        <span className="font-black text-signal">
                          {t("rejectedAtStage", { stage: tc("billStages.3") })}
                        </span>
                      )}
                      {rcOfBill && !rejected && (
                        <Link href="/hlasovani" className="font-bold text-cobalt transition-colors hover:text-signal">
                          {t("voteLink", { pro: f.int(rcOfBill.pro), proti: f.int(rcOfBill.proti) })}
                        </Link>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {BILL_STAGES.map((stage, i) => {
                      const reached = i <= b.stage;
                      const current = i === b.stage;
                      return (
                        <span key={stage} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          <span
                            className={`h-3 w-3 rounded-full border-2 ${
                              current && rejected
                                ? "border-signal bg-signal"
                                : reached
                                  ? current
                                    ? "border-ink bg-signal"
                                    : "border-ink bg-ink"
                                  : "border-hairline bg-paper"
                            }`}
                            title={tc(`billStages.${i}`)}
                          />
                          <span
                            className={`w-full truncate text-center font-mono text-[9px] uppercase tracking-wide ${
                              current ? "font-bold text-ink" : "text-steel"
                            } max-sm:hidden`}
                          >
                            {tc(`billStages.${i}`)}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            {t("pipelineFootnote")}
          </p>
        </section>
      </div>
    </main>
  );
}
