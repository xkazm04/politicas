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
import type { RapporteurBill, SponsoredBill } from "../getProfileData";

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
    d.rapporteurBills.length > 0
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
  } = d;

  const hasThemes = !!workThemes && workThemes.length > 0;
  const hasBillTrack = !!billFocus || sponsoredBills.length > 0;
  const hasSplit = billsFirstSigned != null && billsCoSigned != null && billsFirstSigned + billsCoSigned > 0;
  if (!hasDossierContent(d)) return null;

  return (
    <section className="mt-16 border-t-4 border-ink pt-10">
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
        {amendmentsAuthored != null && amendmentsAuthored > 0 && (
          <div>
            <p className="text-[15px] leading-relaxed text-ink">
              {t("dossierAmendments", { count: amendmentsAuthored, countFmt: f.int(amendmentsAuthored) })}
            </p>
            <SourceNote className="mt-2 !text-[10px]">{t("dossierAmendmentsSource")}</SourceNote>
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
