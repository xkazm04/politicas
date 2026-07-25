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

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import ExpandableText from "./ExpandableText";
import type { SponsoredBill } from "../getProfileData";

export default function DossierSection({
  index,
  publicRole,
  workThemes,
  billFocus,
  notes,
  dataFlag,
  sponsoredBills,
}: {
  index: number;
  publicRole: string | null;
  workThemes: string[] | null;
  billFocus: string | null;
  notes: string | null;
  dataFlag: string | null;
  sponsoredBills: SponsoredBill[];
}) {
  const hasThemes = !!workThemes && workThemes.length > 0;
  const hasBillTrack = !!billFocus || sponsoredBills.length > 0;
  const hasAny = !!publicRole || hasThemes || hasBillTrack || !!notes || !!dataFlag;
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
            {billFocus && (
              <ExpandableText className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink" text={billFocus} />
            )}
            {sponsoredBills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sponsoredBills.map((b) =>
                  b.url ? (
                    <a
                      key={b.url}
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-cobalt"
                      title={b.title}
                    >
                      sn. tisk {b.cislo}
                      <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span
                      key={b.title}
                      className="inline-flex items-center gap-1 border-2 border-hairline px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel"
                      title={b.title}
                    >
                      {b.title}
                    </span>
                  ),
                )}
              </div>
            )}
            <SourceNote className="mt-2.5 !text-[10px]">
              zdroj: psp.cz — tisky (sponsors, číslo tisku) · effort_bill_focus
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
