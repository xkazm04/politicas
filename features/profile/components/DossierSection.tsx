"use client";

/*
 * Dosier poslance — manifestační průchod (2026-07-25): poslanci nesou bohaté
 * effort_* dosierové vlastnosti (tematické zaměření, legislativní stopa,
 * poznámky, veřejná role, datové výhrady) z effort-loopu (Case ②).
 * Tahle sekce je jejich povrch.
 *
 * REÁLNÁ DATA, žádné LLM ad hoc: effort_work_themes / effort_bill_focus /
 * effort_notes / effort_data_flag píše deterministicky gatovaný Sonnet/Opus
 * pipeline (scripts/case-loops/effort/*, lib/analysis/*) z psp.cz + veřejných
 * rejstříků — viz docs/data-analysis/case-effort/handoff.md. effort_public_role
 * sdílí zdroj s LowScoreReasonBadge (jiný kontext: tam korektiv nízkého skóre,
 * tady plný životopisný rámec).
 *
 * Legislativní stopa kombinuje prózu (effort_bill_focus) se STRUKTUROVANÝM
 * seznamem sponsors hran → uzel tisku, odkaz na psp.cz historie.sqw stavěný
 * z `cislo` (veřejné číslo tisku), NIKDY z `tiskId` (interní graf-id,
 * historie.sqw ho nerozpozná — viz SponsoredBill v getProfileData.ts).
 *
 * ZDROJE PO POLÍCH: počet písemných pozměňovacích návrhů (amendments_authored,
 * pass 35) pochází ze sněmovních dokumentů (sd_dokument typ 13) — jiné datové
 * sady než tisky/effort_bill_focus, pod jejichž citací se dřív vykresloval.
 * Má proto vlastní řádek s vlastní citací.
 *
 * Čestná degradace: bez JEDINÉHO dosierového pole se sekce nevykreslí vůbec
 * (žádná prázdná skořápka) — `hasDossierContent()` je ten samý predikát,
 * exportovaný, aby ProfilePage uměla očíslovat oddíly podle toho, co se
 * SKUTEČNĚ vykreslí (dřív dostávala pevné index={2} a stránka pak četla
 * 01 → 03 → 04 → 05).
 */

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import ExpandableText from "./ExpandableText";
import WorkhorseBadge from "@/features/civicscore/components/WorkhorseBadge";
import RapporteurBadge from "@/features/civicscore/components/RapporteurBadge";
import { workhorseFlavourCopy } from "@/lib/analysis/workhorse-flavour";
import { rapporteurLoadCopy } from "@/lib/analysis/rapporteur-load";
import type { BillEngagement, RapporteurBill, SponsoredBill } from "../getProfileData";

/** next-intl key per zpravodaj assignment scope (pass 34, psp.cz tisky.zip). */
const RAPPORTEUR_SCOPE_KEY: Record<string, string> = {
  zpravodaj_ov: "dossierScopeOv",
  zpravodaj_ps: "dossierScopePs",
  zpravodaj_vyboru: "dossierScopeVybor",
  zpravodaj_dokumentu: "dossierScopeDokument",
};

export interface DossierContent {
  publicRole: string | null;
  workThemes: string[] | null;
  billFocus: string | null;
  notes: string | null;
  dataFlag: string | null;
  sponsoredBills: SponsoredBill[];
  billsFirstSigned: number | null;
  billsCoSigned: number | null;
  rapporteurBills: RapporteurBill[];
  amendmentsAuthored: number | null;
  // ── pracovní záznam (pass 35 engagement + index counters) ─────────────────
  floorSpeeches: BillEngagement[];
  floorSpeechTurns: number;
  amendmentBills: BillEngagement[];
  amendmentBillCount: number;
  speechTurnsTotal: number | null;
  interpellations: number | null;
  absenceRate: number | null;
  /** `effort_workhorse_flavour` — closed vocabulary, copy from lib/analysis. */
  workhorseFlavour: string | null;
  /** `effort_rapporteur_load` — badge copy + threshold in lib/analysis. */
  rapporteurLoad: number;
  /** `effort_provenance.computedAt` — kdy enrichment ty verdikty zaznamenal. Null = nedatováno
   *  (nikdy se nedopočítává na dnešek), stejné pravidlo jako u LowScoreReasonChip. */
  effortRecordedAt: string | null;
}

/** Does this MP carry anything this section would actually render? The section
 *  renders iff this is true — and ProfilePage numbers its sections by it, so a
 *  reader never sees a gap in the numbering where a section was skipped. */
export function hasDossierContent(d: DossierContent): boolean {
  return (
    !!d.publicRole ||
    (!!d.workThemes && d.workThemes.length > 0) ||
    !!d.billFocus ||
    d.sponsoredBills.length > 0 ||
    !!d.notes ||
    !!d.dataFlag ||
    d.rapporteurBills.length > 0 ||
    // The work record: a node carrying any of these has something real to show,
    // including a HONEST ZERO ("0 interpelací" is a fact the graph asserts). Only
    // a node carrying none of them at all leaves the section unrendered.
    d.floorSpeeches.length > 0 ||
    d.amendmentBills.length > 0 ||
    d.speechTurnsTotal != null ||
    d.interpellations != null ||
    d.absenceRate != null ||
    !!workhorseFlavourCopy(d.workhorseFlavour) ||
    !!rapporteurLoadCopy(d.rapporteurLoad)
  );
}

export default function DossierSection({ index, ...d }: DossierContent & { index: number }) {
  const t = useTranslations("profile");
  // Numbers reach the ICU strings ALREADY formatted (lib/format.ts) and the raw
  // count is passed only to select the plural category — next-intl would
  // otherwise render them through `Intl.NumberFormat`, which is both outside the
  // app's single formatting authority and an SSR/CSR hydration risk (server and
  // client can carry different ICU data).
  const f = useFormat();
  const {
    publicRole,
    workThemes,
    billFocus,
    notes,
    dataFlag,
    sponsoredBills,
    billsFirstSigned,
    billsCoSigned,
    rapporteurBills,
    amendmentsAuthored,
    floorSpeeches,
    floorSpeechTurns,
    amendmentBills,
    amendmentBillCount,
    speechTurnsTotal,
    interpellations,
    absenceRate,
    workhorseFlavour,
    rapporteurLoad,
    effortRecordedAt,
  } = d;

  const hasThemes = !!workThemes && workThemes.length > 0;
  const hasBillTrack = !!billFocus || sponsoredBills.length > 0;
  const hasSplit = billsFirstSigned != null && billsCoSigned != null && billsFirstSigned + billsCoSigned > 0;
  const hasAmendments = (amendmentsAuthored != null && amendmentsAuthored > 0) || amendmentBills.length > 0;
  // The per-bill breakdown accounts for the whole stored total only when the two
  // agree; where it does not, the section SAYS how much it could not place rather
  // than presenting a partial list as the record.
  const amendmentsUnplaced =
    amendmentsAuthored != null ? Math.max(0, amendmentsAuthored - amendmentBillCount) : 0;
  const hasSpeeches = speechTurnsTotal != null || floorSpeeches.length > 0;
  const hasCounters = interpellations != null || absenceRate != null;
  const verdicts = !!workhorseFlavourCopy(workhorseFlavour) || !!rapporteurLoadCopy(rapporteurLoad);
  if (!hasDossierContent(d)) return null;

  return (
    // `id` — oddíl je PODMÍNĚNÝ (poslanec bez obsahu dosieru ho nedostane), takže
    // ho navModel mezi kotvami lišty záměrně neuvádí; adresa /poslanec/<id>#dosier
    // ale musí existovat, aby na pracovní profil šlo odkázat zvenčí.
    <section id="dosier" className="mt-16 border-t-4 border-ink pt-10">
      <SectionHeading index={index} title={t("dossierHeading")} aside={<SourceNote>{t("dossierAside")}</SourceNote>} />
      <div className="mt-8 flex flex-col gap-8">
        {publicRole && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierPublicRole")}
            </p>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">{publicRole}</p>
          </div>
        )}

        {/* Verdiktní štítky (Case ② effort-loop) — TÁŽ copy, kterou vykresluje
            žebříček, importovaná z lib/analysis (žádný druhý textový engine).
            Souměrné zacházení: pozitivní nález má stejnou váhu jako konflikt. */}
        {verdicts && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierVerdicts")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <WorkhorseBadge
                flavour={workhorseFlavour}
                speechTurns={speechTurnsTotal}
                recordedAt={effortRecordedAt}
              />
              <RapporteurBadge load={rapporteurLoad} recordedAt={effortRecordedAt} />
            </div>
            {workhorseFlavourCopy(workhorseFlavour) && (
              <p className="mt-2.5 max-w-3xl text-[14px] leading-relaxed text-steel">
                {workhorseFlavourCopy(workhorseFlavour)!.detail}
              </p>
            )}
            {rapporteurLoadCopy(rapporteurLoad) && (
              <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-steel">
                {rapporteurLoadCopy(rapporteurLoad)!.detail}
              </p>
            )}
            <SourceNote className="mt-2.5 !text-[10px]">{t("dossierVerdictsSource")}</SourceNote>
          </div>
        )}

        {hasThemes && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierThemes")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {workThemes!.map((theme) => (
                <span
                  key={theme}
                  className="border-2 border-hairline px-3 py-1.5 text-[13px] font-bold uppercase leading-none tracking-tight text-ink"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasBillTrack && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierBillTrack")}
            </p>
            {hasSplit && (
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                {t("dossierBillSplit", {
                  first: billsFirstSigned!,
                  firstFmt: f.int(billsFirstSigned!),
                  coFmt: f.int(billsCoSigned!),
                })}
              </p>
            )}
            {billFocus && (
              <ExpandableText className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink" text={billFocus} />
            )}
            {sponsoredBills.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {sponsoredBills.map((b) => (
                  <li key={b.cislo ?? b.title} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    {b.appUrl ? (
                      <Link
                        href={b.appUrl}
                        className="group inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-cobalt"
                        title={b.title}
                      >
                        {t("dossierPrint", { cislo: f.int(b.cislo!) })}
                        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                      </Link>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel"
                        title={b.title}
                      >
                        {b.title}
                      </span>
                    )}
                    {b.role && (
                      <span
                        className={`font-mono text-[10px] font-black uppercase tracking-wider ${
                          b.role === "predkladatel" ? "text-signal" : "text-steel"
                        }`}
                      >
                        {b.role === "predkladatel" ? t("dossierRoleSubmitted") : t("dossierRoleCoSigned")}
                        {b.joinedLater && ` ${t("dossierJoinedLater")}`}
                      </span>
                    )}
                    {(b.fateSb || b.stav) && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                        {b.fateSb ? (
                          <>
                            {t("dossierEnactedAs")}{" "}
                            <span className="font-black text-ink">{t("dossierSbNumber", { ref: b.fateSb })}</span>
                          </>
                        ) : (
                          t("dossierState", { stav: b.stav! })
                        )}
                      </span>
                    )}
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] uppercase tracking-wider text-steel underline decoration-hairline transition-colors hover:text-cobalt"
                      >
                        psp.cz
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <SourceNote className="mt-2.5 !text-[10px]">{t("dossierBillTrackSource")}</SourceNote>
          </div>
        )}

        {/* Písemné pozměňovací návrhy — VLASTNÍ blok s vlastní citací. Dřív se
            číslo vykreslovalo uvnitř věty o tiscích, pod SourceNote citující
            tisky/predkladatel + effort_bill_focus, tedy pod zdrojem, ze kterého
            NEPOCHÁZÍ (pass 35 je čte z sd_dokument typ 13). */}
        {hasAmendments && (
          <div>
            {amendmentsAuthored != null && amendmentsAuthored > 0 && (
              <p className="text-[15px] leading-relaxed text-ink">
                {t("dossierAmendments", { count: amendmentsAuthored, countFmt: f.int(amendmentsAuthored) })}
              </p>
            )}
            {/* Per-bill breakdown — the count alone said an MP filed amendments but
                never to WHAT; the edge carries the print, so the page shows it. */}
            {amendmentBills.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {amendmentBills.map((b) => (
                  <EngagementRow key={b.cislo ?? b.title} bill={b} unitKey="dossierAmendmentUnit" />
                ))}
              </ul>
            )}
            {amendmentsUnplaced > 0 && (
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-steel">
                {t("dossierAmendmentsUnplaced", {
                  count: amendmentsUnplaced,
                  countFmt: f.int(amendmentsUnplaced),
                })}
              </p>
            )}
            <SourceNote className="mt-2 !text-[10px]">{t("dossierAmendmentsSource")}</SourceNote>
          </div>
        )}

        {/* Vystoupení v sále — index z nich počítá složku „Vystoupení", ale spis
            dosud neukázal ani celkové číslo, natož k čemu poslanec mluvil. */}
        {hasSpeeches && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierSpeeches")}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {speechTurnsTotal == null ? (
                <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-ochre">
                  {t("dossierCounterMissing")}
                </span>
              ) : (
                t("dossierSpeechTotal", { count: speechTurnsTotal, countFmt: f.int(speechTurnsTotal) })
              )}
            </p>
            {floorSpeeches.length > 0 && (
              <>
                <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-steel">
                  {t("dossierSpeechOnBills", {
                    turns: floorSpeechTurns,
                    turnsFmt: f.int(floorSpeechTurns),
                    bills: floorSpeeches.length,
                    billsFmt: f.int(floorSpeeches.length),
                  })}
                </p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {floorSpeeches.map((b) => (
                    <EngagementRow key={b.cislo ?? b.title} bill={b} unitKey="dossierSpeechUnit" />
                  ))}
                </ul>
              </>
            )}
            {/* Coverage stated, never implied: spoke_on exists only for the bills the
                graph carries, so the breakdown is a SUBSET of the floor record. */}
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-steel">{t("dossierSpeechCoverage")}</p>
            <SourceNote className="mt-2 !text-[10px]">{t("dossierSpeechSource")}</SourceNote>
          </div>
        )}

        {/* Interpelace a docházka — dosud jen neviditelné vstupy do skóre. */}
        {hasCounters && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierCounters")}
            </p>
            <div className="mt-2.5 grid gap-px border border-ink bg-ink sm:grid-cols-2">
              <Counter
                label={t("dossierInterpellations")}
                value={interpellations == null ? null : f.int(interpellations)}
                source={t("dossierInterpellationsSource")}
                missing={t("dossierCounterMissing")}
              />
              <Counter
                label={t("dossierAbsence")}
                value={absenceRate == null ? null : `${f.dec(absenceRate * 100)} %`}
                source={t("dossierAbsenceSource")}
                missing={t("dossierCounterMissing")}
              />
            </div>
            {/* Písemná a ústní interpelace jsou DVA různé nástroje z DVOU různých
                datových sad (tisky.zip druh 6 · interp.zip poradi) a ingest je
                sečte do jediné vlastnosti `interpellations` — rozpad na uzlu
                neexistuje (ověřeno na živém grafu: 207/207 uzlů nese jen součet).
                Stránka to říká místo aby nechala čtenáře hádat, co v čísle je;
                rozdělit ho může až průchod ingestem, ne renderer. */}
            {interpellations != null && (
              <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-steel">
                {t("dossierInterpellationsComposition")}
              </p>
            )}
          </div>
        )}

        {rapporteurBills.length > 0 && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("dossierRapporteur")}
            </p>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-steel">{t("dossierRapporteurBlurb")}</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {rapporteurBills.map((b) => (
                <li key={b.cislo ?? b.title} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {b.appUrl ? (
                    <Link
                      href={b.appUrl}
                      className="group inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-cobalt"
                      title={b.title}
                    >
                      {t("dossierPrint", { cislo: f.int(b.cislo!) })}
                      <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel">
                      {b.title}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                    {b.scopes
                      .map((s) => (RAPPORTEUR_SCOPE_KEY[s] ? t(RAPPORTEUR_SCOPE_KEY[s]) : s))
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <SourceNote className="mt-2.5 !text-[10px]">{t("dossierRapporteurSource")}</SourceNote>
          </div>
        )}

        {notes && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{t("dossierNotes")}</p>
            <ExpandableText className="mt-2 max-w-3xl text-[15px] leading-relaxed text-steel" text={notes} />
            <SourceNote className="mt-2.5 !text-[10px]">{t("dossierNotesSource")}</SourceNote>
          </div>
        )}

        {dataFlag && (
          <div className="flex max-w-3xl items-start gap-3 border-2 border-ochre bg-ochre/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ochre" aria-hidden />
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-ochre">
                {t("dossierDataFlag")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{dataFlag}</p>
              <SourceNote className="mt-2 !text-[10px]">{t("dossierDataFlagSource")}</SourceNote>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** One bill the MP engaged with, with the count of that engagement. Same print
 *  chip as the legislative track above — link built from `cislo`, never `tiskId`
 *  (see SponsoredBill), and a bill with no `cislo` renders unlinked, not broken. */
function EngagementRow({ bill, unitKey }: { bill: BillEngagement; unitKey: string }) {
  const t = useTranslations("profile");
  const f = useFormat();
  return (
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {bill.appUrl ? (
        <Link
          href={bill.appUrl}
          className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-cobalt"
          title={bill.title}
        >
          {t("dossierPrint", { cislo: f.int(bill.cislo!) })}
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel"
          title={bill.title}
        >
          {bill.title}
        </span>
      )}
      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-ink">
        {t(unitKey, { count: bill.count, countFmt: f.int(bill.count) })}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-steel" title={bill.title}>
        {bill.title}
      </span>
    </li>
  );
}

/** A single work-record figure with its own citation — or an honest "the graph
 *  does not carry this", because a missing prop rendered as 0 would be a claim. */
function Counter({
  label,
  value,
  source,
  missing,
}: {
  label: string;
  value: string | null;
  source: string;
  missing: string;
}) {
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p className="mt-1.5 text-3xl font-black tabular-nums">
        {value ?? (
          <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-ochre">{missing}</span>
        )}
      </p>
      <SourceNote className="mt-2 !text-[10px]">{source}</SourceNote>
    </div>
  );
}
