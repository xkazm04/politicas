"use client";

/*
 * LawWatch — monitor legislativy (/zakony, roadmapa Fáze 3).
 * REÁLNÁ data z grafu Case ③: sněmovní tisky → zákony, které novelizují
 * (hrana `amends`), předkladatelé (proklik na profil poslance), příznak
 * možného střetu zájmů z peněžních vazeb předkladatele (Case ①), formální
 * přikázání výborům (hrana `assigned_to`, F15: garanční / další, stav, datum) a
 * — u tisků, které jej nesou — gatovaný forenzní posudek (návrh k revizi, ne
 * publikovaný verdikt) a — u zákonů, kde jsme jej reálně dopočítali z e-Sbírky
 * (SPARQL point-query, ne smyšlená data) — skutečný §-diff mezi dvěma platnými
 * zněními. Když graf není dostupný, spadne stránka na jasně označený ukázkový mock.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { BILL_STAGES, BILLS, LAW_CHANGES, MPS, ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import type { BillOrigin, LawData } from "./getLawData";
import { ORIGIN_CZ } from "./lawwatchLabels";
import BillBrowser from "./components/BillBrowser";

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

export default function LawWatchPage({ lawData }: { lawData: LawData | null }) {
  const t = useTranslations("lawwatch");

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ lawwatch</span>
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
            {lawData
              ? "Které sněmovní tisky mění které zákony — u každého tisku jedna věta „co to mění“ odvozená z jeho vlastního textu, dále spojnice návrh → novelizovaný zákon, předkladatelé, jejich peněžní vazby a forenzní posudek tam, kde existuje. Data z psp.cz, ne z modelu."
              : t("intro")}
          </p>
        </div>

        {lawData ? <RealLawWatch data={lawData} /> : <MockLawWatch />}
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * REÁLNÁ data — bill → law spine
 * ════════════════════════════════════════════════════════════════════════ */

function RealLawWatch({ data }: { data: LawData }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();

  const originOrder: BillOrigin[] = ["government", "mp_group", "mp", "senate", "other"];

  return (
    <>
      {/* Statistický pás */}
      <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
        {[
          { v: f.int(data.totalBills), l: "sněmovních tisků" },
          { v: f.int(data.totalLaws), l: "novelizovaných zákonů" },
          { v: f.int(data.totalAmends), l: "vazeb tisk → zákon" },
          { v: f.int(data.flaggedCount), l: "tisků s možným střetem" },
        ].map((s) => (
          <div key={s.l} className="bg-paper px-4 py-4">
            <div className="text-3xl font-black tabular-nums">{s.v}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <SourceNote>
          psp.cz tisky · průchod grafu {data.pass ?? "?"} · vazby tisk → zákon a přikázání výborům · {f.int(data.committeeRoutedBills)} tisků přikázáno výborům
        </SourceNote>
        <span className="flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wider text-steel">
          {originOrder
            .filter((o) => data.originCounts[o])
            .map((o) => (
              <span key={o}>
                {ORIGIN_CZ[o]} <span className="font-bold text-ink">{f.int(data.originCounts[o] ?? 0)}</span>
              </span>
            ))}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-signal bg-signal/5 px-4 py-3">
        <p className="text-[13px] leading-snug">
          <span className="font-black uppercase tracking-wide text-signal">Kolize tisků</span> — souběžně
          projednávané tisky, které novelizují stejný § téhož zákona neslučitelným nebo na pořadí citlivým
          způsobem. Vychází ze čtyř dávek ručního porovnání textů obou tisků.
        </p>
        <Link
          href="/zakony/kolize"
          className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-signal transition-colors hover:text-cobalt"
        >
          otevřít kolize <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── 01 Bill browser: filtr + hledání + detailní dosje na /zakony/[cislo] ── */}
      <section id="tisky" className="mt-12 pb-4">
        <SectionHeading
          index={1}
          title={t("realSection1Title")}
          aside={
            <SourceNote>
              {f.int(data.totalBills)} tisků · {f.int(data.summaryCount)} se shrnutím · {f.int(data.totalAmends)}{" "}
              novelizačních vazeb · psp.cz
            </SourceNote>
          }
        />
        <div className="mt-8">
          <BillBrowser data={data} />
        </div>
      </section>

      {/* ── 02 Nejčastěji novelizované zákony ─────────────── */}
      <section id="zakony" className="mt-14 border-t-4 border-ink pt-10 pb-20">
        <SectionHeading
          index={2}
          title={t("realSection2Title")}
          aside={<SourceNote>psp.cz tisky · počet tisků na zákon</SourceNote>}
        />
        <div className="mt-8 border-t-2 border-ink">
          {data.topLaws.slice(0, 20).map((l) => (
            <div
              key={l.urn}
              className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                {l.title && <span className="mt-0.5 block text-[15px] font-bold leading-snug">{l.title}</span>}
              </span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-2xl font-black tabular-nums">{f.int(l.billCount)}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {l.billCount === 1 ? "tisk" : l.billCount < 5 ? "tisky" : "tisků"}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
          Vazba tisk → zákon je vyčtena z názvu tisku (citace „č. N/RRRR Sb.“), jediného strukturovaného
          odkazu, který psp.cz o novelizovaném zákoně nese. Formální přikázání výborům (garanční / další, stav
          a datum) se vykresluje z reálných dat psp.cz. Úplné znění paragrafů drží e-Sbírka
          zvlášť — {data.paragraphDiffCount > 0 ? (
            <>u {f.int(data.paragraphDiffCount)} {data.paragraphDiffCount === 1 ? "tisku" : "tisků"} u nejčastěji novelizovaného zákona nese skutečný §-diff mezi dvěma platnými zněními, dopočítaný přímo z veřejného SPARQL rozhraní e-Sbírky (žádný hromadný výpis, žádná smyšlená data); u ostatních tisků se diff zatím nevykresluje.</>
          ) : (
            <>diff „před/po“ na úrovni § se zatím nevykresluje — Politicas nezobrazuje smyšlená data.</>
          )}
        </p>
        {data.censusBillCount > 0 && (
          <p className="mt-3 max-w-3xl border-l-4 border-ochre bg-ochre/5 p-4 text-sm leading-relaxed">
            <span className="font-black uppercase tracking-wide text-ochre">Poctivost čísel: </span>
            vazba tisk → zákon výše je z citace v NÁZVU tisku — pro velké novely a doprovodné zákony to
            systematicky podhodnocuje, kolik zákonů tisk skutečně mění. Nezávislý census plného textu (průchod grafu 20)
            na {f.int(data.censusBillCount)} tiscích doplnil dohromady{" "}
            <span className="font-black">{f.int(data.censusUndercountTotal)}</span> dalších novelizovaných
            zákonů, které vazba z názvu minula. Vlastní census má každý tisk ve svém detailu, pokud pro něj existuje.
          </p>
        )}
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * FALLBACK — původní mock, jasně označený jako ukázka (graf nedostupný)
 * ════════════════════════════════════════════════════════════════════════ */

function MockLawWatch() {
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
          graf nedostupný — níže ukázková data (mock), ne živý zdroj
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
