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
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { BILL_STAGES, BILLS, LAW_CHANGES, MPS, ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { BillOrigin, LawBillView, LawData } from "./getLawData";

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

/** Původ tisku (bill.props.origin) → český štítek. */
const ORIGIN_CZ: Record<BillOrigin, string> = {
  government: "vládní návrh",
  mp: "poslanecký návrh",
  mp_group: "skupina poslanců",
  senate: "senátní návrh",
  other: "jiný návrh",
};

const SEVERITY_CZ: Record<string, string> = {
  low: "nízká",
  medium: "střední",
  high: "vysoká",
};

/** assigned_to.props.role → český štítek (F15 formální přikázání výborům). */
const ROLE_CZ: Record<string, string> = {
  garancni: "garanční výbor",
  dalsi: "další výbor",
};

/** assigned_to.props.status → český štítek (nejsilnější dosažený stav přikázání). */
const STATUS_CZ: Record<string, string> = {
  prikazano: "přikázáno",
  navrzeno: "navrženo",
  iniciativne: "projednáno iniciativně",
};

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
const pspBillUrl = (cislo: number | null) =>
  cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null;

/** Kompaktní CZK: 5 397 460 397 → „5,4 mld. Kč". */
function czkCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} mld. Kč`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} mil. Kč`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} tis. Kč`;
  return `${n} Kč`;
}

export default function LawWatchPage({ lawData }: { lawData: LawData | null }) {
  const t = useTranslations("lawwatch");

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
            {lawData
              ? "Které sněmovní tisky mění které zákony — spojnice návrh → novelizovaný zákon přímo z grafu, s předkladateli, jejich peněžními vazbami a forenzním posudkem tam, kde existuje. Data z psp.cz, ne z modelu."
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
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const [selectedTisk, setSelectedTisk] = useState(data.bills[0]?.tiskId ?? 0);
  const bill = data.bills.find((b) => b.tiskId === selectedTisk) ?? data.bills[0];

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
          psp.cz tisky · graf pass {data.pass ?? "?"} · hrany amends + assigned_to · {f.int(data.committeeRoutedBills)} tisků přikázáno výborům
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

      {/* ── 01 Které tisky mění které zákony ──────────────── */}
      <section className="mt-12">
        <SectionHeading
          index={1}
          title="Tisky → zákony"
          aside={<SourceNote>{data.totalBills} tisků · {data.totalAmends} novelizačních vazeb · psp.cz</SourceNote>}
        />
        <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
          {/* výběr tisku */}
          <div className="min-w-0 border-t-2 border-ink">
            {data.bills.slice(0, 40).map((b) => {
              const selected = b.tiskId === bill?.tiskId;
              return (
                <button
                  key={b.tiskId}
                  type="button"
                  onClick={() => setSelectedTisk(b.tiskId)}
                  className={`block w-full border-b border-hairline py-4 pr-2 text-left transition-colors hover:bg-paper-strong ${
                    selected ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-0"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                      {b.cislo != null ? `sn. tisk ${b.cislo}` : `tisk ${b.tiskId}`}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
                      {b.paragraphDiffs.length > 0 && <span className="font-black text-ochre">§-diff</span>}
                      {b.forensic && <span className="font-black text-cobalt">posudek</span>}
                      {b.flaggedConflict && <span className="font-black text-signal">možný střet</span>}
                      <span>{b.amendedLaws.length}× zákon</span>
                    </span>
                  </span>
                  <span className="mt-1 block text-[15px] font-bold leading-snug line-clamp-2">{b.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                    {ORIGIN_CZ[b.origin]}
                  </span>
                </button>
              );
            })}
            <div className="mt-3">
              <SourceNote>zobrazeno {Math.min(40, data.bills.length)} z {data.totalBills} tisků · řazeno: posudek → střet → počet zákonů</SourceNote>
            </div>
          </div>

          {/* detail tisku */}
          {bill && (
            <motion.div
              key={bill.tiskId}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="min-w-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
                <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
                  {bill.cislo != null ? "Sn. tisk " : "Tisk "}
                  <span className="text-signal">{bill.cislo ?? bill.tiskId}</span>
                </h3>
                {pspBillUrl(bill.cislo) && (
                  <a
                    href={pspBillUrl(bill.cislo)!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                  >
                    historie na psp.cz <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <p className="mt-4 text-[15px] font-bold leading-snug">{bill.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
                <span className="border border-hairline px-2 py-0.5">{ORIGIN_CZ[bill.origin]}</span>
                {bill.submitter && <span>{bill.submitter}</span>}
              </div>

              {/* novelizované zákony */}
              <div className="mt-6">
                <SourceNote>novelizuje — {bill.amendedLaws.length} {bill.amendedLaws.length === 1 ? "zákon" : "zákonů"}</SourceNote>
                {bill.amendedLaws.length > 0 ? (
                  <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
                    {bill.amendedLaws.map((l) => (
                      <li key={l.urn} className="py-2.5">
                        <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                        {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm italic leading-relaxed text-steel">
                    Graf u tohoto tisku nenašel v názvu citaci konkrétního zákona (č. N/RRRR Sb.).
                  </p>
                )}
              </div>

              {/* formální přikázání výborům (F15) */}
              {bill.committees.length > 0 && (
                <div className="mt-6 border-t-2 border-ink pt-4">
                  <SourceNote>projednávají výbory — psp.cz hist_vybory ⋈ hist (F15)</SourceNote>
                  <ul className="mt-3 space-y-2">
                    {bill.committees.map((c) => (
                      <li
                        key={c.organUrn}
                        className={`flex flex-wrap items-baseline justify-between gap-2 border-l-4 px-3 py-2 ${
                          c.role === "garancni" ? "border-cobalt bg-cobalt/5" : "border-hairline"
                        }`}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="text-[15px] font-bold">{c.organLabel}</span>
                          <span
                            className={`font-mono text-[10px] font-black uppercase tracking-wider ${
                              c.role === "garancni" ? "text-cobalt" : "text-steel"
                            }`}
                          >
                            {ROLE_CZ[c.role] ?? c.role}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                          {STATUS_CZ[c.status] ?? c.status}
                          {c.assignedOn && <> · {c.assignedOn}</>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* předkladatelé */}
              {bill.sponsors.length > 0 && (
                <div className="mt-6 border-t-2 border-ink pt-4">
                  <SourceNote>předkladatelé — psp.cz predkladatel</SourceNote>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bill.sponsors.slice(0, 12).map((s) => (
                      <Link
                        key={s.pspId}
                        href={`/poslanec/${s.pspId}`}
                        className="group inline-flex items-center gap-2 border-2 border-hairline px-3 py-1.5 transition-colors hover:border-ink hover:bg-paper-strong"
                      >
                        <span className="text-sm font-bold">{s.name}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* příznak střetu (Case ①) */}
              {bill.flaggedConflict && (
                <div className="mt-6 border-l-4 border-signal bg-paper-strong p-4">
                  <SourceNote tone="signal" className="!text-[10px]">
                    možný střet zájmů · odvozeno z peněžních vazeb předkladatele (Case ①)
                  </SourceNote>
                  <p className="mt-2 text-[15px] font-medium leading-relaxed">
                    Předkladatel má vazby na {f.int(bill.sponsorMoneyCompanies)}{" "}
                    {bill.sponsorMoneyCompanies === 1 ? "firmu" : "firem"} s celkovým tokem veřejných zakázek{" "}
                    <span className="font-black">{czkCompact(bill.sponsorContractCzk)}</span>. Signál k prověření, ne prokázaný střet.
                  </p>
                </div>
              )}

              {/* reálný §-diff (e-Sbírka) */}
              {bill.paragraphDiffs.length > 0 && <ParagraphDiffBlock diffs={bill.paragraphDiffs} />}

              {/* gatovaný forenzní posudek */}
              {bill.forensic && <ForensicBlock forensic={bill.forensic} />}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── 02 Nejčastěji novelizované zákony ─────────────── */}
      <section className="mt-14 border-t-4 border-ink pt-10 pb-20">
        <SectionHeading
          index={2}
          title="Nejnovelizovanější zákony"
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
          a datum) se vykresluje z reálných dat psp.cz (hist_vybory). Úplné znění paragrafů drží e-Sbírka
          zvlášť — {data.paragraphDiffCount > 0 ? (
            <>u {f.int(data.paragraphDiffCount)} tisku{data.paragraphDiffCount === 1 ? "" : "ů"} u nejčastěji novelizovaného zákona nese skutečný §-diff mezi dvěma platnými zněními, dopočítaný přímo z veřejného SPARQL rozhraní e-Sbírky (žádný hromadný výpis, žádná smyšlená data); u ostatních tisků se diff zatím nevykresluje.</>
          ) : (
            <>diff „před/po“ na úrovni § se zatím nevykresluje — Politicas nezobrazuje smyšlená data.</>
          )}
        </p>
      </section>
    </>
  );
}

/** Gatovaný forenzní posudek — vždy jako ODVOZENÝ návrh k revizi, ne jako fakt. */
function ForensicBlock({ forensic }: { forensic: NonNullable<LawBillView["forensic"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 border-2 border-cobalt">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-cobalt bg-cobalt/5 px-4 py-3">
        <SourceNote tone="steel" className="!text-cobalt">
          forenzní posudek · odvozeno (gate „law-verdict“) · {forensic.reviewState}
        </SourceNote>
        <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
          závažnost <span className="font-black text-ink">{SEVERITY_CZ[forensic.severity] ?? forensic.severity}</span>
          {forensic.confidence != null && <> · jistota {forensic.confidence}/5</>}
        </span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div>
          <SourceNote className="!text-[10px]">deklarovaný důvod (důvodová zpráva)</SourceNote>
          <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.statedReasoning}</p>
        </div>
        {forensic.conflictAssessment && (
          <div>
            <SourceNote className="!text-[10px]">posouzení střetu</SourceNote>
            <p className="mt-1.5 text-sm leading-relaxed">{forensic.conflictAssessment}</p>
          </div>
        )}

        {open && (
          <>
            {forensic.researchedContext && (
              <div>
                <SourceNote className="!text-[10px]">nezávislý kontext (rešerše)</SourceNote>
                <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.researchedContext}</p>
              </div>
            )}
            {forensic.unstatedEffects.length > 0 && (
              <div>
                <SourceNote className="!text-[10px]">nedeklarované dopady · každý s citací</SourceNote>
                <ul className="mt-2 space-y-3">
                  {forensic.unstatedEffects.map((u, i) => (
                    <li key={i} className="border-l-4 border-signal pl-3">
                      <p className="text-sm font-medium leading-snug">{u.effect}</p>
                      <p className="mt-1 text-[13px] leading-snug text-steel">
                        <span className="font-bold uppercase tracking-wide">komu prospívá:</span> {u.whoBenefits}
                      </p>
                      {/^https?:\/\//.test(u.evidence) && (
                        <a href={u.evidence} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-cobalt hover:text-signal">
                          zdroj <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {forensic.citations.length > 0 && (
              <div>
                <SourceNote className="!text-[10px]">citace ({forensic.citations.length})</SourceNote>
                <ul className="mt-2 space-y-1.5">
                  {forensic.citations.map((c, i) => (
                    <li key={i} className="text-[13px] leading-snug text-steel">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-signal">[{c.kind}]</span>{" "}
                      {c.claim}{" "}
                      {/^https?:\/\//.test(c.source) ? (
                        <a href={c.source} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">↗</a>
                      ) : (
                        <span className="font-mono text-[11px] text-steel">({c.source})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {open ? "méně —" : "rešerše, nedeklarované dopady a citace +"}
        </button>
        <p className="border-t border-hairline pt-3 text-[13px] italic leading-relaxed text-steel">
          Odvozený nález gatovaný proti fabrikaci (každá citovaná č. N/RRRR Sb. musí být reálný zákon).
          Uložen jako <span className="font-bold not-italic">pending_review</span> — podnět pro člověka, ne publikovaný verdikt.
        </p>
      </div>
    </div>
  );
}

const DIFF_OP_CZ: Record<string, string> = { modified: "změněno", added: "přidáno", removed: "zrušeno" };

/** Reálný §-diff mezi dvěma PLATNÝMI zněními zákona z e-Sbírky (SPARQL point-query — žádný
 * hromadný výpis, žádná syntetizovaná data). Text před/po je doslovný `text-fragmentu`
 * z e-Sbírky (jen bez HTML značek), nikdy dopočítaný. */
function ParagraphDiffBlock({ diffs }: { diffs: LawBillView["paragraphDiffs"] }) {
  const f = useFormat();
  return (
    <div className="mt-8 border-2 border-ochre">
      {diffs.map((d, di) => (
        <div key={`${d.law}-${d.parScope}-${di}`} className={di > 0 ? "border-t-2 border-ochre" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ochre bg-ochre/5 px-4 py-3">
            <SourceNote tone="steel" className="!text-ochre">
              reálný §-diff · č. {d.law} Sb. · e-Sbírka (SPARQL, ne hromadný výpis)
            </SourceNote>
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {f.date(d.from.date)} → {f.date(d.to.date)}
            </span>
          </div>
          <ul className="space-y-4 px-4 py-4">
            {d.hunks.map((h, hi) => (
              <li key={hi} className="border-l-4 border-hairline pl-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                  {h.fragment} <span className="text-steel">— {DIFF_OP_CZ[h.op] ?? h.op}</span>
                </span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {h.before && (
                    <div className="border-l-4 border-hairline bg-paper-strong p-3">
                      <SourceNote className="!text-[10px]">{f.date(d.from.date)}</SourceNote>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-steel">{h.before}</p>
                    </div>
                  )}
                  {h.after && (
                    <div className="border-l-4 border-signal p-3">
                      <SourceNote tone="signal" className="!text-[10px]">{f.date(d.to.date)}</SourceNote>
                      <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{h.after}</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-hairline px-4 py-3 text-[13px] italic leading-relaxed text-steel">
            Doslovný text obou znění z e-Sbírky (
            <a href={d.from.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
              {d.from.date}
            </a>
            {" → "}
            <a href={d.to.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
              {d.to.date}
            </a>
            ), nikdy dopočítaný. Zdroj: {d.source}.
          </p>
        </div>
      ))}
    </div>
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
      <section className="mt-8">
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
    </>
  );
}
