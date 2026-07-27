"use client";

/*
 * Dosier poslance — manifestační průchod (2026-07-25): 165/207 poslanců nese
 * bohaté effort_* dosierové vlastnosti (tematické zaměření, legislativní
 * stopa, poznámky, veřejná role, datové výhrady) z effort-loopu (Case ②) —
 * dosud bez reálného povrchu. Tahle sekce je ten povrch.
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
 * Čestná degradace: bez JEDINÉHO dosierového pole se sekce nevykreslí vůbec
 * (žádná prázdná skořápka) — 42/207 poslanců effort-loop batch 001–005 ještě
 * nedosáhl.
 */

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import ExpandableText from "./ExpandableText";
import type { RapporteurBill, SponsoredBill } from "../getProfileData";

/** Czech labels for the zpravodaj assignment scopes (pass 34, psp.cz tisky.zip). */
const RAPPORTEUR_SCOPE_CZ: Record<string, string> = {
  zpravodaj_ov: "zpravodaj pro 1. čtení",
  zpravodaj_ps: "zpravodaj (určen předsedou PS)",
  zpravodaj_vyboru: "zpravodaj výboru",
  zpravodaj_dokumentu: "zpravodaj usnesení výboru",
};

export default function DossierSection({
  index,
  publicRole,
  workThemes,
  billFocus,
  notes,
  dataFlag,
  sponsoredBills,
  billsFirstSigned,
  billsCoSigned,
  rapporteurBills,
}: {
  index: number;
  publicRole: string | null;
  workThemes: string[] | null;
  billFocus: string | null;
  notes: string | null;
  dataFlag: string | null;
  sponsoredBills: SponsoredBill[];
  billsFirstSigned: number | null;
  billsCoSigned: number | null;
  rapporteurBills: RapporteurBill[];
}) {
  const hasThemes = !!workThemes && workThemes.length > 0;
  const hasBillTrack = !!billFocus || sponsoredBills.length > 0;
  const hasSplit = billsFirstSigned != null && billsCoSigned != null && billsFirstSigned + billsCoSigned > 0;
  const hasAny = !!publicRole || hasThemes || hasBillTrack || !!notes || !!dataFlag || rapporteurBills.length > 0;
  if (!hasAny) return null;

  return (
    <section className="mt-16 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title="Pracovní profil"
        aside={<SourceNote>effort-loop enrichment · psp.cz + veřejné registry</SourceNote>}
      />
      <div className="mt-8 flex flex-col gap-8">
        {publicRole && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">Veřejná role</p>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">{publicRole}</p>
          </div>
        )}

        {hasThemes && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">Tematické zaměření</p>
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
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">Legislativní stopa</p>
            {hasSplit && (
              <p className="mt-2 text-[15px] leading-relaxed text-ink">
                <span className="font-black">{billsFirstSigned}</span>{" "}
                {billsFirstSigned === 1 ? "návrh předložil" : billsFirstSigned! >= 2 && billsFirstSigned! <= 4 ? "návrhy předložil" : "návrhů předložil"}{" "}
                jako první podepsaný · <span className="font-black">{billsCoSigned}</span> spolupodepsal
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
                        sn. tisk {b.cislo}
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
                        {b.role === "predkladatel" ? "předložil" : "spolupodepsal"}
                        {b.joinedLater && " (připojil se dodatečně)"}
                      </span>
                    )}
                    {(b.fateSb || b.stav) && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                        {b.fateSb ? (
                          <>
                            → vyhlášen jako <span className="font-black text-ink">č. {b.fateSb} Sb.</span>
                          </>
                        ) : (
                          <>stav: {b.stav}</>
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
            <SourceNote className="mt-2.5 !text-[10px]">
              zdroj: psp.cz — tisky (predkladatel: pořadí podpisu; hist: stav a vyhlášení) · effort_bill_focus
            </SourceNote>
          </div>
        )}

        {rapporteurBills.length > 0 && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              Zpravodajství — analytická práce na tiscích
            </p>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-steel">
              Zpravodaj tisk pro sněmovnu či výbor odborně zpracovává — je to přidělená analytická práce nad
              rámec podpisu pod návrhem.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {rapporteurBills.map((b) => (
                <li key={b.cislo ?? b.title} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {b.appUrl ? (
                    <Link
                      href={b.appUrl}
                      className="group inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-cobalt"
                      title={b.title}
                    >
                      sn. tisk {b.cislo}
                      <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel">
                      {b.title}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                    {b.scopes.map((s) => RAPPORTEUR_SCOPE_CZ[s] ?? s).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <SourceNote className="mt-2.5 !text-[10px]">
              zdroj: psp.cz — tisky (hist: zpravodaj pléna; hist_vybory, tisky_za: zpravodaj výboru)
            </SourceNote>
          </div>
        )}

        {notes && (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">Poznámky k datům</p>
            <ExpandableText className="mt-2 max-w-3xl text-[15px] leading-relaxed text-steel" text={notes} />
            <SourceNote className="mt-2.5 !text-[10px]">zdroj: effort-loop enrichment · effort_notes</SourceNote>
          </div>
        )}

        {dataFlag && (
          <div className="flex max-w-3xl items-start gap-3 border-2 border-ochre bg-ochre/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ochre" aria-hidden />
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-ochre">Datová výhrada</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{dataFlag}</p>
              <SourceNote className="mt-2 !text-[10px]">zdroj: effort-loop enrichment · effort_data_flag</SourceNote>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
