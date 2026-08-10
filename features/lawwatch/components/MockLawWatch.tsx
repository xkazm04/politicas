"use client";

/*
 * FALLBACK plocha /zakony — původní mock, jasně označený jako UKÁZKA (graf
 * nedostupný). Vytažen z LawWatchPage.tsx do vlastního modulu 2026-08-10 a
 * načítán přes `next/dynamic`: `lib/civic/data.ts` (LAW_CHANGES, BILLS, MPS,
 * ROLL_CALLS, BILL_STAGES) se importoval na úrovni modulu, takže 27 kB
 * ukázkových dat leželo v parse cestě každého návštěvníka reálné plochy, kde se
 * nevykreslí ani jedno. BEZ `ssr: false` — fallback se dál renderuje na serveru
 * (vzor features/money/FollowTheMoneyPage.tsx a features/dashboard/DashboardPage.tsx).
 *
 * POCTIVOST: žetony poslanců ukázky nejsou odkazy. `lib/civic/data.ts` nese slugy
 * („novakova-p"), zatímco /poslanec/[id] klíčuje mandátním číslem — každý takový
 * odkaz končil 404 a přitom vypadal jako adresa reálného spisu. Odmítnutí podle
 * TVARU id je totéž pravidlo, jaké drží features/dashboard/entityLinks.ts.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BILL_STAGES, BILLS, LAW_CHANGES, MPS, ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";

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

export default function MockLawWatch() {
  const t = useTranslations("lawwatch");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState(LAW_CHANGES[0].id);
  const change = LAW_CHANGES.find((c) => c.id === selectedId) ?? LAW_CHANGES[0];
  const rc = ROLL_CALLS.find((r) => r.id === change.rollCallId)!;

  return (
    <>
      <div className="mt-2 border-2 border-dashed border-ochre bg-ochre/5 px-4 py-3">
        <SourceNote tone="steel" className="!text-ochre">
          {t("mockNotice")}
        </SourceNote>
      </div>

      {/* ── 01 Změny paragrafů ────────────────────────────── */}
      <section id="tisky" className="mt-8">
        <SectionHeading
          index={1}
          title={t("section1Title")}
          aside={<SourceNote>{t("section1Aside")}</SourceNote>}
        />
        <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
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
              {/* Žetony poslanců ukázky NEJSOU odkazy. `lib/civic/data.ts` nese slugy
                  („novakova-p"), zatímco /poslanec/[id] klíčuje mandátním číslem, takže
                  každý takový odkaz končil 404 — a přesto vypadal jako adresa reálného
                  spisu. Odmítnutí podle TVARU id je stejné pravidlo, jaké drží
                  features/dashboard/entityLinks.ts pro uzly vzorku: ukázkové id nesmí
                  razit reálně vypadající adresu. Věta pod žetony to říká nahlas. */}
              <div className="mt-3 flex flex-wrap gap-2">
                {MPS.map((m) => {
                  const vote = rc.perMP[m.id];
                  return (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-2 border-2 border-hairline px-3 py-1.5"
                    >
                      <span className="text-sm font-bold">{m.name.split(" ").at(-1)}</span>
                      <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${VOTE_TEXT[vote]}`}>
                        {tcom(`voteChoice.${VOTE_KEY[vote]}`)}
                      </span>
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] italic leading-relaxed text-steel">{t("mockNoProfileLink")}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 02 Legislativní potrubí ───────────────────────── */}
      <section id="zakony" className="mt-14 border-t-4 border-ink pt-10 pb-20">
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
    </>
  );
}
