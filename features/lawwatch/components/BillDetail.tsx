"use client";

/*
 * Full per-bill dossier body — the /zakony/[cislo] detail (moved out of the old
 * single-page LawWatchPage inline detail pane so each bill is independently
 * linkable/shareable). Renders: origin/submitter, what it changes (title-derived
 * `amends` edges — HONESTLY distinguished from the fuller pass-20 census list
 * where one exists, per the undercount finding C6/C8), formal committee routing
 * (F15), sponsors with money-flag context (Case ①, sector-adjacency honesty —
 * P32: a flag is a signal, not a proven conflict), the real e-Sbírka §-diff where
 * it exists, and the gated forensic verdict block (always rendered as
 * derived/pending_review, never as a fact).
 */

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LawBillView } from "../getLawData";
import {
  COMMITTEE_ROLE_KEYS,
  COMMITTEE_STATUS_KEYS,
  SEVERITY_KEYS,
  DIFF_OP_KEYS,
  CITATION_KIND_KEYS,
  SPONSOR_ROLE_KEYS,
  RAPPORTEUR_SCOPE_KEYS,
  SECTOR_KEYS,
  pspBillUrl,
  citationRef,
} from "../lawwatchLabels";
import { statuteSlug } from "../statuteRef";
import { FORENSIC_CONFIDENCE_SCALE, forensicConfidenceClaim } from "../lawClaims";
import { useFormat } from "@/lib/i18n/useFormat";
import { formatByKind } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import CitableNumber from "@/lib/claims/CitableNumber";
import SourceNote from "@/features/shared/components/SourceNote";
import { GATE_UNGATED_KEY } from "@/features/overeni/gateVocabulary";

export default function BillDetail({ bill }: { bill: LawBillView }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();

  // Census cross-check (pass 20, 53 bills): the fuller body-derived amends list vs the
  // title-only `amends` edges. Only rendered when this bill actually carries a census
  // record — the other 88 bills only ever had the title-derived list, and that's not a
  // gap worth flagging per-bill (it's the systemic C8 finding, footnoted on /zakony §2).
  const hasCensus = bill.amendedLawsFull.length > 0;
  const recordedRefs = new Set(bill.amendedLaws.map((l) => l.ref));
  const missedRefs = hasCensus ? bill.amendedLawsFull.filter((r) => !recordedRefs.has(r)) : [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
        <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
          {bill.cislo != null ? t("detail.printHeading") : t("detail.printHeadingInternal")}{" "}
          <span className="text-signal">{bill.cislo ?? bill.tiskId}</span>
        </h3>
        {pspBillUrl(bill.cislo) && (
          <a
            href={pspBillUrl(bill.cislo)!}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {t("detail.pspHistory")} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* „CO TO MĚNÍ" — jedna čitelná věta dřív než cokoli jiného. Odvozeno deterministicky
          z textu tisku (nadpisy ČÁSTí / návětí / zrušovací klauzule), nikdy vymyšleno. */}
      <div className="mt-5 border-l-4 border-signal bg-paper-strong px-4 py-3">
        <SourceNote tone="signal" className="!text-[11px]">
          {t("detail.whatItChanges")}
        </SourceNote>
        {bill.summary ? (
          <>
            <p className="mt-1.5 text-lg font-bold leading-snug">{bill.summary}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("detail.derivedFromText")}{bill.summarySource ? ` · ${bill.summarySource}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[15px] italic leading-relaxed text-steel">
            {t("detail.noSummaryHonest")}
          </p>
        )}
      </div>

      <p className="mt-4 text-[15px] font-bold leading-snug">{bill.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
        <span className="border border-hairline px-2 py-0.5">{t(`origin.${bill.origin}`)}</span>
        {bill.submitter && <span>{bill.submitter}</span>}
      </div>

      {/* osud tisku — stav projednávání dle psp.cz, vyhlášení ve Sbírce, když k němu došlo */}
      {(bill.stav || bill.fateSb) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {bill.fateSb ? (
            <span className="border-l-4 border-signal bg-paper-strong px-3 py-1.5 text-sm font-bold">
              {t.rich("detail.promulgated", {
                sb: bill.fateSb,
                ref: (chunks) => <span className="text-signal">{chunks}</span>,
              })}
              {bill.fatePublishedOn && (
                <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-wider text-steel">
                  {f.date(bill.fatePublishedOn)}
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("detail.statePrefix")} <span className="font-black text-ink">{bill.stav}</span>
            </span>
          )}
          <SourceNote className="!text-[10px]">{t("detail.stateSource")}</SourceNote>
        </div>
      )}

      {/* novelizované zákony — title-derived edges */}
      <div className="mt-6">
        <SourceNote>
          {t("detail.amendsHeading", {
            count: bill.amendedLaws.length,
            countFmt: f.int(bill.amendedLaws.length),
          })}
        </SourceNote>
        {bill.amendedLaws.length > 0 ? (
          <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
            {bill.amendedLaws.map((l) => {
              const slug = statuteSlug(l.ref);
              return (
                <li key={l.urn} className="py-2.5">
                  {slug ? (
                    <Link href={`/zakony/predpis/${slug}`} className="group block">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-signal transition-colors group-hover:text-cobalt">
                        č. {l.ref} Sb.
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
                    </Link>
                  ) : (
                    <>
                      <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                      {l.title && <span className="mt-0.5 block text-sm leading-snug text-steel">{l.title}</span>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm italic leading-relaxed text-steel">
            {t("detail.amendsNone")}
          </p>
        )}
      </div>

      {/* census honesty note — the fuller body-derived list, where it exists */}
      {hasCensus && (
        <div className="mt-4 border-l-4 border-ochre bg-ochre/5 p-4">
          <SourceNote tone="steel" className="!text-ochre">
            {t("detail.censusSource")}
          </SourceNote>
          <p className="mt-2 text-[13px] leading-relaxed">
            {t.rich("detail.censusText", {
              full: bill.amendedLawsFull.length,
              fullFmt: f.int(bill.amendedLawsFull.length),
              undercountFmt: f.int(bill.amendsUndercount),
              b: (chunks) => <span className="font-black">{chunks}</span>,
              u: (chunks) => <span className="font-black text-signal">{chunks}</span>,
            })}
          </p>
          {missedRefs.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {missedRefs.map((ref) => {
                const slug = statuteSlug(ref);
                return (
                  <li key={ref}>
                    {slug ? (
                      <Link
                        href={`/zakony/predpis/${slug}`}
                        className="block border border-ochre/40 px-2 py-0.5 font-mono text-[11px] font-bold text-ink transition-colors hover:border-ochre hover:bg-ochre/10"
                      >
                        č. {ref} Sb.
                      </Link>
                    ) : (
                      <span className="block border border-ochre/40 px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                        č. {ref} Sb.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* formální přikázání výborům (F15) */}
      {bill.committees.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>{t("detail.committeesHeading")}</SourceNote>
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
                    {COMMITTEE_ROLE_KEYS.has(c.role) ? t(`committeeRole.${c.role}`) : c.role}
                  </span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {COMMITTEE_STATUS_KEYS.has(c.status) ? t(`committeeStatus.${c.status}`) : c.status}
                  {c.assignedOn && <> · {c.assignedOn}</>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* předkladatelé — od průchodu 34 s pořadím podpisu: první podepsaný nese návrh,
          ostatní ho spolupodepsali. Rozlišení, které dřív povrch neuměl (Q-effort-2). */}
      {bill.sponsors.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>{t("detail.sponsorsHeading")}</SourceNote>
          <div className="mt-3 flex flex-wrap gap-2">
            {bill.sponsors.map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className={`group inline-flex items-center gap-2 border-2 px-3 py-1.5 transition-colors hover:bg-paper-strong ${
                  s.role === "predkladatel" ? "border-ink" : "border-hairline hover:border-ink"
                }`}
              >
                <span className="text-sm font-bold">{s.name}</span>
                {s.role && (
                  <span
                    className={`font-mono text-[10px] font-black uppercase tracking-wider ${
                      s.role === "predkladatel" ? "text-signal" : "text-steel"
                    }`}
                  >
                    {SPONSOR_ROLE_KEYS.has(s.role) ? t(`sponsorRole.${s.role}`) : s.role}
                    {s.joinedLater && <> · {t("detail.joinedLater")}</>}
                  </span>
                )}
                <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
          {bill.sponsorMinContribution != null && (
            <p className="mt-3 text-[13px] leading-relaxed text-steel">
              {t.rich("detail.minContribution", {
                scoreFmt: f.int(Math.round(bill.sponsorMinContribution)),
                b: (chunks) => <span className="font-black text-ink">{chunks}</span>,
              })}
            </p>
          )}
        </div>
      )}

      {/* zpravodajové — přidělená analytická role: kdo tisk odborně zpracovává pro
          plénum či výbor. Jiná práce než podpis pod návrhem. */}
      {bill.rapporteurs.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>{t("detail.rapporteursHeading")}</SourceNote>
          <ul className="mt-3 space-y-2">
            {bill.rapporteurs.map((r) => (
              <li key={r.pspId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/poslanec/${r.pspId}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-signal"
                >
                  {r.name}
                  <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                  {r.scopes
                    .map((s) => (RAPPORTEUR_SCOPE_KEYS.has(s) ? t(`rapporteurScope.${s}`) : s))
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* rozprava — kdo k tisku skutečně vystoupil na plénu (věcná vystoupení,
          předsedající vyloučeni). Počet vystoupení ≠ kvalita, proto jen poctivý počet. */}
      {bill.speakers.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>
            {t("detail.debateHeading", {
              countFmt: f.int(bill.speakers.reduce((s, x) => s + x.turns, 0)),
            })}
          </SourceNote>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {bill.speakers.slice(0, 12).map((s) => (
              <Link
                key={s.pspId}
                href={`/poslanec/${s.pspId}`}
                className="group inline-flex items-baseline gap-1.5 text-sm font-bold transition-colors hover:text-signal"
              >
                {s.name}
                <span className="font-mono text-[11px] font-normal tabular-nums text-steel">{s.turns}×</span>
              </Link>
            ))}
            {bill.speakers.length > 12 && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                {t("moreCount", { count: f.int(bill.speakers.length - 12) })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* písemné pozměňovací návrhy — autorství ze sněmovních dokumentů (typ 13) */}
      {bill.amendmentAuthors.length > 0 && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <SourceNote>
            {t("detail.amendmentDocsHeading", {
              countFmt: f.int(bill.amendmentAuthors.reduce((s, x) => s + x.count, 0)),
            })}
          </SourceNote>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {bill.amendmentAuthors.map((a) => (
              <Link
                key={a.pspId}
                href={`/poslanec/${a.pspId}`}
                className="group inline-flex items-baseline gap-1.5 text-sm font-bold transition-colors hover:text-signal"
              >
                {a.name}
                <span className="font-mono text-[11px] font-normal tabular-nums text-steel">{a.count}×</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* příznak střetu (Case ①) */}
      {bill.flaggedConflict && <ConflictBlock bill={bill} />}

      {/* sektorová atribuce na úrovni § (dávka 017) — firma ↔ sponzor ↔ novelizovaný zákon,
          s operativními §, pokud je census dokázal izolovat, a s dispozicí publikovaného
          forenzního posudku, který danou shodu už vyhodnotil. */}
      {bill.sectorAttributionFlags.length > 0 && (
        <SectorAttributionBlock flags={bill.sectorAttributionFlags} sponsors={bill.sponsors} />
      )}

      {/* reálný §-diff (e-Sbírka) */}
      {bill.paragraphDiffs.length > 0 && <ParagraphDiffBlock diffs={bill.paragraphDiffs} />}

      {/* gatovaný forenzní posudek */}
      {bill.forensic && (
        <ForensicBlock forensic={bill.forensic} summary={bill.summary} tiskId={bill.tiskId} />
      )}
    </div>
  );
}

/**
 * Příznak možného střetu (Case ①) — čísla, která tenhle blok vypisuje, jsou uložená na uzlu
 * tisku (`sponsor_money_companies`, `sponsor_contract_czk`) a graf u nich nedrží ani jméno
 * firmy, ani jméno předkladatele, kterému patří. Blok proto ŽÁDNOU firmu nejmenuje: jediné
 * poctivé vyústění je spis peněz konkrétního předkladatele, kde je každá vazba vidět i se
 * svou třídou a stavem lidské kontroly.
 *
 * Věta o připsání není opatrnost navíc, je to rozdíl v pravidle. Uložené číslo je NEJVYŠŠÍ
 * případ mezi předkladateli tisku a sčítá všechny firmy, ke kterým je předkladatel v grafu
 * vázán — včetně institucí, kde má jen správní roli (scripts/data-analysis/
 * kg-legislation-ingest.ts sčítá `linked_to` bez ohledu na třídu vazby). /penize peníze
 * instituce připisuje instituci, nikdy poslanci, takže spis předkladatele ukáže jinou,
 * přísněji připsanou částku. Kdyby tenhle blok firmy jmenoval, publikoval by je pod
 * pravidlem, které peněžní modul zrušil.
 */
function ConflictBlock({ bill }: { bill: LawBillView }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  // Kompaktní částka jde kanonickým formátovačem (`czkCompact` druh v lib/format.ts),
  // ne vlastní funkcí lawwatche — ta uměla vypsat „NaN Kč". Locale se odvozuje TOUŽ
  // cestou jako v `useFormat`, aby se dvě čísla v jednom odstavci nemohla rozejít.
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return (
    <div className="mt-6 border-l-4 border-signal bg-paper-strong p-4">
      <SourceNote tone="signal" className="!text-[10px]">
        {t("detail.conflictSource")}
      </SourceNote>
      <p className="mt-2 text-[15px] font-medium leading-relaxed">
        {t.rich("detail.conflictText", {
          count: bill.sponsorMoneyCompanies,
          countFmt: f.int(bill.sponsorMoneyCompanies),
          amount: formatByKind(bill.sponsorContractCzk, locale, "czkCompact"),
          b: (chunks) => <span className="font-black">{chunks}</span>,
        })}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-steel">{t("detail.conflictAttribution")}</p>
      {bill.sponsors.length > 0 && (
        <div className="mt-3">
          <SourceNote className="!text-[10px]">{t("detail.conflictMoneyFiles")}</SourceNote>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {bill.sponsors.map((s) => (
              <Link
                key={s.pspId}
                href={`/penize/${s.pspId}`}
                aria-label={t("detail.conflictMoneyFileAria", { name: s.name })}
                className="group inline-flex items-baseline gap-1.5 text-sm font-bold transition-colors hover:text-signal"
              >
                {s.name}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      )}
      <Link
        href="/penize/strety"
        className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
      >
        {t("detail.conflictStrety")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Gatovaný forenzní posudek — vždy jako ODVOZENÝ NÁVRH ČEKAJÍCÍ NA REVIZI, nikdy jako fakt
 * a nikdy jako verdikt o pochybení.
 *
 * Struktura (přestavba, dávka 009 — prezentační brána): nejdřív nepřehlédnutelný stav, pak
 * kompaktní hlavička se závažností a jistotou, pak tři panely v pořadí, v jakém čtenář
 * uvažuje — „co to mění“ (odvozeno z textu tisku) / „co analýza zjistila“ / „co analýza
 * NETVRDÍ“ — a na konci reference jako formátované odkazy, nikdy jako serializovaný objekt.
 *
 * Texty, které neprošly českou jazykovou branou (lib/analysis/language-gate.ts), se
 * NEZOBRAZUJÍ. Jejich počet se čtenáři přiznává, aby zkrácený blok nevypadal jako úplný.
 *
 * JISTOTA MÁ OD 2026-08-12 TRVALOU ADRESU. „4/5" je číslo, které se z posudku opisuje
 * nejčastěji, a bylo jediné na téhle ploše, které nešlo citovat. Claim razí sdílený
 * modul (features/lawwatch/lawClaims.ts), takže /overeni složí bajtově týž ref, a nese
 * provenienci TOHOTO posudku (`law-forensics@15`) — korpus se na jednom průchodu
 * neshodne (14 různých na uloženém grafu), takže korpusový základ by tady lhal.
 * Viditelný text zůstává bajtově týž: `f.int` nad celým číslem 1–5 vysází tutéž
 * číslici, jakou plocha sázela předtím.
 */
function ForensicBlock({
  forensic,
  summary,
  tiskId,
}: {
  forensic: NonNullable<LawBillView["forensic"]>;
  summary: string | null;
  /** Vnitřní id uzlu tisku — předmět claimu (`bill:tisk:<tiskId>`), ne veřejné číslo. */
  tiskId: number;
}) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const [open, setOpen] = useState(false);
  // null = tisk bez kanonické adresy uzlu (fallback id) nebo nekonečná hodnota:
  // číslo se pak vysází beze svědectví, nikdy s rozbitou adresou.
  const confidenceFigure =
    forensic.confidence != null ? forensicConfidenceClaim(tiskId, forensic.confidence, forensic) : null;
  const effects = forensic.unstatedEffects.filter((u) => u.effect);
  const hasFindings =
    Boolean(forensic.statedReasoning || forensic.researchedContext || forensic.conflictAssessment) || effects.length > 0;
  const severityLabel = SEVERITY_KEYS.has(forensic.severity)
    ? t(`severity.${forensic.severity}`)
    : forensic.severity;

  return (
    <div className="mt-8 border-2 border-cobalt">
      {/* stav — nepřehlédnutelný, plná plocha */}
      <div className="border-b-2 border-cobalt bg-cobalt px-4 py-2.5">
        <p className="font-mono text-[11px] font-black uppercase tracking-widest text-paper">
          {t("forensic.banner")}
        </p>
      </div>

      {/* kompaktní hlavička: závažnost + jistota + stav */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-cobalt/5 px-4 py-3">
        <SourceNote tone="steel" className="!text-cobalt">
          {t("forensic.gateLabel")}
          {forensic.pass != null ? <> · {t("graphPass", { pass: forensic.pass })}</> : null}
        </SourceNote>
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-steel">
          <span>
            {t("forensic.severityLabel")}{" "}
            <span className="text-sm font-black text-ink">{severityLabel}</span>
          </span>
          {forensic.confidence != null && (
            <span>
              {t("forensic.confidenceLabel")}{" "}
              <span className="text-sm font-black text-ink">
                {confidenceFigure ? (
                  <CitableNumber
                    value={confidenceFigure.value}
                    claim={confidenceFigure.claim}
                    locale={locale}
                    kind="int"
                  />
                ) : (
                  forensic.confidence
                )}
                /{FORENSIC_CONFIDENCE_SCALE}
              </span>
            </span>
          )}
          <span>
            {t("forensic.reviewStateLabel")} <span className="font-black text-ink">{forensic.reviewState}</span>
          </span>
        </span>
      </div>

      <div className="space-y-6 px-4 py-5">
        {/* 1 — co to mění */}
        <section>
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-signal">
            {t("detail.whatItChanges")}
          </h4>
          <p className="mt-1.5 text-[15px] font-medium leading-relaxed">
            {summary ?? t("forensic.noSummaryShort")}
          </p>
        </section>

        {/* 2 — co analýza zjistila */}
        <section className="border-t border-hairline pt-4">
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-cobalt">
            {t("forensic.foundHeading")}
          </h4>
          {!hasFindings && (
            <p className="mt-1.5 text-sm italic leading-relaxed text-steel">
              {t("forensic.czechPending")}
            </p>
          )}
          {forensic.statedReasoning && (
            <div className="mt-3">
              <SourceNote className="!text-[11px]">{t("forensic.declaredReason")}</SourceNote>
              <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.statedReasoning}</p>
            </div>
          )}
          {forensic.conflictAssessment && (
            <div className="mt-4">
              <SourceNote className="!text-[11px]">{t("forensic.conflictAssessment")}</SourceNote>
              <p className="mt-1.5 text-sm leading-relaxed">{forensic.conflictAssessment}</p>
            </div>
          )}

          {open && (
            <>
              {forensic.researchedContext && (
                <div className="mt-4">
                  <SourceNote className="!text-[11px]">{t("forensic.independentContext")}</SourceNote>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel">{forensic.researchedContext}</p>
                </div>
              )}
              {effects.length > 0 && (
                <div className="mt-4">
                  <SourceNote className="!text-[11px]">{t("forensic.undeclaredEffects")}</SourceNote>
                  <ul className="mt-2 space-y-3">
                    {effects.map((u, i) => (
                      <li key={i} className="border-l-4 border-signal pl-3">
                        <p className="text-sm font-medium leading-snug">{u.effect}</p>
                        {u.whoBenefits && (
                          <p className="mt-1 text-[13px] leading-snug text-steel">
                            <span className="font-bold uppercase tracking-wide">{t("forensic.whoBenefits")}</span>{" "}
                            {u.whoBenefits}
                          </p>
                        )}
                        {/^https?:\/\//.test(u.evidence) ? (
                          <a
                            href={u.evidence}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-cobalt hover:text-signal"
                          >
                            {citationRef("web", u.evidence).registry} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          // A textual citation sentence is evidence too (batch-016 audit B5 —
                          // the URL-only branch silently published six effects with no visible
                          // source). The loader has already gated the string; render it.
                          u.evidence.length > 0 && (
                            <p className="mt-1 text-[12px] leading-snug text-steel">
                              <span className="font-bold uppercase tracking-wide">{t("forensic.evidenceLabel")}</span>{" "}
                              {u.evidence}
                            </p>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {(forensic.researchedContext || effects.length > 0) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {open ? t("less") : t("forensic.moreResearch")}
            </button>
          )}
        </section>

        {/* 3 — co analýza NETVRDÍ */}
        <section className="border-t border-hairline pt-4">
          <h4 className="font-mono text-[11px] font-black uppercase tracking-widest text-ochre">
            {t("forensic.notClaimHeading")}
          </h4>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-steel">
            <li className="border-l-2 border-ochre pl-3">
              {t.rich("forensic.notClaim1", {
                state: forensic.reviewState,
                b: (chunks) => <span className="font-bold text-ink">{chunks}</span>,
              })}
            </li>
            <li className="border-l-2 border-ochre pl-3">
              {forensic.confidence != null
                ? t("forensic.notClaim2WithConfidence", {
                    severity: severityLabel,
                    confidence: forensic.confidence,
                  })
                : t("forensic.notClaim2", { severity: severityLabel })}
            </li>
            <li className="border-l-2 border-ochre pl-3">{t("forensic.notClaim3")}</li>
            {effects.length === 0 && (
              <li className="border-l-2 border-ochre pl-3">{t("forensic.notClaimNoEffects")}</li>
            )}
            {forensic.withheldFields > 0 && (
              <li className="border-l-2 border-ochre pl-3">
                {t("forensic.withheldParts", {
                  count: forensic.withheldFields,
                  countFmt: f.int(forensic.withheldFields),
                })}
              </li>
            )}
          </ul>
        </section>

        {forensic.citations.length > 0 && <CitationList citations={forensic.citations} />}

        <p className="border-t border-hairline pt-3 text-[13px] italic leading-relaxed text-steel">
          {t.rich("forensic.gateFootnote", {
            b: (chunks) => <span className="font-bold not-italic">{chunks}</span>,
          })}
        </p>
      </div>
    </div>
  );
}

/** Reference jako formátované odkazy — psp.cz podle čísla tisku, e-Sbírka podle „č. N/RRRR Sb.“,
 * uzly grafu jako čitelný identifikátor bez odkazu (veřejná stránka pro ně neexistuje). */
function CitationList({ citations }: { citations: NonNullable<LawBillView["forensic"]>["citations"] }) {
  const t = useTranslations("lawwatch");
  return (
    <section className="border-t border-hairline pt-4">
      <SourceNote className="!text-[11px]">{t("forensic.referencesHeading", { count: citations.length })}</SourceNote>
      <ol className="mt-2 space-y-2.5">
        {citations.map((c, i) => {
          const ref = citationRef(c.kind, c.source);
          return (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="pt-0.5 font-mono text-[11px] font-bold tabular-nums text-steel">[{i + 1}]</span>
              <span>
                {c.claim && <span className="block text-[13px] leading-snug">{c.claim}</span>}
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] uppercase tracking-wider">
                  <span className="text-steel">
                    {CITATION_KIND_KEYS.has(c.kind) ? t(`citationKind.${c.kind}`) : c.kind}
                  </span>
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-cobalt transition-colors hover:text-signal"
                    >
                      {ref.registry} · {ref.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-steel">
                      {ref.registry} · {ref.label}
                    </span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Sektorová atribuce na úrovni § (dávka 017) — census amendovaných § ⋈ ledger peněžních
 * vazeb. Každá shoda je ODVOZENÝ, NEGATIVOVANÝ signál (attributionStatus: derived-ungated —
 * žádná lidská brána ji neprošla) a NIKDY se nezobrazí bez dispozice publikovaného forenzního
 * posudku, který ji už vyhodnotil — bez dispozice by shoda četla jako holé, nevyhodnocené
 * podezření. Řádek bez operativních § řekne poctivě proč (census bez §-koše vs. selhání
 * rozdělovače) místo aby paragraf jen vynechal beze slova. */
function SectorAttributionBlock({
  flags,
  sponsors,
}: {
  flags: LawBillView["sectorAttributionFlags"];
  sponsors: LawBillView["sponsors"];
}) {
  const t = useTranslations("lawwatch");
  // The ungated-label sentence is byte-identical to overeni's own — imported from the ONE
  // vocabulary (features/overeni/gateVocabulary.ts) rather than kept as a second copy under
  // the lawwatch namespace (2026-08-06 fix).
  const tOvereni = useTranslations("overeni");
  const f = useFormat();
  // `flag.sponsor` is a NAME — the payload's producer wrote `personName.get(sid)` for one of
  // this print's own sponsors, i.e. the same `listPersons().nameFull` string `bill.sponsors`
  // carries. The join is therefore exact equality, and it links only when exactly ONE sponsor
  // answers to that name: a second match makes the pspId unknowable, and „the closest one" is
  // an address about the WRONG person on a conflict surface. No match ⇒ the name still renders,
  // verbatim, unlinked.
  const pspIdOfSponsor = (name: string): number | null => {
    const hits = sponsors.filter((s) => s.name === name);
    return hits.length === 1 ? hits[0].pspId : null;
  };
  return (
    <div className="mt-6 border-l-4 border-ochre bg-ochre/5 p-4">
      <SourceNote tone="steel" className="!text-ochre">
        {t("detail.sectorAttribution.source")}
      </SourceNote>
      <p className="mt-2 text-[15px] font-bold leading-snug">
        {t("detail.sectorAttribution.heading", { count: flags.length, countFmt: f.int(flags.length) })}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-steel">{t("detail.sectorAttribution.intro")}</p>
      <ul className="mt-4 space-y-4">
        {flags.map((flag, i) => {
          const sponsorPspId = pspIdOfSponsor(flag.sponsor);
          return (
          <li key={i} className="border-l-2 border-ink/20 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {/* Firma vede na svůj vlastní spis peněz jen tehdy, když se její název v grafu
                  jednoznačně přeložil na IČO — jinak zůstane jménem bez odkazu (nikdy adresa
                  „nejspíš správná"). */}
              {flag.companyIco ? (
                <Link
                  href={`/penize/firma/${flag.companyIco}`}
                  aria-label={t("detail.sectorAttribution.companyFileAria", { company: flag.company })}
                  className="group inline-flex items-baseline gap-1 text-sm font-bold transition-colors hover:text-signal"
                >
                  {flag.company}
                  <ArrowUpRight className="h-3 w-3 shrink-0 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <span className="text-sm font-bold">{flag.company}</span>
              )}
              <span className="font-mono text-[10px] font-black uppercase tracking-wider text-steel">
                {SECTOR_KEYS.has(flag.sector) ? t(`sector.${flag.sector}`) : flag.sector}
              </span>
            </div>
            {/* Předkladatel, jehož firma shodu vyvolala — bez něj řádek říká „firma × zákon"
                a zamlčí, čí vazba to vůbec je. */}
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("detail.sectorAttribution.sponsorLabel")}{" "}
              {sponsorPspId != null ? (
                <Link
                  href={`/poslanec/${sponsorPspId}`}
                  className="font-black text-ink transition-colors hover:text-signal"
                >
                  {flag.sponsor}
                </Link>
              ) : (
                <span className="font-black text-ink">{flag.sponsor}</span>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-steel">
              {t.rich("detail.sectorAttribution.viaLaw", {
                sector: SECTOR_KEYS.has(flag.sector) ? t(`sector.${flag.sector}`) : flag.sector,
                ref: flag.viaLawRef,
                b: (chunks) => <span className="font-bold text-ink">{chunks}</span>,
              })}
            </p>

            {flag.operativeParagraphs ? (
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                {t("detail.sectorAttribution.paragraphs")}{" "}
                <span className="font-black text-ink">
                  {flag.operativeParagraphs.map((p) => `§ ${p}`).join(", ")}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] italic leading-relaxed text-steel">
                {flag.partitionFallback
                  ? t("detail.sectorAttribution.noParagraphsFallback")
                  : t("detail.sectorAttribution.noParagraphsCensus")}
              </p>
            )}

            {flag.dispositionWithheld ? (
              <p className="mt-2 border-l-2 border-cobalt pl-2.5 text-[13px] italic leading-relaxed text-steel">
                {t("detail.sectorAttribution.dispositionWithheld")}
              </p>
            ) : (
              <p className="mt-2 border-l-2 border-cobalt pl-2.5 text-[13px] leading-relaxed">
                {flag.verdictDisposition}
              </p>
            )}

            <p className="mt-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
              {tOvereni(GATE_UNGATED_KEY)}
            </p>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Reálný §-diff mezi dvěma PLATNÝMI zněními zákona z e-Sbírky (SPARQL point-query — žádný
 * hromadný výpis, žádná syntetizovaná data). Text před/po je doslovný `text-fragmentu`
 * z e-Sbírky (jen bez HTML značek), nikdy dopočítaný. */
function ParagraphDiffBlock({ diffs }: { diffs: LawBillView["paragraphDiffs"] }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  return (
    <div className="mt-8 border-2 border-ochre">
      {diffs.map((d, di) => (
        <div key={`${d.law}-${d.parScope}-${di}`} className={di > 0 ? "border-t-2 border-ochre" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ochre bg-ochre/5 px-4 py-3">
            <SourceNote tone="steel" className="!text-ochre">
              {t("diffBlock.source", { law: d.law })}
            </SourceNote>
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {f.date(d.from.date)} → {f.date(d.to.date)}
            </span>
          </div>
          <ul className="space-y-4 px-4 py-4">
            {d.hunks.map((h, hi) => (
              <li key={hi} className="border-l-4 border-hairline pl-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                  {h.fragment}{" "}
                  <span className="text-steel">— {DIFF_OP_KEYS.has(h.op) ? t(`diffOp.${h.op}`) : h.op}</span>
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
            {t.rich("diffBlock.verbatim", {
              source: d.source,
              from: (chunks) => (
                <a href={d.from.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
                  {chunks}
                </a>
              ),
              to: (chunks) => (
                <a href={d.to.eli} target="_blank" rel="noreferrer" className="text-cobalt hover:text-signal">
                  {chunks}
                </a>
              ),
              fromDate: d.from.date,
              toDate: d.to.date,
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
